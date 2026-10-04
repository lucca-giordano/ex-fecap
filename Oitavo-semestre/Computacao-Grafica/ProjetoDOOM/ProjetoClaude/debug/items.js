// Página de depuração da etapa 16: sprite (quadro A, vista 1, ampliado 3x) de cada tipo de item e de
// cada decoração sólida, com regra, contagem no E1M1 e totais. Tipos sem sprite no WAD em vermelho.
// Usa as MESMAS tabelas do jogo (itemTable.js, solids.js, thingTable.js) e o mesmo ItemSystem.

import { WadFile } from '../src/wad/WadFile.js';
import { loadMap } from '../src/wad/MapData.js';
import { readPalette } from '../src/wad/Textures.js';
import { findSpriteLumps, resolveThingType, decodeSprite } from '../src/wad/Sprites.js';
import { findSector } from '../src/map/bsp.js';
import { buildSpriteScene } from '../src/sprites/spriteLogic.js';
import { THING_TABLE } from '../src/sprites/thingTable.js';
import { ITEM_TABLE } from '../src/game/itemTable.js';
import { ITEM_TEXT } from '../src/game/itemText.js';
import { ItemSystem } from '../src/game/ItemSystem.js';
import { SOLID_DECORATION, staticSolids } from '../src/physics/solids.js';
import { PLAYER_RADIUS } from '../src/physics/collision.js';
import { MENU_LANG } from '../src/menu/menuText.js';

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

// Patch indexado -> canvas ampliado sem suavização (transparente onde opacity = 0).
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

// Descrição curta da regra de coleta.
function ruleText(def) {
  const p = def.params;
  switch (def.kind) {
    case 'health': return `vida +${p.amount} até ${p.limit}` + (p.needBelow ? ` (só abaixo de ${p.needBelow})` : '');
    case 'megasphere': return 'vida 200, armadura 200 azul';
    case 'armorBonus': return `armadura +${p.amount} até ${p.limit}`;
    case 'armor': return `armadura ${p.armor}, tipo ${p.type}`;
    case 'ammo': return `${p.clips} clip(s) de ${p.ammo}`;
    case 'backpack': return 'dobra máximos, 1 clip de cada';
    case 'weapon': return p.chainsaw ? 'motosserra (slot 1)' : `arma slot ${p.slot}, munição ${p.ammo}`;
    case 'key': return `chave ${p.key}`;
    default: return def.kind;
  }
}

async function main() {
  const wad = await WadFile.fromUrl(WAD_URL);
  const map = loadMap(wad, MAP_NAME);
  const palette = readPalette(wad);
  const { lumps } = findSpriteLumps(wad);
  const scene = buildSpriteScene(wad, map);
  const typeOf = (obj) => map.things[obj.index].type;
  const inMap = new Map();
  for (const obj of scene.objects) inMap.set(typeOf(obj), (inMap.get(typeOf(obj)) ?? 0) + 1);

  // Cartão de um tipo: sprite ou caixa vermelha (sem sprite no WAD), com legenda.
  const card = (type, caption) => {
    const entry = THING_TABLE[type];
    const r = entry ? resolveThingType(entry, lumps) : null;
    if (!r) return el('div', 'missing', `${type} ${entry?.prefix ?? '?'}: SEM SPRITE\n${caption}`);
    const views = r.frameDefs.get(r.frames[0]);
    const fig = el('figure');
    fig.append(drawPatch(decodeSprite(wad, lumps, views[0].lump), palette), el('figcaption', '', `${type} ${entry.prefix}: ${caption}`));
    return fig;
  };

  const items = document.getElementById('items');
  for (const [type, def] of Object.entries(ITEM_TABLE).map(([t, d]) => [Number(t), d])) {
    const msg = ITEM_TEXT[MENU_LANG][def.messageKey];
    items.append(card(type, `${ruleText(def)}${def.counts ? ', conta' : ''}; "${msg}"; ${inMap.get(type) ?? 0} no mapa`));
  }
  const solidsBox = document.getElementById('solids');
  for (const [type, radius] of Object.entries(SOLID_DECORATION).map(([t, r]) => [Number(t), r])) {
    solidsBox.append(card(type, `raio ${radius}; ${inMap.get(type) ?? 0} no mapa`));
  }

  // Totais com o mesmo ItemSystem e os mesmos sólidos do jogo.
  const system = new ItemSystem(scene.objects, typeOf, (x, y) => map.sectors[findSector(map, x, y)]?.floorHeight ?? 0, PLAYER_RADIUS);
  const fixed = staticSolids(scene.objects, typeOf);
  const unresolved = [...new Set([...Object.keys(ITEM_TABLE), ...Object.keys(SOLID_DECORATION)])]
    .filter((t) => !THING_TABLE[t] || !resolveThingType(THING_TABLE[t], lumps));
  const rows = [
    ['itens no mapa', system.items.length],
    ['itens contáveis', system.totalCountable],
    ['sólidos fixos', fixed.length],
    ['tipos sem sprite', unresolved.join(', ') || 'nenhum'],
  ];
  const table = document.getElementById('totals');
  for (const [name, value] of rows) {
    const tr = el('tr');
    tr.append(el('th', '', name), el('td', '', String(value)));
    table.append(tr);
  }
}

main().catch((err) => showError(err.message));
