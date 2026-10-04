// Página de depuração: para cada tipo de objeto do mapa, as 8 vistas do primeiro quadro (já
// espelhadas quando é o caso), ampliadas 3x, com uma cruz na origem (leftOffset, topOffset).
// Usa a mesma montagem do jogo (buildSpriteScene), sem WebGPU.

import { WadFile } from '../src/wad/WadFile.js';
import { loadMap } from '../src/wad/MapData.js';
import { readPalette } from '../src/wad/Textures.js';
import { buildSpriteScene } from '../src/sprites/spriteLogic.js';
import { THING_TABLE, IGNORED_TYPES } from '../src/sprites/thingTable.js';

const WAD_URL = new URL('../assets/freedoom1.wad', import.meta.url);
const MAP_NAME = 'E1M1';
const SCALE = 3;
const CROSS = 4; // meia-largura da cruz, em pixels do sprite

function showError(text) {
  document.getElementById('msg').textContent = text;
  console.error(text);
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

// Desenha um patch (espelhado se preciso) com a cruz na origem.
function drawView(patch, mirrored, palette) {
  const canvas = document.createElement('canvas');
  canvas.width = patch.width * SCALE;
  canvas.height = patch.height * SCALE;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(patch.width, patch.height);
  for (let y = 0; y < patch.height; y++) {
    for (let x = 0; x < patch.width; x++) {
      const srcX = mirrored ? patch.width - 1 - x : x; // espelhado: colunas invertidas
      const s = y * patch.width + srcX;
      if (!patch.opacity[s]) continue;
      const c = patch.indices[s] * 3, o = (y * patch.width + x) * 4;
      img.data.set([palette[c], palette[c + 1], palette[c + 2], 255], o);
    }
  }
  // Escala inteira com pixels nítidos: desenha numa tela pequena e amplia.
  const small = document.createElement('canvas');
  small.width = patch.width;
  small.height = patch.height;
  small.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, canvas.width, canvas.height);

  // Cruz na origem (leftOffset, topOffset), em pixels do sprite. É o ponto que fica na base do objeto.
  const ox = (patch.leftOffset + 0.5) * SCALE, oy = (patch.topOffset + 0.5) * SCALE;
  ctx.strokeStyle = '#0f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ox - CROSS * SCALE, oy); ctx.lineTo(ox + CROSS * SCALE, oy);
  ctx.moveTo(ox, oy - CROSS * SCALE); ctx.lineTo(ox, oy + CROSS * SCALE);
  ctx.stroke();
  return canvas;
}

async function main() {
  const wad = await WadFile.fromUrl(WAD_URL);
  const map = loadMap(wad, MAP_NAME);
  const palette = readPalette(wad);
  const scene = buildSpriteScene(wad, map);
  const container = document.getElementById('types');

  const rows = [...scene.stats.histogram.values()]
    .filter((h) => !IGNORED_TYPES.has(h.type))
    .sort((a, b) => a.type - b.type);
  for (const h of rows) {
    const type = scene.types.get(h.type);
    const box = el('div', type ? 'type' : 'type unresolved');
    const entry = THING_TABLE[h.type];
    box.append(el('div', 'title', `tipo ${h.type}  prefixo ${h.prefix}  ${h.count} no mapa` +
      (type ? `  quadros "${type.frames}"${entry.fullbright ? '  fullbright' : ''}${entry.fuzz ? '  fuzz' : ''}`
        : entry ? '  NÃO RESOLVIDO (sem lumps)' : '  NÃO RESOLVIDO (fora da tabela)')));
    if (type) {
      const views = el('div', 'views');
      const letter = type.frames[0];
      type.frameDefs.get(letter).forEach((view, i) => {
        const layer = type.frameLayers.get(letter)[i].layer;
        const fig = el('figure');
        fig.append(drawView(scene.layers[layer].patch, view.mirrored, palette),
          el('figcaption', '', `vista ${i + 1}: ${view.lump}${view.mirrored ? ' (espelhada)' : ''}`));
        views.append(fig);
      });
      box.append(views);
    }
    container.append(box);
  }
  document.getElementById('title').textContent =
    `Sprites do ${MAP_NAME}: ${rows.length} tipos, ${scene.objects.length} objetos desenhados, ${scene.layers.length} camadas`;
}

main().catch((err) => showError(err.message));
