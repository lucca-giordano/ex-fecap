// Sprites do WAD: interpretação dos nomes, localização dos lumps e montagem de quadros e vistas.
// Puro: sem DOM e sem WebGPU. As imagens usam o decodificador de patches da etapa 5.
//
// Nome: 4 caracteres de prefixo + letra do quadro + dígito da vista, e opcionalmente uma segunda
// letra e um segundo dígito: TROOA1, TROOA0 (vista única), TROOA2A8 (vista 2 normal e vista 8 com o
// mesmo lump espelhado). Vistas 1 a 8 (1 = de frente para o jogador, 5 = de costas); 0 = única.

import { decodePatch } from './Textures.js';

const NAME_RE = /^([A-Z0-9_\-[\]\\]{4})([A-Z[\]\\])([0-8])(?:([A-Z[\]\\])([0-8]))?$/;

// Devolve { prefix, entries: [{ frame, rot, mirrored }] } ou null se o nome não é de sprite.
export function parseSpriteName(name) {
  const m = NAME_RE.exec(name);
  if (!m) return null;
  const entries = [{ frame: m[2], rot: Number(m[3]), mirrored: false }];
  if (m[4]) {
    // Vista única (0) não pode ter par espelhado.
    if (m[3] === '0' || m[5] === '0') return null;
    entries.push({ frame: m[4], rot: Number(m[5]), mirrored: true });
  }
  return { prefix: m[1], entries };
}

// Lumps de sprite: nome -> índice no diretório (última ocorrência vale).
// Entre S_START e S_END; senão SS_START e SS_END; senão todos os lumps com nome de sprite e mais de 8 bytes.
export function findSpriteLumps(wad) {
  const result = new Map();
  for (const [start, end] of [['S_START', 'S_END'], ['SS_START', 'SS_END']]) {
    const s = wad.findLump(start);
    const e = s >= 0 ? wad.findLump(end, s + 1) : -1;
    if (s < 0 || e < 0) continue;
    for (let i = s + 1; i < e; i++) {
      const lump = wad.lumps[i];
      if (lump.size > 0 && parseSpriteName(lump.name)) result.set(lump.name, i);
    }
    return { lumps: result, source: `${start}..${end}` };
  }
  wad.lumps.forEach((lump, i) => {
    if (lump.size > 8 && parseSpriteName(lump.name)) result.set(lump.name, i);
  });
  return { lumps: result, source: 'diretório inteiro' };
}

// Quadros de um prefixo: letra -> views[0..7] (vista 1 a 8), cada uma { lump, mirrored } ou null.
// Vista única (rot 0) preenche as 8 com o mesmo lump. Quadros sem as 8 vistas ficam incompletos (null).
export function buildFrames(prefix, spriteLumps) {
  const frames = new Map();
  for (const name of spriteLumps.keys()) {
    if (!name.startsWith(prefix)) continue;
    const parsed = parseSpriteName(name);
    if (!parsed || parsed.prefix !== prefix) continue;
    for (const { frame, rot, mirrored } of parsed.entries) {
      if (!frames.has(frame)) frames.set(frame, new Array(8).fill(null));
      const views = frames.get(frame);
      if (rot === 0) views.fill({ lump: name, mirrored: false });
      else views[rot - 1] = { lump: name, mirrored };
    }
  }
  return frames;
}

// Um quadro é utilizável se todas as 8 vistas existem.
export const frameComplete = (views) => Boolean(views) && views.every(Boolean);

// Resolve um tipo da tabela: remove da sequência as letras sem quadro completo.
// Devolve { frames: 'AB', frameDefs: Map letra -> views } ou null (não resolvido).
export function resolveThingType(entry, spriteLumps) {
  const all = buildFrames(entry.prefix, spriteLumps);
  const letters = [...entry.frames].filter((f) => frameComplete(all.get(f)));
  if (letters.length === 0) return null;
  const frameDefs = new Map(letters.map((f) => [f, all.get(f)]));
  return { frames: letters.join(''), frameDefs };
}

// Decodifica um lump de sprite (formato "picture", com leftOffset e topOffset).
export function decodeSprite(wad, spriteLumps, name) {
  return decodePatch(wad.getLumpBytes(spriteLumps.get(name)), name);
}
