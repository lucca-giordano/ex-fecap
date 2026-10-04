// Decodificação de paleta, flats e texturas de parede. Funções puras (sem WebGPU).
// Todas as imagens saem como índices da paleta (1 byte por pixel, linha por linha).

import { WadError, readName } from './WadFile.js';

const LE = true;
const SKY = 'F_SKY1';
const FLAT_SIZE = 4096; // 64 x 64

const hasTexture = (name) => name !== '' && name !== '-';

// Última ocorrência de um lump com esse nome (PWADs e listas posteriores têm prioridade).
// `accept` filtra, por exemplo, só lumps com 4096 bytes para flats.
export function findLastLump(wad, name, accept = () => true) {
  const n = name.toUpperCase();
  for (let i = wad.lumps.length - 1; i >= 0; i--) {
    const lump = wad.lumps[i];
    if (lump.name === n && accept(lump)) return i;
  }
  return -1;
}

// PLAYPAL: 14 paletas de 256 * RGB. Só a paleta 0 é usada.
export function readPalette(wad) {
  const i = findLastLump(wad, 'PLAYPAL', (l) => l.size >= 768);
  if (i < 0) throw new WadError('PLAYPAL não encontrado');
  return wad.getLumpBytes(i).slice(0, 768);
}

// Patch no formato "picture": cabeçalho, offsets de coluna e colunas formadas por "posts".
// Devolve { width, height, indices, opacity } ou lança WadError se os dados estiverem fora do lump.
export function decodePatch(bytes, name = '?') {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 8) throw new WadError(`patch ${name}: lump pequeno demais`);
  const width = view.getUint16(0, LE);
  const height = view.getUint16(2, LE);
  // leftOffset (4) e topOffset (6): ignorados nas texturas de parede, usados no menu (V_DrawPatch).
  const leftOffset = view.getInt16(4, LE);
  const topOffset = view.getInt16(6, LE);
  if (8 + width * 4 > bytes.length) throw new WadError(`patch ${name}: offsets de coluna fora do lump`);

  const indices = new Uint8Array(width * height);
  const opacity = new Uint8Array(width * height);
  for (let x = 0; x < width; x++) {
    let p = view.getUint32(8 + x * 4, LE);
    // Cada post: topDelta, length, padding, length pixels, padding. 0xFF encerra a coluna.
    for (;;) {
      if (p >= bytes.length) throw new WadError(`patch ${name}: coluna ${x} sem terminador`);
      const topDelta = bytes[p];
      if (topDelta === 0xFF) break;
      const length = bytes[p + 1];
      if (p + 4 + length > bytes.length) throw new WadError(`patch ${name}: post fora do lump`);
      for (let i = 0; i < length; i++) {
        const y = topDelta + i;
        if (y >= height) continue;
        indices[y * width + x] = bytes[p + 3 + i];
        opacity[y * width + x] = 1;
      }
      p += length + 4;
    }
  }
  return { width, height, leftOffset, topOffset, indices, opacity };
}

// PNAMES: uint32 count + count nomes de 8 bytes.
function readPnames(wad) {
  const i = findLastLump(wad, 'PNAMES');
  if (i < 0) throw new WadError('PNAMES não encontrado');
  const view = wad.getLumpView(i);
  const count = view.getUint32(0, LE);
  if (4 + count * 8 > view.byteLength) throw new WadError('PNAMES truncado');
  const names = [];
  for (let k = 0; k < count; k++) names.push(readName(view, 4 + k * 8));
  return names;
}

// TEXTURE1/TEXTURE2: definições de texturas compostas por patches.
// Em nome repetido vale a primeira ocorrência (TEXTURE1 antes de TEXTURE2).
// Exportada na etapa 20: os interruptores conferem se a contraparte (SW1 <-> SW2) existe.
export function readTextureDefs(wad) {
  const defs = new Map();
  for (const lumpName of ['TEXTURE1', 'TEXTURE2']) {
    const li = findLastLump(wad, lumpName);
    if (li < 0) continue; // TEXTURE2 é opcional
    const view = wad.getLumpView(li);
    const num = view.getInt32(0, LE);
    for (let t = 0; t < num; t++) {
      const off = view.getInt32(4 + t * 4, LE);
      const name = readName(view, off);
      // off+8: masked (int32), +12 width, +14 height, +16 columnDirectory (int32), +20 patchCount
      const width = view.getInt16(off + 12, LE);
      const height = view.getInt16(off + 14, LE);
      const patchCount = view.getInt16(off + 20, LE);
      const patches = [];
      for (let k = 0; k < patchCount; k++) {
        const p = off + 22 + k * 10;
        patches.push({
          originX: view.getInt16(p, LE),
          originY: view.getInt16(p + 2, LE),
          patchIndex: view.getInt16(p + 4, LE),
          // stepDir (+6) e colorMap (+8) são ignorados
        });
      }
      if (!defs.has(name)) defs.set(name, { name, width, height, patches });
    }
  }
  return defs;
}

// Nomes usados pelo mapa: texturas das sidedefs (sem "-") e flats dos setores (sem F_SKY1).
export function usedTextureNames(map) {
  const walls = new Set();
  for (const s of map.sidedefs) {
    for (const t of [s.upperTexture, s.middleTexture, s.lowerTexture]) {
      if (hasTexture(t)) walls.add(t);
    }
  }
  const flats = new Set();
  for (const s of map.sectors) {
    for (const t of [s.floorTexture, s.ceilingTexture]) {
      if (t !== SKY) flats.add(t);
    }
  }
  return { walls, flats };
}

// Carrega paleta, flats e texturas de parede com os nomes pedidos.
export function loadTextures(wad, wallNames, flatNames) {
  const stats = {
    wallsRequested: wallNames.size,
    flatsRequested: flatNames.size,
    missingWalls: [],
    missingFlats: [],
    badPatchRefs: [],   // { texture, patchIndex, reason }
    transparent: [],    // { name, count }
  };

  const palette = readPalette(wad);

  // --- Flats ---
  const flats = new Map();
  for (const name of flatNames) {
    if (name === SKY) continue;
    // Exige 4096 bytes: ignora marcadores (tamanho 0) e lumps homônimos de outro tipo.
    const li = findLastLump(wad, name, (l) => l.size === FLAT_SIZE);
    if (li < 0) { stats.missingFlats.push(name); continue; }
    flats.set(name, wad.getLumpBytes(li).slice());
  }

  // --- Texturas de parede ---
  const pnames = readPnames(wad);
  const defs = readTextureDefs(wad);
  const patchCache = new Map(); // patchIndex -> imagem decodificada (ou null)

  const getPatch = (texName, patchIndex) => {
    if (patchCache.has(patchIndex)) return patchCache.get(patchIndex);
    let img = null;
    if (patchIndex < 0 || patchIndex >= pnames.length) {
      stats.badPatchRefs.push({ texture: texName, patchIndex, reason: 'patchIndex fora do PNAMES' });
      return null; // não guarda no cache para registrar cada textura afetada
    }
    const li = findLastLump(wad, pnames[patchIndex], (l) => l.size > 0);
    if (li < 0) {
      stats.badPatchRefs.push({ texture: texName, patchIndex, reason: `patch ${pnames[patchIndex]} não encontrado` });
    } else {
      img = decodePatch(wad.getLumpBytes(li), pnames[patchIndex]);
    }
    patchCache.set(patchIndex, img);
    return img;
  };

  const wallTextures = new Map();
  for (const name of wallNames) {
    const def = defs.get(name);
    if (!def) { stats.missingWalls.push(name); continue; }

    const { width, height } = def;
    const indices = new Uint8Array(width * height);
    const opacity = new Uint8Array(width * height);
    // Patches em ordem: os posteriores sobrescrevem, mas pixels transparentes nunca sobrescrevem.
    for (const ref of def.patches) {
      const patch = getPatch(name, ref.patchIndex);
      if (!patch) continue;
      for (let py = 0; py < patch.height; py++) {
        const y = ref.originY + py;
        if (y < 0 || y >= height) continue;
        for (let px = 0; px < patch.width; px++) {
          const x = ref.originX + px;
          if (x < 0 || x >= width) continue;
          const src = py * patch.width + px;
          if (!patch.opacity[src]) continue;
          indices[y * width + x] = patch.indices[src];
          opacity[y * width + x] = 1;
        }
      }
    }

    let holes = 0;
    for (const o of opacity) if (!o) holes++;
    if (holes) stats.transparent.push({ name, count: holes });

    wallTextures.set(name, { width, height, indices, opacity });
  }

  stats.wallsLoaded = wallTextures.size;
  stats.flatsLoaded = flats.size;
  return { palette, flats, wallTextures, stats };
}
