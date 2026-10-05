// COLORMAP, paleta iluminada e nome do céu. Funções puras (sem WebGPU).

import { WadError } from './WadFile.js';
import { findLastLump } from './Textures.js';

const TABLE_SIZE = 256;
export const LIGHT_LEVELS = 32; // tabelas 0 (mais clara, identidade) a 31 (mais escura)

// COLORMAP: 34 tabelas de 256 bytes. Cada tabela leva um índice da paleta ao índice da
// cor equivalente mais escura. As tabelas 32 (invulnerabilidade) e 33 não são usadas.
export function loadColormap(wad) {
  const i = findLastLump(wad, 'COLORMAP');
  if (i < 0) throw new WadError('COLORMAP não encontrado');
  const bytes = wad.getLumpBytes(i);
  if (bytes.length < LIGHT_LEVELS * TABLE_SIZE) {
    throw new WadError(`COLORMAP com ${bytes.length} bytes (mínimo ${LIGHT_LEVELS * TABLE_SIZE})`);
  }
  return { data: bytes.slice(), size: bytes.length, tables: Math.floor(bytes.length / TABLE_SIZE) };
}

// Imagem 256 x 32 RGBA: pixel (i, n) = cor da paleta para colormap[n][i].
// A linha 0 é igual à paleta original (a tabela 0 é a identidade).
export function buildLitPalette(palette, colormap) {
  const out = new Uint8Array(TABLE_SIZE * LIGHT_LEVELS * 4);
  for (let n = 0; n < LIGHT_LEVELS; n++) {
    for (let i = 0; i < TABLE_SIZE; i++) {
      const c = colormap.data[n * TABLE_SIZE + i] * 3;
      const o = (n * TABLE_SIZE + i) * 4;
      out[o] = palette[c];
      out[o + 1] = palette[c + 1];
      out[o + 2] = palette[c + 2];
      out[o + 3] = 255;
    }
  }
  return out;
}

// ExMy -> SKYx (episódio limitado a 1..3). MAPxx -> SKY1 (01-11), SKY2 (12-20), SKY3 (21-32).
// exists(nome) (etapa 23, opcional): confere se a textura existe; ExMy usa SKY1 a SKY4 conforme o
// episódio e recua para o maior céu existente (sem exists, o comportamento antigo: até SKY3).
export function skyNameForMap(mapName, exists = null) {
  const name = mapName.toUpperCase();
  let m = /^E(\d)M\d+$/.exec(name);
  if (m && exists) {
    for (let n = Math.min(4, Math.max(1, Number(m[1]))); n > 1; n--) if (exists(`SKY${n}`)) return `SKY${n}`;
    return 'SKY1';
  }
  if (m) return `SKY${Math.min(3, Math.max(1, Number(m[1])))}`;
  m = /^MAP(\d+)$/.exec(name);
  if (m) {
    const n = Number(m[1]);
    return n <= 11 ? 'SKY1' : n <= 20 ? 'SKY2' : 'SKY3';
  }
  return 'SKY1';
}
