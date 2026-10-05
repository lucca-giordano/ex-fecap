// Desenho da intermissão (etapa 23) em 320x200 RGBA, com as coordenadas do wi_stuff.c. Puro.
// Lumps (formato "picture"): WIMAP0..2 (fundo dos episódios 1 a 3) ou INTERPIC (episódio 4), WILVxy
// (nome do mapa y+1 do episódio x+1), WIF ("finished"), WIENTER ("entering"), WIOSTK, WIOSTI, WISCRT2
// (rótulos), WITIME, WINUM0..9 (dígitos), WIPCNT (%), WICOLON (:) e WISUCKS (tempo acima de 61:59).

import { decodePatch, findLastLump, readPalette } from '../wad/Textures.js';
import { createBuffer, drawPatch } from '../menu/MenuRenderer.js';

export const SCREENWIDTH = 320;
export const SCREENHEIGHT = 200;
export const WI = { titleY: 2, statsX: 50, statsY: 50, timeX: 16, timeY: SCREENHEIGHT - 32 };

const range = (prefix, n) => Array.from({ length: n }, (_, i) => `${prefix}${i}`);
const LEVEL_NAMES = [0, 1, 2, 3].flatMap((e) => range(`WILV${e}`, 9));
export const INTERMISSION_PATCHES = ['WIMAP0', 'WIMAP1', 'WIMAP2', 'INTERPIC', 'WIF', 'WIENTER', 'WIOSTK', 'WIOSTI',
  'WISCRT2', 'WITIME', 'WIPCNT', 'WICOLON', 'WISUCKS', 'WIMINUS', ...range('WINUM', 10), ...LEVEL_NAMES];

// Devolve { palette, patches, missing }. Nenhum lump é obrigatório: o que faltar não é desenhado.
export function loadIntermissionAssets(wad) {
  const patches = {};
  const missing = [];
  for (const name of INTERMISSION_PATCHES) {
    const i = findLastLump(wad, name, (l) => l.size > 0);
    if (i < 0) missing.push(name);
    else patches[name] = { ...decodePatch(wad.getLumpBytes(i), name), name };
  }
  return { palette: readPalette(wad), patches, missing };
}

// WI_slamBackground do Doom 1: WIMAP0..2; o episódio 4 usa INTERPIC.
export const backgroundName = (episode) => (episode >= 4 ? 'INTERPIC' : `WIMAP${episode - 1}`);
export const levelNameLump = (episode, map) => `WILV${episode - 1}${map - 1}`;

// drawPatch com registro dos limites (x, y, w, h já descontados os offsets) em buffer.report.
function put(buffer, patch, x, y, name = patch.name) {
  drawPatch(buffer, patch, x, y);
  buffer.report?.push({ name, x: x - patch.leftOffset, y: y - patch.topOffset, w: patch.width, h: patch.height });
}

// WI_drawNum: dígitos alinhados à direita de x (digits < 0: só os necessários). Devolve o novo x.
function drawNum(buffer, p, x, y, n, digits) {
  const num = range('WINUM', 10).map((name) => p[name]);
  if (!num[0]) return x;
  const w = num[0].width;
  if (digits < 0) digits = n === 0 ? 1 : String(Math.abs(n)).length;
  const neg = n < 0;
  if (neg) n = -n;
  if (n === 1994) return 0; // como no Doom
  while (digits--) {
    x -= w;
    if (num[n % 10]) put(buffer, num[n % 10], x, y);
    n = Math.floor(n / 10);
  }
  if (neg && p.WIMINUS) put(buffer, p.WIMINUS, (x -= 8), y);
  return x;
}

// WI_drawPercent: % em x e o número à esquerda; negativo = ainda não aparece.
function drawPercent(buffer, p, x, y, value) {
  if (value < 0) return;
  if (p.WIPCNT) put(buffer, p.WIPCNT, x, y);
  drawNum(buffer, p, x, y, value, -1);
}

// WI_drawTime: segundos em M:SS (ou H:MM:SS) da direita para a esquerda; acima de 61:59, "sucks".
function drawTime(buffer, p, x, y, t) {
  if (t < 0) return;
  if (t > 61 * 59) {
    if (p.WISUCKS) put(buffer, p.WISUCKS, x - p.WISUCKS.width, y);
    return;
  }
  const colonW = p.WICOLON?.width ?? 0;
  let div = 1;
  do {
    const n = Math.floor(t / div) % 60;
    x = drawNum(buffer, p, x, y, n, 2) - colonW;
    div *= 60;
    if ((div === 60 || Math.floor(t / div)) && p.WICOLON) put(buffer, p.WICOLON, x, y);
  } while (Math.floor(t / div));
}

const centered = (patch) => Math.floor((SCREENWIDTH - patch.width) / 2);

// Nome do mapa e "finished" (WI_drawLF) ou "entering" e o nome do próximo (WI_drawEL).
function drawTitle(buffer, p, first, nameLump, nameFirst) {
  let y = WI.titleY;
  const name = p[nameLump];
  const top = nameFirst ? name : first;
  const bottom = nameFirst ? first : name;
  if (top) put(buffer, top, centered(top), y);
  if (name) y += Math.floor((5 * name.height) / 4);
  if (bottom) put(buffer, bottom, centered(bottom), y);
}

// state: Intermission. Devolve Uint8ClampedArray 320x200x4, opaco. `report` (opcional) recebe
// { name, x, y, w, h } de cada patch desenhado, para verificação.
export function composeIntermission(state, assets, report) {
  const buffer = createBuffer(assets.palette);
  buffer.report = report;
  const d = buffer.data;
  for (let i = 0; i < d.length; i += 4) { d[i] = 0; d[i + 1] = 0; d[i + 2] = 0; d[i + 3] = 255; }
  const p = assets.patches;
  const { episode, last, next } = state.info;
  const bg = p[backgroundName(episode)];
  if (bg) put(buffer, bg, 0, 0);
  if (state.phase === 'entering') {
    drawTitle(buffer, p, p.WIENTER, levelNameLump(episode, next), false);
    return d;
  }
  drawTitle(buffer, p, p.WIF, levelNameLump(episode, last), true);
  const lh = Math.floor((3 * (p.WINUM0?.height ?? 12)) / 2);
  const rows = [['WIOSTK', state.cnt.kills], ['WIOSTI', state.cnt.items], ['WISCRT2', state.cnt.secret]];
  rows.forEach(([label, value], i) => {
    const y = WI.statsY + i * lh;
    if (p[label]) put(buffer, p[label], WI.statsX, y);
    drawPercent(buffer, p, SCREENWIDTH - WI.statsX, y, value);
  });
  if (p.WITIME) put(buffer, p.WITIME, WI.timeX, WI.timeY);
  drawTime(buffer, p, SCREENWIDTH / 2 - WI.timeX, WI.timeY, state.cnt.time);
  return d;
}
