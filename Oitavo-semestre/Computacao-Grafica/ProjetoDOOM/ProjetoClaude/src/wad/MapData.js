// Leitura das tabelas de geometria de um mapa (ex.: E1M1).
// As coordenadas ficam no sistema original do Doom: x = leste, y = norte, alturas em unidades do Doom.

import { WadError, readName } from './WadFile.js';

const LE = true;
export const NO_SIDE = 0xFFFF;

// Ordem obrigatória dos lumps depois do marcador do mapa.
const MAP_LUMPS = [
  'THINGS', 'LINEDEFS', 'SIDEDEFS', 'VERTEXES', 'SEGS',
  'SSECTORS', 'NODES', 'SECTORS', 'REJECT', 'BLOCKMAP',
];

// Bits de LINEDEF.flags
export const ML_BLOCKING = 0x0001;
export const ML_TWOSIDED = 0x0004;
export const ML_DONTPEGTOP = 0x0008;    // upper unpegged
export const ML_DONTPEGBOTTOM = 0x0010; // lower unpegged

// Bit 15 do filho de um NODE: indica que o filho é um subsector.
export const NF_SUBSECTOR = 0x8000;

// Lê um lump como uma tabela de registros de tamanho fixo.
function parseTable(wad, lumpIndex, recordSize, readRecord) {
  const lump = wad.lumps[lumpIndex];
  if (lump.size % recordSize !== 0) {
    throw new WadError(`${lump.name}: tamanho ${lump.size} não é múltiplo de ${recordSize}`);
  }
  const view = wad.getLumpView(lumpIndex);
  const out = [];
  for (let p = 0; p < lump.size; p += recordSize) out.push(readRecord(view, p));
  return out;
}

// Nome de textura: "-" (ou vazio) significa sem textura.
function readTexture(view, offset) {
  return readName(view, offset, 8);
}

export function loadMap(wad, mapName) {
  const marker = wad.findLump(mapName);
  if (marker < 0) throw new WadError(`mapa ${mapName} não encontrado`);

  // Confere os nomes em vez de assumir posições.
  MAP_LUMPS.forEach((name, i) => {
    const lump = wad.lumps[marker + 1 + i];
    if (!lump || lump.name !== name) {
      throw new WadError(
        `${mapName}: esperado ${name} na posição ${i + 1} após o marcador, ` +
        `encontrado ${lump ? `"${lump.name}"` : 'fim do diretório'}`
      );
    }
  });
  const idx = (name) => marker + 1 + MAP_LUMPS.indexOf(name);

  const things = parseTable(wad, idx('THINGS'), 10, (v, p) => ({
    x: v.getInt16(p, LE),
    y: v.getInt16(p + 2, LE),
    angle: v.getInt16(p + 4, LE), // graus, 0 = leste, 90 = norte
    type: v.getInt16(p + 6, LE),
    flags: v.getInt16(p + 8, LE),
  }));

  const linedefs = parseTable(wad, idx('LINEDEFS'), 14, (v, p) => {
    const flags = v.getInt16(p + 4, LE);
    return {
      v1: v.getUint16(p, LE),
      v2: v.getUint16(p + 2, LE),
      flags,
      special: v.getInt16(p + 6, LE),
      tag: v.getInt16(p + 8, LE),
      rightSidedef: v.getUint16(p + 10, LE),
      leftSidedef: v.getUint16(p + 12, LE), // NO_SIDE (0xFFFF) = sem lado
      blocking: (flags & ML_BLOCKING) !== 0,
      twoSided: (flags & ML_TWOSIDED) !== 0,
      upperUnpegged: (flags & ML_DONTPEGTOP) !== 0,
      lowerUnpegged: (flags & ML_DONTPEGBOTTOM) !== 0,
    };
  });

  const sidedefs = parseTable(wad, idx('SIDEDEFS'), 30, (v, p) => ({
    xOffset: v.getInt16(p, LE),
    yOffset: v.getInt16(p + 2, LE),
    upperTexture: readTexture(v, p + 4),
    lowerTexture: readTexture(v, p + 12),
    middleTexture: readTexture(v, p + 20),
    sector: v.getUint16(p + 28, LE),
  }));

  const vertexes = parseTable(wad, idx('VERTEXES'), 4, (v, p) => ({
    x: v.getInt16(p, LE),
    y: v.getInt16(p + 2, LE),
  }));

  const segs = parseTable(wad, idx('SEGS'), 12, (v, p) => ({
    v1: v.getUint16(p, LE),
    v2: v.getUint16(p + 2, LE),
    angle: v.getInt16(p + 4, LE), // ângulo binário (BAM): 0x4000 = 90°
    linedef: v.getUint16(p + 6, LE),
    direction: v.getInt16(p + 8, LE), // 0 = mesmo sentido da linedef, 1 = oposto
    offset: v.getInt16(p + 10, LE),
  }));

  const ssectors = parseTable(wad, idx('SSECTORS'), 4, (v, p) => ({
    segCount: v.getUint16(p, LE),
    firstSeg: v.getUint16(p + 2, LE),
  }));

  const readBox = (v, p) => ({
    top: v.getInt16(p, LE),
    bottom: v.getInt16(p + 2, LE),
    left: v.getInt16(p + 4, LE),
    right: v.getInt16(p + 6, LE),
  });
  const nodes = parseTable(wad, idx('NODES'), 28, (v, p) => ({
    x: v.getInt16(p, LE),
    y: v.getInt16(p + 2, LE),
    dx: v.getInt16(p + 4, LE),
    dy: v.getInt16(p + 6, LE),
    rightBox: readBox(v, p + 8),
    leftBox: readBox(v, p + 16),
    rightChild: v.getUint16(p + 24, LE), // bit 15 ligado = subsector
    leftChild: v.getUint16(p + 26, LE),
  }));

  const sectors = parseTable(wad, idx('SECTORS'), 26, (v, p) => ({
    floorHeight: v.getInt16(p, LE),
    ceilingHeight: v.getInt16(p + 2, LE),
    floorTexture: readTexture(v, p + 4),
    ceilingTexture: readTexture(v, p + 12),
    lightLevel: v.getInt16(p + 20, LE),
    special: v.getInt16(p + 22, LE),
    tag: v.getInt16(p + 24, LE),
  }));

  const map = { name: mapName.toUpperCase(), things, linedefs, sidedefs, vertexes, segs, ssectors, nodes, sectors };
  validateMap(map);
  return map;
}

// Confere todas as referências entre tabelas depois que tudo foi lido.
function validateMap(map) {
  const { linedefs, sidedefs, vertexes, segs, ssectors, nodes, sectors } = map;
  const check = (ok, msg) => { if (!ok) throw new WadError(`${map.name}: ${msg}`); };
  const inRange = (i, arr) => i >= 0 && i < arr.length;

  linedefs.forEach((l, i) => {
    check(inRange(l.v1, vertexes) && inRange(l.v2, vertexes),
      `linedef ${i} referencia vértice inválido (${l.v1}, ${l.v2})`);
    check(inRange(l.rightSidedef, sidedefs),
      `linedef ${i} tem sidedef direito inválido (${l.rightSidedef})`);
    check(l.leftSidedef === NO_SIDE || inRange(l.leftSidedef, sidedefs),
      `linedef ${i} tem sidedef esquerdo inválido (${l.leftSidedef})`);
  });

  sidedefs.forEach((s, i) => {
    check(inRange(s.sector, sectors), `sidedef ${i} referencia setor inválido (${s.sector})`);
  });

  segs.forEach((s, i) => {
    check(inRange(s.v1, vertexes) && inRange(s.v2, vertexes),
      `seg ${i} referencia vértice inválido (${s.v1}, ${s.v2})`);
    check(inRange(s.linedef, linedefs), `seg ${i} referencia linedef inválida (${s.linedef})`);
  });

  ssectors.forEach((ss, i) => {
    check(ss.segCount > 0 && ss.firstSeg + ss.segCount <= segs.length,
      `subsector ${i} referencia segs fora do intervalo (${ss.firstSeg} + ${ss.segCount})`);
  });

  nodes.forEach((n, i) => {
    for (const child of [n.rightChild, n.leftChild]) {
      if (child & NF_SUBSECTOR) {
        check(inRange(child & 0x7FFF, ssectors), `node ${i} referencia subsector inválido (${child & 0x7FFF})`);
      } else {
        check(inRange(child, nodes), `node ${i} referencia node inválido (${child})`);
      }
    }
  });
}
