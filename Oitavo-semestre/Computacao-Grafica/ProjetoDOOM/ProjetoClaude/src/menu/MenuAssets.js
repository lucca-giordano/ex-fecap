// Carrega os gráficos do menu (lumps no formato "picture" do Doom). Puro: sem DOM e sem WebGPU.

import { decodePatch, findLastLump, readPalette } from '../wad/Textures.js';

export const MENU_PATCHES = [
  'M_DOOM', 'M_OPTTTL', 'M_NEWG', 'M_OPTION', 'M_RDTHIS',
  'M_SKULL1', 'M_SKULL2', 'M_THERML', 'M_THERMM', 'M_THERMR', 'M_THERMO', 'TITLEPIC',
];
export const FONT_FIRST = 33; // '!'
export const FONT_COUNT = 63; // até '_' (STCFN095)

function loadPatch(wad, name) {
  const i = findLastLump(wad, name, (l) => l.size > 0); // última ocorrência, ignorando marcadores
  return i < 0 ? null : decodePatch(wad.getLumpBytes(i), name);
}

// Devolve { palette, patches: {nome: patch|null}, font: [63 patches|null], found, missing }.
// Sem nenhum glifo da fonte é erro fatal (todo o texto do menu depende dela).
export function loadMenuAssets(wad) {
  const patches = {};
  const found = [];
  const missing = [];
  for (const name of MENU_PATCHES) {
    patches[name] = loadPatch(wad, name);
    (patches[name] ? found : missing).push(name);
  }

  const font = [];
  for (let c = 0; c < FONT_COUNT; c++) {
    const name = `STCFN${String(FONT_FIRST + c).padStart(3, '0')}`;
    const glyph = loadPatch(wad, name);
    font.push(glyph);
    (glyph ? found : missing).push(name);
  }
  if (font.every((g) => !g)) {
    throw new Error('Menu: fonte STCFN033..STCFN095 não encontrada no WAD');
  }

  return { palette: readPalette(wad), patches, font, found, missing };
}
