// Gráficos da barra de status, do rosto e da pistola. Puro: sem DOM e sem WebGPU.

import { decodePatch, findLastLump, readPalette } from '../wad/Textures.js';
import { findSpriteLumps, decodeSprite } from '../wad/Sprites.js';
import { loadColormap, buildLitPalette } from '../wad/Colormap.js';
import { FONT_FIRST, FONT_COUNT } from '../menu/MenuAssets.js';
import { USABLE_SLOTS, weaponLumps, availableSlots } from '../game/weapons.js';

const range = (prefix, from, to) => Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${from + i}`);

export const REQUIRED_PATCHES = ['STBAR', ...range('STTNUM', 0, 9)];
export const OPTIONAL_PATCHES = [
  'STARMS', 'STTMINUS', 'STTPRCNT', ...range('STYSNUM', 0, 9), ...range('STGNUM', 2, 7), ...range('STKEYS', 0, 5),
  ...[0, 1, 2, 3, 4].flatMap((pain) => [0, 1, 2].map((look) => `STFST${pain}${look}`)), 'STFDEAD0',
];
export const REQUIRED_SPRITES = ['PISGA0', 'PISGB0', 'PISGC0', 'PISFA0'];
// Etapa 17: lumps das armas utilizáveis (soco, espingarda e metralhadora); se faltarem, só aquela arma
// fica indisponível.
export const OPTIONAL_SPRITES = [...new Set(['PISGD0', ...USABLE_SLOTS.flatMap(weaponLumps)])]
  .filter((n) => !REQUIRED_SPRITES.includes(n));

// Devolve { ok, patches, sprites, pistolFrames, weaponSlots, palette, litPalette, font, missing, fatal }.
// weaponSlots (etapa 17): slots utilizáveis com todos os lumps.
// font (etapa 16): glifos STCFN033..095 para a mensagem de coleta; ausentes só entram em missing.
// ok = false se faltar algo obrigatório (STBAR, STTNUM0..9 ou os sprites da pistola).
export function loadHudAssets(wad) {
  const patches = {};
  const missing = [];
  for (const name of [...REQUIRED_PATCHES, ...OPTIONAL_PATCHES]) {
    const i = findLastLump(wad, name, (l) => l.size > 0);
    if (i < 0) { missing.push(name); continue; }
    patches[name] = decodePatch(wad.getLumpBytes(i), name);
  }
  const { lumps } = findSpriteLumps(wad);
  const sprites = {};
  for (const name of [...REQUIRED_SPRITES, ...OPTIONAL_SPRITES]) {
    if (!lumps.has(name)) { missing.push(name); continue; }
    sprites[name] = decodeSprite(wad, lumps, name);
  }
  const fatal = [...REQUIRED_PATCHES, ...REQUIRED_SPRITES].filter((n) => missing.includes(n));
  // Letras de PISG disponíveis (a máquina de estados remove quadros ausentes).
  const pistolFrames = ['A', 'B', 'C', 'D'].filter((f) => sprites[`PISG${f}0`]).join('');
  const font = [];
  for (let c = 0; c < FONT_COUNT; c++) {
    const name = `STCFN${String(FONT_FIRST + c).padStart(3, '0')}`;
    const i = findLastLump(wad, name, (l) => l.size > 0);
    if (i < 0) missing.push(name);
    font.push(i < 0 ? null : decodePatch(wad.getLumpBytes(i), name));
  }
  const palette = readPalette(wad);
  const litPalette = buildLitPalette(palette, loadColormap(wad));
  return { ok: fatal.length === 0, patches, sprites, pistolFrames, weaponSlots: availableSlots((n) => Boolean(sprites[n])),
    palette, litPalette, font, missing, fatal };
}
