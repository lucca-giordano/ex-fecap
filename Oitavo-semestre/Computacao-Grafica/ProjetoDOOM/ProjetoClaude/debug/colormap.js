// Página de depuração: desenha a paleta iluminada (256 colunas x 32 níveis) em Canvas 2D,
// com o mesmo código do jogo. Coluna = índice da paleta, linha = nível do COLORMAP.

import { WadFile } from '../src/wad/WadFile.js';
import { readPalette } from '../src/wad/Textures.js';
import { loadColormap, buildLitPalette, LIGHT_LEVELS } from '../src/wad/Colormap.js';

const WAD_URL = new URL('../assets/freedoom1.wad', import.meta.url);
const CELL_W = 4;
const CELL_H = 8;
const LABEL_W = 40;
const LABELED = [0, 8, 16, 24, 31];

function showError(text) {
  document.getElementById('msg').textContent = text;
  console.error(text);
}

async function main() {
  const wad = await WadFile.fromUrl(WAD_URL);
  const palette = readPalette(wad);
  const colormap = loadColormap(wad);
  const lit = buildLitPalette(palette, colormap);
  console.log(`COLORMAP: ${colormap.size} bytes, ${colormap.tables} tabelas`);

  const canvas = document.getElementById('cm');
  canvas.width = LABEL_W + 256 * CELL_W;
  canvas.height = LIGHT_LEVELS * CELL_H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#222';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let n = 0; n < LIGHT_LEVELS; n++) {
    for (let i = 0; i < 256; i++) {
      const o = (n * 256 + i) * 4;
      ctx.fillStyle = `rgb(${lit[o]}, ${lit[o + 1]}, ${lit[o + 2]})`;
      ctx.fillRect(LABEL_W + i * CELL_W, n * CELL_H, CELL_W, CELL_H);
    }
  }

  ctx.fillStyle = '#ddd';
  ctx.font = '10px monospace';
  ctx.textBaseline = 'middle';
  for (const n of LABELED) ctx.fillText(String(n), 4, n * CELL_H + CELL_H / 2);

  document.getElementById('title').textContent =
    `Paleta iluminada (COLORMAP): 256 índices x ${LIGHT_LEVELS} níveis (0 = claro, 31 = escuro)`;
}

main().catch((err) => showError(err.message));
