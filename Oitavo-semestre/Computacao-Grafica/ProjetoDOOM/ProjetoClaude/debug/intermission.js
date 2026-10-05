// Página de depuração da intermissão e do fim de episódio (etapa 23): as mesmas classes e funções de
// desenho do jogo, em Canvas 2D (sem WebGPU), ampliadas 2x.

import { WadFile } from '../src/wad/WadFile.js';
import { Intermission } from '../src/game/Intermission.js';
import { loadIntermissionAssets, composeIntermission } from '../src/hud/IntermissionRenderer.js';
import { Finale, composeFinale, loadFinaleFlat } from '../src/game/Finale.js';
import { loadMenuAssets } from '../src/menu/MenuAssets.js';
import { MENU_TEXT } from '../src/menu/menuText.js';

const WAD_URL = new URL('../assets/freedoom1.wad', import.meta.url);
const SCALE = 2;
const W = 320, H = 200;

function showError(text) {
  document.getElementById('msg').textContent = text;
  console.error(text);
}

function paint(canvas, rgba) {
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const small = document.createElement('canvas');
  small.width = W;
  small.height = H;
  small.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba), W, H), 0, 0);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, canvas.width, canvas.height);
}

const num = (id) => Number(document.getElementById(id).value);

async function main() {
  const wad = await WadFile.fromUrl(WAD_URL);
  const wiAssets = loadIntermissionAssets(wad);
  const menuAssets = loadMenuAssets(wad);
  const finaleAssets = { palette: wiAssets.palette, flat: loadFinaleFlat(wad), font: menuAssets.font };
  if (wiAssets.missing.length) console.warn(`Ausentes: ${wiAssets.missing.join(', ')}`);

  const sounds = [];
  let wi = null;
  const restart = () => {
    sounds.length = 0;
    wi = new Intermission({
      episode: num('ep'), last: num('last'), next: num('next'),
      stats: { kills: num('kills'), totalKills: num('totalKills'), items: num('items'), totalItems: num('totalItems'),
        secrets: num('secrets'), totalSecrets: num('totalSecrets'), tics: num('time') * 35 },
      sound: (n) => { sounds.push(`${wi?.bcnt ?? 0}: ${n}`); if (sounds.length > 14) sounds.shift(); },
    });
  };
  let fin = null;
  const frestart = () => {
    const T = MENU_TEXT[document.getElementById('lang').value];
    fin = new Finale(num('fep'), T.finaleText[num('fep')]);
  };
  document.getElementById('restart').addEventListener('click', restart);
  document.getElementById('press').addEventListener('click', () => wi.press());
  document.getElementById('frestart').addEventListener('click', frestart);
  document.getElementById('fpress').addEventListener('click', () => fin.press());
  for (const id of ['ep', 'last', 'next', 'kills', 'totalKills', 'items', 'totalItems', 'secrets', 'totalSecrets', 'time']) {
    document.getElementById(id).addEventListener('change', restart);
  }
  for (const id of ['fep', 'lang']) document.getElementById(id).addEventListener('change', frestart);
  restart();
  frestart();

  let last = performance.now();
  let acc = 0;
  const loop = (now) => {
    acc += Math.min(now - last, 100);
    last = now;
    const playing = document.getElementById('play').checked;
    while (acc >= 1000 / 35) {
      acc -= 1000 / 35;
      if (playing) { wi.tick(); fin.tick(); }
    }
    paint(document.getElementById('wi'), composeIntermission(wi, wiAssets));
    document.getElementById('state').textContent =
      `fase ${wi.phase}  sp_state ${wi.spState}  bcnt ${wi.bcnt}  pausa ${wi.pause}${wi.done ? '  CONCLUÍDA' : ''}\n` +
      `contagem ${JSON.stringify(wi.cnt)}\nalvo     ${JSON.stringify(wi.target)}`;
    document.getElementById('sounds').textContent = sounds.join('\n');
    const lang = document.getElementById('lang').value;
    paint(document.getElementById('fin'), composeFinale(fin, finaleAssets, MENU_TEXT[lang].finalePress));
    document.getElementById('fstate').textContent = `count ${fin.count}  caracteres ${fin.visible}/${fin.text.length}${fin.done ? '  CONCLUÍDO' : ''}`;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

main().catch((err) => showError(err.message));
