// Camada de interface (pistola + barra de status) em 320x200 RGBA. Puro: sem DOM e sem WebGPU.
// Coordenadas de partida do st_stuff.c do Doom. Reaproveita createBuffer/drawPatch do menu.

import { createBuffer, drawPatch, drawText, measureText } from '../menu/MenuRenderer.js';
import { weaponTopLeft } from '../game/weapons.js';
import { PISTOL_SLOT, AMMO_TYPES } from '../game/PlayerStats.js';

export const BAR_Y = 168;          // primeira linha da barra (ST_Y)
export const HUD_WIDTH = 320;
export const HUD_HEIGHT = 200;

export const LAYOUT = {
  bar: { x: 0, y: BAR_Y },
  arms: { x: 104, y: BAR_Y },               // STARMS
  ammo: { right: 44, y: 171, digits: 3 },   // ST_AMMOX, ST_AMMOY
  health: { right: 90, y: 171, digits: 3 }, // ST_HEALTHX; o % fica em x = 90
  armor: { right: 221, y: 171, digits: 3 }, // ST_ARMORX; o % fica em x = 221
  weapons: { x: 111, y: 172, dx: 12, dy: 10 }, // ST_ARMSX, ST_ARMSY, espaçamentos
  face: { x: 143, y: 168 },                 // ST_FACESX, ST_FACESY
  // Tabela de munição (balas, cartuchos, foguetes, células): atual à direita em 288, máximo em 314.
  ammoTable: { currentRight: 288, maxRight: 314, rows: [173, 179, 185, 191], digits: 3 },
};
// Chaves (etapa 16): azul, amarela e vermelha em (239, 171), (239, 181) e (239, 191).
export const KEY_SLOTS = { x: 239, y: [171, 181, 191], colors: ['blue', 'yellow', 'red'] };
export const MESSAGE_POS = { x: 0, y: 0 };
export const RESTART_Y = 90; // etapa 19: texto "PRESS USE (E) OR CLICK TO RESTART"
const MESSAGE_MAX_WIDTH = 320; // largura da tela do Doom

// Mensagem de coleta: se passar de 320 pixels, quebra em duas linhas (o drawText avança 12 pixels).
export function wrapMessage(font, text, maxWidth = MESSAGE_MAX_WIDTH) {
  if (measureText(font, text) <= maxWidth) return text;
  const words = text.split(' ');
  for (let i = words.length - 1; i > 0; i--) {
    const first = words.slice(0, i).join(' ');
    if (measureText(font, first) <= maxWidth) return `${first}\n${words.slice(i).join(' ')}`;
  }
  return text;
}

// Lump de chave de cada cor: caveira (3, 4, 5) tem prioridade sobre o cartão (0, 1, 2); null se nenhum.
export function keyLumpFor(keys, colorIndex) {
  const color = KEY_SLOTS.colors[colorIndex];
  if (keys[`${color}Skull`]) return `STKEYS${3 + colorIndex}`;
  if (keys[`${color}Card`]) return `STKEYS${colorIndex}`;
  return null;
}

// Desenha o patch com a coluna esquerda e a linha de cima dadas (sem os offsets).
function drawPatchAt(buffer, patch, left, top) {
  drawPatch(buffer, patch, left + patch.leftOffset, top + patch.topOffset);
}

// Número alinhado à direita (STlib_drawNum): sem zeros à esquerda; 0 mostra um único "0".
// digits: patches 0..9; a largura de cada dígito é a do dígito 0. Devolve a coluna mais à esquerda.
export function drawNumberRight(buffer, digits, value, right, y, maxDigits) {
  const w = digits[0].width;
  let v = Math.max(0, Math.trunc(value));
  let x = right;
  let n = 0;
  do {
    x -= w;
    const d = digits[v % 10];
    if (d) drawPatch(buffer, d, x, y);
    v = Math.floor(v / 10);
    n++;
  } while (v > 0 && n < maxDigits);
  return x;
}

// Nível de dor do rosto: clamp(floor((100 - vida) * 5 / 101), 0, 4).
export function painLevel(health) {
  return Math.min(4, Math.max(0, Math.floor((100 - Math.min(health, 100)) * 5 / 101)));
}

// Nome do lump do rosto (STFDEAD0 com vida <= 0; STFST01 se faltar o lump).
export function faceLumpName(health, look, patches) {
  if (health <= 0) return patches.STFDEAD0 ? 'STFDEAD0' : 'STFST01';
  const name = `STFST${painLevel(health)}${look}`;
  return patches[name] ? name : 'STFST01';
}

// Olhar do rosto no tic dado: 1 (frente) quase sempre; depois de cada intervalo de 40 a 120 tics,
// 15 tics olhando para 0 ou 2. Sorteio com semente fixa, refeito desde o tic 0 (função pura).
export const FACE_SEED = 12345;
export function faceLookAt(tic, seed = FACE_SEED) {
  let s = seed >>> 0;
  const rand = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 0x100000000; }; // LCG
  let t = 0;
  for (;;) {
    t += 40 + Math.floor(rand() * 81); // fim do intervalo olhando para frente
    if (tic < t) return 1;
    const look = rand() < 0.5 ? 0 : 2;
    t += 15;
    if (tic < t) return look;
  }
}

// Tela de estatísticas (etapa 20): opaca, com INTERPIC (ou preto), título, subtítulo, linhas
// [rótulo, valor] e rodapé, na fonte STCFN. info: { title, subtitle, rows: [[rótulo, valor]], footer }.
export const INTERMISSION_LAYOUT = { titleY: 20, subtitleY: 34, rowsY: 70, rowStep: 20, labelX: 60, valueRight: 260, footerY: 180 };
function composeIntermission(buffer, info, assets, report) {
  const d = buffer.data;
  for (let i = 0; i < d.length; i += 4) { d[i] = 0; d[i + 1] = 0; d[i + 2] = 0; d[i + 3] = 255; }
  if (assets.patches.INTERPIC) drawPatch(buffer, assets.patches.INTERPIC, 0, 0);
  const font = assets.font;
  if (!font?.some(Boolean)) return buffer.data;
  const L = INTERMISSION_LAYOUT;
  const text = (s, x, y, name) => {
    drawText(buffer, font, s, x, y);
    report?.push({ name, x, y, w: measureText(font, s), h: 12, text: s });
  };
  const centered = (s, y, name) => text(s, Math.max(0, Math.floor((HUD_WIDTH - measureText(font, s)) / 2)), y, name);
  centered(info.title, L.titleY, 'title');
  centered(info.subtitle, L.subtitleY, 'subtitle');
  info.rows.forEach(([label, value], i) => {
    const y = L.rowsY + i * L.rowStep;
    text(label, L.labelX, y, `label${i}`);
    text(value, L.valueRight - measureText(font, value), y, `value${i}`);
  });
  centered(info.footer, L.footerY, 'footer');
  return buffer.data;
}

// Linha da paleta iluminada (256 x RGB) para um nível de luz (litPalette: 256 x 32 RGBA).
const litRows = new WeakMap();
function paletteRow(litPalette, level) {
  if (!litRows.has(litPalette)) litRows.set(litPalette, []);
  const cache = litRows.get(litPalette);
  if (!cache[level]) {
    const row = new Uint8Array(256 * 3);
    for (let i = 0; i < 256; i++) row.set(litPalette.subarray((level * 256 + i) * 4, (level * 256 + i) * 4 + 3), i * 3);
    cache[level] = row;
  }
  return cache[level];
}

// state: { stats, weapon: { prefix, frame, sx, sy, flash: { prefix, letter } | null, ammo } | null, weaponLevel,
// message?, face? (lump do rosto, etapa 19), restartText? }; tics: relógio de jogo (rosto). weapon.prefix ausente: pistola (PISG); flash true: PISF A.
// O campo grande de munição mostra o tipo weapon.ammo (padrão: balas); null (soco) deixa em branco.
// Devolve Uint8ClampedArray 320x200x4; transparente onde não há desenho. `report` (opcional) recebe
// { name, x, y, w, h } de cada elemento desenhado, para verificação.
export function composeHud(state, assets, tics, report) {
  const buffer = createBuffer(assets.palette);
  const { patches, sprites } = assets;
  if (state.intermission) return composeIntermission(buffer, state.intermission, assets, report);
  const box = (name, x, y, p) => report?.push({ name, x, y, w: p.width, h: p.height });

  // 1. Arma (iluminada pelo setor) e clarão (brilho máximo), antes da barra.
  if (state.weapon) {
    const { frame, sx, sy, flash } = state.weapon;
    const gunName = `${state.weapon.prefix ?? 'PISG'}${frame}0`;
    const gun = sprites[gunName];
    if (gun) {
      buffer.palette = paletteRow(assets.litPalette, state.weaponLevel);
      const { x, y } = weaponTopLeft(gun, sx, sy);
      drawPatchAt(buffer, gun, x, y);
      box(gunName, x, y, gun);
    }
    const flashName = flash === true ? 'PISFA0' : flash ? `${flash.prefix}${flash.letter}0` : null;
    const flashPatch = flashName ? sprites[flashName] : null;
    if (flashPatch) {
      buffer.palette = paletteRow(assets.litPalette, 0); // clarão sempre em brilho máximo
      const { x, y } = weaponTopLeft(flashPatch, sx, sy);
      drawPatchAt(buffer, flashPatch, x, y);
      box(flashName, x, y, flashPatch);
    }
    buffer.palette = assets.palette; // barra e números sem iluminação
  }

  // 2. Barra por cima (linhas 168 a 199).
  const L = LAYOUT;
  drawPatch(buffer, patches.STBAR, L.bar.x, L.bar.y);
  box('STBAR', L.bar.x, L.bar.y, patches.STBAR);
  if (patches.STARMS) drawPatch(buffer, patches.STARMS, L.arms.x, L.arms.y);

  const big = Array.from({ length: 10 }, (_, i) => patches[`STTNUM${i}`]);
  const small = Array.from({ length: 10 }, (_, i) => patches[`STYSNUM${i}`]);
  const { stats } = state;
  const bigNumber = (name, value, f) => {
    const left = drawNumberRight(buffer, big, value, f.right, f.y, f.digits);
    report?.push({ name, x: left, y: f.y, w: f.right - left, h: big[0].height, field: f });
  };
  // Munição da arma atual; com o soco (ammo null), o campo fica em branco.
  const ammoType = state.weapon?.ammo === undefined ? 'clip' : state.weapon.ammo;
  if (ammoType) bigNumber('ammo', stats.ammo[ammoType], L.ammo);
  bigNumber('health', Math.max(0, stats.health), L.health); // etapa 19: a vida negativa aparece como 0
  if (patches.STTPRCNT) drawPatch(buffer, patches.STTPRCNT, L.health.right, L.health.y);
  bigNumber('armor', stats.armor, L.armor);
  if (patches.STTPRCNT) drawPatch(buffer, patches.STTPRCNT, L.armor.right, L.armor.y);

  // Painel de armas: slots 2 a 7; possuído em amarelo (STYSNUM), senão cinza (STGNUM).
  for (let i = 0; i < 6; i++) {
    const slot = i + PISTOL_SLOT;
    const p = stats.weaponsOwned.has(slot) ? patches[`STYSNUM${slot}`] : patches[`STGNUM${slot}`];
    if (p) drawPatch(buffer, p, L.weapons.x + (i % 3) * L.weapons.dx, L.weapons.y + Math.floor(i / 3) * L.weapons.dy);
  }

  // Rosto.
  // Etapa 19: state.face (FaceState, já conferido contra os lumps); sem ele, a regra da etapa 13.
  const faceName = state.face ?? faceLumpName(stats.health, faceLookAt(tics), patches);
  if (patches[faceName]) {
    drawPatch(buffer, patches[faceName], L.face.x, L.face.y);
    report?.push({ name: faceName, x: L.face.x, y: L.face.y, w: patches[faceName].width, h: patches[faceName].height });
  }

  // Tabela de munição: os quatro tipos, atual e máximo corrente (a mochila dobra os máximos).
  if (small.every(Boolean)) {
    const T = L.ammoTable;
    T.rows.forEach((y, row) => {
      const type = AMMO_TYPES[row];
      const current = stats.ammo[type];
      const max = stats.maxAmmoOf(type);
      for (const [value, right] of [[current, T.currentRight], [max, T.maxRight]]) {
        const left = drawNumberRight(buffer, small, value, right, y, T.digits);
        report?.push({ name: `ammoTable${row}`, x: left, y, w: right - left, h: small[0].height, field: { right, digits: T.digits } });
      }
    });
  }
  // Chaves (etapa 16): uma por cor; caveira tem prioridade sobre o cartão da mesma cor.
  for (let i = 0; i < 3; i++) {
    const name = keyLumpFor(stats.keys, i);
    if (name && patches[name]) {
      drawPatch(buffer, patches[name], KEY_SLOTS.x, KEY_SLOTS.y[i]);
      report?.push({ name, x: KEY_SLOTS.x, y: KEY_SLOTS.y[i], w: patches[name].width, h: patches[name].height });
    }
  }

  // Texto de reinício (etapa 19), centralizado em y = 90.
  if (state.restartText && assets.font?.some(Boolean)) {
    const w = measureText(assets.font, state.restartText);
    const x = Math.max(0, Math.floor((HUD_WIDTH - w) / 2));
    drawText(buffer, assets.font, state.restartText, x, RESTART_Y);
    report?.push({ name: 'restart', x, y: RESTART_Y, w, h: 12 });
  }

  // Mensagem de coleta (etapa 16) no canto superior esquerdo, na fonte do menu.
  if (state.message && assets.font?.some(Boolean)) {
    const text = wrapMessage(assets.font, state.message);
    drawText(buffer, assets.font, text, MESSAGE_POS.x, MESSAGE_POS.y);
    const lines = text.split('\n');
    report?.push({ name: 'message', x: MESSAGE_POS.x, y: MESSAGE_POS.y, w: Math.max(...lines.map((l) => measureText(assets.font, l))), h: 12 * lines.length });
  }
  return buffer.data;
}
