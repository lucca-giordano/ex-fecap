// Página de depuração: compõe cada tela do menu com a MESMA composeMenu do jogo e desenha em
// Canvas 2D, ampliada 3x. Transparência do menu aparece como xadrez.

import { WadFile } from '../src/wad/WadFile.js';
import { loadMenuAssets } from '../src/menu/MenuAssets.js';
import { composeMenu, MENU_WIDTH, MENU_HEIGHT } from '../src/menu/MenuRenderer.js';

const WAD_URL = new URL('../assets/freedoom1.wad', import.meta.url);
const SCALE = 3;

function showError(text) {
  document.getElementById('msg').textContent = text;
  console.error(text);
}

const values = (level) => ({
  visualMode: 'retro', crt: true, lighting: true, fullscreen: false,
  mouseSensitivityLevel: level, flySpeedLevel: level,
  textured: true, sectorColors: false, culling: true, skyTest: false, hud: true,
  particles: true, sprites: true, moveMode: 'walk', sfxVolumeLevel: Math.min(15, level),
});

const SCREENS = [
  ['Título + menu principal', { screen: 'main', selected: 0, started: false, resumeFailed: false, values: values(5) }],
  ['Menu principal sobre o jogo (resume falhou)', { screen: 'main', selected: 1, started: true, resumeFailed: true, values: values(5) }],
  ['Opções', { screen: 'options', selected: 0, started: true, resumeFailed: false, values: values(5) }],
  ['Opções, termômetros em 1', { screen: 'options', selected: 4, started: true, resumeFailed: false, values: values(1) }],
  ['Opções, termômetros em 10', { screen: 'options', selected: 5, started: true, resumeFailed: false, values: values(10) }],
  ['Extras', { screen: 'extras', selected: 0, started: true, resumeFailed: false, values: values(5) }],
  ['Debug', { screen: 'debug', selected: 2, started: true, resumeFailed: false, values: values(5) }],
  ['Game debug', { screen: 'gameDebug', selected: 6, started: true, resumeFailed: false, values: values(5) }],
  ['READ THIS!', { screen: 'help', selected: 0, started: true, resumeFailed: false, values: values(5) }],
];

function render(assets) {
  const skull = Number(document.querySelector('input[name=skull]:checked').value);
  const lang = document.querySelector('input[name=lang]:checked').value;
  // Tempo que dá o quadro escolhido da caveira: quadro 1 a partir de 8 tics (8/35 s).
  const time = skull ? 8 / 35 : 0;
  const container = document.getElementById('screens');
  container.replaceChildren();
  for (const [name, state] of SCREENS) {
    const canvas = document.createElement('canvas');
    canvas.width = MENU_WIDTH;
    canvas.height = MENU_HEIGHT;
    canvas.style.width = `${MENU_WIDTH * SCALE}px`;
    canvas.style.height = `${MENU_HEIGHT * SCALE}px`;
    const rgba = composeMenu({ ...state, lang }, assets, time);
    canvas.getContext('2d').putImageData(new ImageData(rgba, MENU_WIDTH, MENU_HEIGHT), 0, 0);
    const fig = document.createElement('figure');
    const cap = document.createElement('figcaption');
    cap.textContent = name;
    fig.append(canvas, cap);
    container.append(fig);
  }
}

async function main() {
  const wad = await WadFile.fromUrl(WAD_URL);
  const assets = loadMenuAssets(wad);
  console.log(`Menu: ${assets.found.length} lumps encontrados; ausentes: ${assets.missing.join(', ') || 'nenhum'}`);
  render(assets);
  for (const input of document.querySelectorAll('input')) input.addEventListener('change', () => render(assets));
}

main().catch((err) => showError(err.message));
