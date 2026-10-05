// Fim de episódio (etapa 23), como a parte de texto do f_finale.c do Doom 1. Puro.
// Fundo: o flat FLOOR4_8 (64x64 índices da paleta) repetido; texto próprio do projeto (menuText.js)
// escrito 1 caractere a cada 3 tics a partir de (10, 10), linhas de 11 pixels, espaço de 4 pixels.
// Terminado o texto, "PRESS A KEY"; a tecla seguinte volta à tela de título.

import { findLastLump } from '../wad/Textures.js';
import { createBuffer, drawPatch, drawText, measureText } from '../menu/MenuRenderer.js';
import { FONT_FIRST, FONT_COUNT } from '../menu/MenuAssets.js';

export const TEXTSPEED = 3;
export const TEXT_START = 10;   // finalecount - 10 (F_TextWrite)
export const FINALE_FLAT = 'FLOOR4_8';
export const FINALE_TEXT_POS = { x: 10, y: 10, line: 11, space: 4 };
const FLAT_SIZE = 64;
const PRESS_Y = 186;

// Flat do fundo (4096 índices) ou null.
export function loadFinaleFlat(wad, name = FINALE_FLAT) {
  const i = findLastLump(wad, name, (l) => l.size === FLAT_SIZE * FLAT_SIZE);
  return i < 0 ? null : wad.getLumpBytes(i);
}

export class Finale {
  constructor(episode, text) {
    this.episode = episode;
    this.text = text.toUpperCase();
    this.count = 0;     // finalecount
    this.done = false;
  }

  // Caracteres já escritos.
  get visible() {
    return Math.max(0, Math.min(this.text.length, Math.floor((this.count - TEXT_START) / TEXTSPEED)));
  }

  get typed() {
    return this.visible >= this.text.length;
  }

  tick() {
    this.count++;
  }

  // Tecla: com o texto incompleto, mostra tudo; com ele completo, termina.
  press() {
    if (!this.typed) this.count = TEXT_START + this.text.length * TEXTSPEED;
    else this.done = true;
  }
}

// F_TextWrite: um caractere por vez, sem passar da largura da tela.
function drawFinaleText(buffer, font, text) {
  let cx = FINALE_TEXT_POS.x, cy = FINALE_TEXT_POS.y;
  for (const ch of text) {
    if (ch === '\n') { cx = FINALE_TEXT_POS.x; cy += FINALE_TEXT_POS.line; continue; }
    const c = ch.charCodeAt(0) - FONT_FIRST;
    const g = c >= 0 && c < FONT_COUNT ? font[c] : null;
    if (!g) { cx += FINALE_TEXT_POS.space; continue; }
    if (cx + g.width > buffer.width) break;
    drawPatch(buffer, g, cx, cy);
    cx += g.width;
  }
}

// assets: { palette, flat (ou null), font }; pressText: "PRESS A KEY" no idioma do menu.
export function composeFinale(finale, assets, pressText) {
  const buffer = createBuffer(assets.palette);
  const { data, palette } = buffer;
  for (let y = 0; y < buffer.height; y++) {
    for (let x = 0; x < buffer.width; x++) {
      const c = assets.flat ? assets.flat[(y % FLAT_SIZE) * FLAT_SIZE + (x % FLAT_SIZE)] * 3 : 0;
      const o = (y * buffer.width + x) * 4;
      data[o] = assets.flat ? palette[c] : 0;
      data[o + 1] = assets.flat ? palette[c + 1] : 0;
      data[o + 2] = assets.flat ? palette[c + 2] : 0;
      data[o + 3] = 255;
    }
  }
  if (assets.font?.some(Boolean)) {
    drawFinaleText(buffer, assets.font, finale.text.slice(0, finale.visible));
    if (finale.typed) drawText(buffer, assets.font, pressText, Math.floor((buffer.width - measureText(assets.font, pressText)) / 2), PRESS_Y);
  }
  return data;
}
