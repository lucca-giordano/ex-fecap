// Página de depuração: desenha em Canvas 2D todas as texturas de parede e flats usados pelo mapa,
// com o mesmo decodificador do jogo. Pixels transparentes aparecem em magenta.

import { WadFile } from '../src/wad/WadFile.js';
import { loadMap } from '../src/wad/MapData.js';
import { loadTextures, usedTextureNames } from '../src/wad/Textures.js';

const WAD_URL = new URL('../assets/freedoom1.wad', import.meta.url);
const MAP_NAME = 'E1M1';
const SCALE = 2; // aumenta os pixels para enxergar os detalhes

function showError(text) {
  document.getElementById('msg').textContent = text;
  console.error(text);
}

// indices/opacity: 1 byte por pixel; opacity null = tudo opaco (flats).
function drawImage(container, name, width, height, indices, opacity, palette) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${width * SCALE}px`;
  canvas.style.height = `${height * SCALE}px`;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(width, height);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    if (opacity && !opacity[i]) {
      img.data.set([255, 0, 255, 255], o);
    } else {
      const c = indices[i] * 3;
      img.data.set([palette[c], palette[c + 1], palette[c + 2], 255], o);
    }
  }
  ctx.putImageData(img, 0, 0);

  const fig = document.createElement('figure');
  const cap = document.createElement('figcaption');
  cap.textContent = `${name} ${width}x${height}`;
  fig.append(canvas, cap);
  container.append(fig);
}

async function main() {
  const wad = await WadFile.fromUrl(WAD_URL);
  const map = loadMap(wad, MAP_NAME);
  const used = usedTextureNames(map);
  const { palette, flats, wallTextures, stats } = loadTextures(wad, used.walls, used.flats);
  console.log('Estatísticas das texturas', stats);

  const byName = (a, b) => a[0].localeCompare(b[0]);
  const wallsEl = document.getElementById('walls');
  for (const [name, t] of [...wallTextures].sort(byName)) {
    drawImage(wallsEl, name, t.width, t.height, t.indices, t.opacity, palette);
  }
  const flatsEl = document.getElementById('flats');
  for (const [name, pixels] of [...flats].sort(byName)) {
    drawImage(flatsEl, name, 64, 64, pixels, null, palette);
  }

  document.getElementById('wallsTitle').textContent =
    `Texturas de parede (${wallTextures.size}) — ${MAP_NAME}`;
  document.getElementById('flatsTitle').textContent = `Flats (${flats.size})`;
  const missing = [...stats.missingWalls, ...stats.missingFlats];
  if (missing.length) showError(`Não encontrados: ${missing.join(', ')}`);
}

main().catch((err) => showError(err.message));
