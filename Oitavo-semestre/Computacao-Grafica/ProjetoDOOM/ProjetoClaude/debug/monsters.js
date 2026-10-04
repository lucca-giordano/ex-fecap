// Página de depuração do combate: para cada tipo atirável do mapa, os quadros de parado, dor, morte e
// morte esfacelada (letra e duração) e os efeitos PUFF, BLUD e BEXP, ampliados 3x, em Canvas 2D.
// Usa a MESMA tabela (monsterTable.js) e a MESMA montagem de camadas (buildSpriteScene) do jogo.

import { WadFile } from '../src/wad/WadFile.js';
import { loadMap } from '../src/wad/MapData.js';
import { readPalette } from '../src/wad/Textures.js';
import { findSpriteLumps, buildFrames, frameComplete, decodeSprite } from '../src/wad/Sprites.js';
import { buildSpriteScene } from '../src/sprites/spriteLogic.js';
import { MONSTER_TABLE, PUFF_FRAMES, BLOOD_FRAMES, resolveMonsterTable, extraSpriteFrames } from '../src/game/monsterTable.js';

const WAD_URL = new URL('../assets/freedoom1.wad', import.meta.url);
const MAP_NAME = 'E1M1';
const SCALE = 3;

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

function drawPatch(patch, palette) {
  const small = document.createElement('canvas');
  small.width = patch.width;
  small.height = patch.height;
  const ctx = small.getContext('2d');
  const img = ctx.createImageData(patch.width, patch.height);
  for (let i = 0; i < patch.width * patch.height; i++) {
    if (!patch.opacity[i]) continue;
    const c = patch.indices[i] * 3;
    img.data.set([palette[c], palette[c + 1], palette[c + 2], 255], i * 4);
  }
  ctx.putImageData(img, 0, 0);
  const big = document.createElement('canvas');
  big.width = patch.width * SCALE;
  big.height = patch.height * SCALE;
  const bctx = big.getContext('2d');
  bctx.imageSmoothingEnabled = false;
  bctx.drawImage(small, 0, 0, big.width, big.height);
  return big;
}

async function main() {
  const wad = await WadFile.fromUrl(WAD_URL);
  const map = loadMap(wad, MAP_NAME);
  const palette = readPalette(wad);
  const { lumps } = findSpriteLumps(wad);
  const framesCache = new Map();
  const framesOf = (prefix) => {
    if (!framesCache.has(prefix)) framesCache.set(prefix, buildFrames(prefix, lumps));
    return framesCache.get(prefix);
  };

  // Uma fileira por estado: quadro (vista 1) com letra e duração; ausentes em vermelho.
  const row = (title, prefix, seq) => {
    const box = el('div', 'state');
    box.append(el('div', '', `${title} (${prefix})`));
    const frames = el('div', 'frames');
    for (const [letter, tics] of seq) {
      const views = framesOf(prefix).get(letter);
      const caption = `${prefix}${letter} ${tics === -1 ? 'permanece' : `${tics} tics`}`;
      if (!frameComplete(views)) {
        frames.append(el('div', 'missing', `${caption}: AUSENTE`));
        continue;
      }
      const fig = el('figure');
      fig.append(drawPatch(decodeSprite(wad, lumps, views[0].lump), palette), el('figcaption', '', caption));
      frames.append(fig);
    }
    box.append(frames);
    return box;
  };

  const container = document.getElementById('types');
  const present = new Set(map.things.map((t) => t.type));
  const counts = new Map();
  for (const t of map.things) counts.set(t.type, (counts.get(t.type) ?? 0) + 1);
  for (const type of [...present].filter((t) => MONSTER_TABLE[t]).sort((a, b) => a - b)) {
    const e = MONSTER_TABLE[type];
    const box = el('div', 'type');
    box.append(el('b', '', `tipo ${type} (${e.prefix}): vida ${e.health}, raio ${e.radius}, altura ${e.height}, ` +
      `dor ${e.painChance}/256; ${counts.get(type)} no mapa (antes do filtro de dificuldade)`));
    box.append(row('parado', e.prefix, e.idle));
    if (e.pain) box.append(row('dor', e.prefix, e.pain));
    box.append(row('morte', e.deathPrefix ?? e.prefix, e.death));
    if (e.xdeath) box.append(row('morte esfacelada', e.prefix, e.xdeath));
    container.append(box);
  }
  const fx = el('div', 'type');
  fx.append(el('b', '', 'efeitos'));
  fx.append(row('fumaça', 'PUFF', PUFF_FRAMES), row('sangue', 'BLUD', BLOOD_FRAMES), row('explosão', 'BEXP', MONSTER_TABLE[2035].death));
  container.append(fx);

  // Total de camadas, com a mesma montagem do jogo.
  const table = resolveMonsterTable(lumps, present);
  const scene = buildSpriteScene(wad, map, { extraFrames: extraSpriteFrames(table.entries) });
  document.getElementById('summary').textContent =
    `Camadas necessárias: ${scene.layers.length}; quadros removidos da tabela: ${table.removed.join(', ') || 'nenhum'}; ` +
    `extras ausentes: ${scene.stats.missingExtra.join(', ') || 'nenhum'}`;
}

main().catch((err) => showError(err.message));
