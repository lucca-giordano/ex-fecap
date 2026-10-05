// Desenho do menu numa imagem RGBA de 320x200. Puro: sem DOM e sem WebGPU (verificável no Node).
// Coordenadas de partida tiradas do m_menu.c do Doom original.

import { SCREENS, LEVEL_MIN } from './Menu.js';
import { MENU_TEXT, MENU_LANG } from './menuText.js';
import { HELP, CREDITS, helpEntries, helpPages, creditsPages } from './helpPages.js';
import { FONT_FIRST, FONT_COUNT } from './MenuAssets.js';

export { helpEntries, helpPages, creditsPages }; // reexportados para as verificações

export const MENU_WIDTH = 320;
export const MENU_HEIGHT = 200;

const LINEHEIGHT = 16;   // menu principal
const SKULLXOFF = -32;
const SPACE_ADVANCE = 4; // espaço ou caractere sem glifo (M_WriteText)
const TEXT_NEWLINE = 12;

const MAIN = { logoX: 94, logoY: 2, x: 97, y: 64 };
// thermoStep: 22 no ponto de partida; 24 para o termômetro (altura 13 em y + 10) não encostar no item seguinte.
const OPTIONS = { titleX: 108, titleY: 15, x: 60, y: 36, valueX: 210, line: 12, thermoDy: 10, thermoStep: 24 };
const FOOTER_Y = 185;
// Etapa 23 (m_menu.c): EpiDef em (48, 63) com o título M_EPISOD em (54, 38); NewDef em (48, 63) com
// M_NEWG em (96, 14) e M_SKILL em (54, 38); linhas de 16 pixels.
const EPISODE = { titleX: 54, titleY: 38, x: 48, y: 63 };
const SKILL = { newGameX: 96, newGameY: 14, titleX: 54, titleY: 38, x: 48, y: 63 };
const SKILL_PATCHES = ['M_JKILL', 'M_ROUGH', 'M_HURT', 'M_ULTRA', 'M_NMARE'];
const THERMO_WIDTH = 10; // células padrão; cada item pode definir `cells` (o volume usa 16)

// Exportado só para verificações (tools/check-menu.mjs).
export const MENU_LAYOUT = { MAIN, OPTIONS, HELP, SKULLXOFF, EPISODE, SKILL };

// Quadro da caveira: alterna a cada 8 tics do Doom (35 tics por segundo).
export const skullFrame = (time) => Math.floor(time * 35 / 8) % 2;

export function createBuffer(palette) {
  return { width: MENU_WIDTH, height: MENU_HEIGHT, palette, data: new Uint8ClampedArray(MENU_WIDTH * MENU_HEIGHT * 4) };
}

// Como o V_DrawPatch: a posição final desconta os offsets do cabeçalho do patch.
// Pixels transparentes não são desenhados; os desenhados ficam com alfa 255.
export function drawPatch(buffer, patch, x, y) {
  const x0 = x - patch.leftOffset, y0 = y - patch.topOffset;
  const { data, palette, width, height } = buffer;
  for (let py = 0; py < patch.height; py++) {
    const by = y0 + py;
    if (by < 0 || by >= height) continue;
    for (let px = 0; px < patch.width; px++) {
      const bx = x0 + px;
      if (bx < 0 || bx >= width) continue;
      const s = py * patch.width + px;
      if (!patch.opacity[s]) continue;
      const c = patch.indices[s] * 3, o = (by * width + bx) * 4;
      data[o] = palette[c]; data[o + 1] = palette[c + 1]; data[o + 2] = palette[c + 2]; data[o + 3] = 255;
    }
  }
}

// Remove acentos (NFD + descarte dos diacríticos) e passa para maiúsculas, como o M_WriteText exige.
const normalizeText = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

function glyphFor(font, ch) {
  const c = ch.charCodeAt(0) - FONT_FIRST;
  return c < 0 || c >= FONT_COUNT ? null : font[c];
}

export function measureText(font, text) {
  let best = 0, w = 0;
  for (const ch of normalizeText(text)) {
    if (ch === '\n') { best = Math.max(best, w); w = 0; continue; }
    const g = glyphFor(font, ch);
    w += g ? g.width : SPACE_ADVANCE;
  }
  return Math.max(best, w);
}

// M_WriteText. `report` (opcional) recebe os limites do texto desenhado, para verificação.
export function drawText(buffer, font, text, x, y, report) {
  let cx = x, cy = y;
  let right = x, bottom = y;
  for (const ch of normalizeText(text)) {
    if (ch === '\n') { cx = x; cy += TEXT_NEWLINE; continue; }
    const g = glyphFor(font, ch);
    if (!g) { cx += SPACE_ADVANCE; continue; }
    drawPatch(buffer, g, cx, cy);
    right = Math.max(right, cx - g.leftOffset + g.width);
    bottom = Math.max(bottom, cy - g.topOffset + g.height);
    cx += g.width;
  }
  report?.push({ text, x, y, right, bottom, width: measureText(font, text) });
}

const centeredX = (font, text) => Math.floor((MENU_WIDTH - measureText(font, text)) / 2);

// M_DrawThermo: ponta esquerda, `width` células de 8 pixels, ponta direita e o marcador.
// Sem as peças do termômetro, escreve o valor como número.
export function drawThermo(buffer, assets, x, y, width, pos, report) {
  const p = assets.patches;
  if (!p.M_THERML || !p.M_THERMM || !p.M_THERMR || !p.M_THERMO) {
    drawText(buffer, assets.font, String(pos + 1), x, y, report);
    return;
  }
  drawPatch(buffer, p.M_THERML, x, y);
  let xx = x + 8;
  for (let i = 0; i < width; i++) {
    drawPatch(buffer, p.M_THERMM, xx, y);
    xx += 8;
  }
  drawPatch(buffer, p.M_THERMR, xx, y);
  drawPatch(buffer, p.M_THERMO, x + 8 + pos * 8, y);
}

// Gráfico do WAD se existir e o idioma permitir; senão, texto com a fonte.
function drawLabel(buffer, assets, graphic, text, x, y, useGraphic, report) {
  const patch = useGraphic && graphic ? assets.patches[graphic] : null;
  if (patch) drawPatch(buffer, patch, x, y);
  else drawText(buffer, assets.font, text, x, y, report);
}

function drawSkull(buffer, assets, time, x, y) {
  const patch = assets.patches[skullFrame(time) ? 'M_SKULL2' : 'M_SKULL1'];
  if (patch) drawPatch(buffer, patch, x, y);
  else drawText(buffer, assets.font, '>', x + 16, y + 5);
}

// Caveira centralizada verticalmente na linha de texto (altura real do patch e da fonte).
function drawSkullOnTextLine(buffer, assets, time, itemX, itemY) {
  const skull = assets.patches[skullFrame(time) ? 'M_SKULL2' : 'M_SKULL1'];
  const glyph = glyphFor(assets.font, 'A');
  const fontH = glyph ? glyph.height : 7;
  if (!skull) { drawText(buffer, assets.font, '>', itemX - 12, itemY); return; }
  const top = itemY + Math.round((fontH - skull.height) / 2);
  drawPatch(buffer, skull, itemX + SKULLXOFF, top + skull.topOffset);
}

function valueText(T, item, values) {
  const v = item.type === 'fullscreen' ? values.fullscreen : values[item.setting];
  if (typeof v === 'string') return T[v]; // configurações de texto (visualMode, moveMode): valor traduzido
  return v ? T.on : T.off;
}

function fillBlack(buffer) {
  const d = buffer.data;
  for (let i = 0; i < d.length; i += 4) { d[i] = 0; d[i + 1] = 0; d[i + 2] = 0; d[i + 3] = 255; }
}

// Telas de lista (opções e debug): rótulos em x, valores em valueX, termômetros em duas linhas.
function drawList(buffer, assets, T, screenId, state, time, report) {
  let y = OPTIONS.y;
  SCREENS[screenId].items.forEach((item, i) => {
    drawText(buffer, assets.font, T[item.id], OPTIONS.x, y, report);
    if (i === state.selected) drawSkullOnTextLine(buffer, assets, time, OPTIONS.x, y);
    if (item.type === 'thermo') {
      // Posição = nível - mínimo do item (1..10 -> 0..9; volume 0..15 -> 0..15).
      drawThermo(buffer, assets, OPTIONS.x, y + OPTIONS.thermoDy, item.cells ?? THERMO_WIDTH,
        state.values[item.setting] - (item.min ?? LEVEL_MIN), report);
      y += OPTIONS.thermoStep;
      return;
    }
    if (item.type === 'toggle' || item.type === 'fullscreen') {
      drawText(buffer, assets.font, valueText(T, item, state.values), OPTIONS.valueX, y, report);
    }
    y += OPTIONS.line;
  });
}

// Etapa 17: linhas de 12 pixels e páginas (helpPages.js); com mais de uma, o rodapé mostra "PAGE n/N".
function drawHelp(buffer, assets, T, report, page = 0) {
  fillBlack(buffer);
  drawText(buffer, assets.font, T.controlsTitle, centeredX(assets.font, T.controlsTitle), HELP.titleY, report);
  const pages = helpPages(T);
  const p = Math.min(Math.max(0, page), pages.length - 1);
  const entries = pages[p];
  const rows = Math.ceil(entries.length / 2);
  entries.forEach(([keyLabel, name], i) => {
    const x = HELP.colX[Math.floor(i / rows)];
    const y = HELP.y + (i % rows) * HELP.line;
    drawText(buffer, assets.font, keyLabel, x, y, report);
    drawText(buffer, assets.font, name, x + HELP.nameDx, y, report);
  });
  const footer = pages.length > 1
    ? T.helpFooterPaged.replace('{page}', `${p + 1}/${pages.length}`)
    : T.helpFooter;
  drawText(buffer, assets.font, footer, centeredX(assets.font, footer), HELP.footerY, report);
}

// Créditos (etapa 22): fundo preto, título, uma coluna de linhas e o rodapé da ajuda.
function drawCredits(buffer, assets, T, report, page = 0) {
  fillBlack(buffer);
  drawText(buffer, assets.font, T.creditsTitle, centeredX(assets.font, T.creditsTitle), HELP.titleY, report);
  const pages = creditsPages(T);
  const p = Math.min(Math.max(0, page), pages.length - 1);
  pages[p].forEach((line, i) => {
    if (line) drawText(buffer, assets.font, line, CREDITS.x, CREDITS.y + i * CREDITS.line, report);
  });
  const footer = pages.length > 1 ? T.helpFooterPaged.replace('{page}', `${p + 1}/${pages.length}`) : T.helpFooter;
  drawText(buffer, assets.font, footer, centeredX(assets.font, footer), HELP.footerY, report);
}

// Única função que sabe o que cada tela contém.
// state: Menu.snapshot() (+ lang opcional); time em segundos; report: lista opcional de limites de texto.
export function composeMenu(state, assets, time, report) {
  const T = MENU_TEXT[state.lang ?? MENU_LANG];
  const graphics = (state.lang ?? MENU_LANG) === 'en'; // no português, todos os rótulos usam a fonte
  const buffer = createBuffer(assets.palette);

  if (state.screen === 'help') {
    drawHelp(buffer, assets, T, report, state.helpPage ?? 0);
    return buffer.data;
  }
  if (state.screen === 'credits') {
    drawCredits(buffer, assets, T, report, state.helpPage ?? 0);
    return buffer.data;
  }

  // Tela de título: TITLEPIC opaco atrás do menu enquanto o jogo não começou.
  if (!state.started && assets.patches.TITLEPIC) drawPatch(buffer, assets.patches.TITLEPIC, 0, 0);

  if (state.screen === 'main') {
    if (assets.patches.M_DOOM) drawPatch(buffer, assets.patches.M_DOOM, MAIN.logoX, MAIN.logoY);
    const graphicsByItem = { newGame: 'M_NEWG', options: 'M_OPTION', readThis: 'M_RDTHIS' };
    SCREENS.main.items.forEach((item, i) => {
      const y = MAIN.y + i * LINEHEIGHT;
      drawLabel(buffer, assets, graphicsByItem[item.id], T[item.id], MAIN.x, y, graphics, report);
      if (i === state.selected) drawSkull(buffer, assets, time, MAIN.x + SKULLXOFF, y - 5);
    });
  } else if (state.screen === 'options') {
    const title = graphics ? assets.patches.M_OPTTTL : null;
    if (title) drawPatch(buffer, title, OPTIONS.titleX, OPTIONS.titleY);
    else drawText(buffer, assets.font, T.options, centeredX(assets.font, T.options), OPTIONS.titleY, report);
    drawList(buffer, assets, T, 'options', state, time, report);
  } else if (state.screen === 'extras') {
    drawText(buffer, assets.font, T.extrasTitle, centeredX(assets.font, T.extrasTitle), OPTIONS.titleY, report);
    drawList(buffer, assets, T, 'extras', state, time, report);
  } else if (state.screen === 'gameDebug') {
    drawText(buffer, assets.font, T.gameDebugTitle, centeredX(assets.font, T.gameDebugTitle), OPTIONS.titleY, report);
    drawList(buffer, assets, T, 'gameDebug', state, time, report);
  } else if (state.screen === 'monsterDebug') {
    drawText(buffer, assets.font, T.monsterDebugTitle, centeredX(assets.font, T.monsterDebugTitle), OPTIONS.titleY, report);
    drawList(buffer, assets, T, 'monsterDebug', state, time, report);
  } else if (state.screen === 'episode') { // etapa 23
    drawLabel(buffer, assets, 'M_EPISOD', T.episodeTitle, EPISODE.titleX, EPISODE.titleY, graphics, report);
    SCREENS.episode.items.forEach((item, i) => {
      const y = EPISODE.y + i * LINEHEIGHT;
      drawLabel(buffer, assets, `M_EPI${item.episode}`, T[item.id], EPISODE.x, y, graphics, report);
      if (i === state.selected) drawSkull(buffer, assets, time, EPISODE.x + SKULLXOFF, y - 5);
    });
  } else if (state.screen === 'skill' || state.screen === 'nightmare') { // etapa 23
    drawLabel(buffer, assets, 'M_NEWG', T.newGame, SKILL.newGameX, SKILL.newGameY, graphics, report);
    drawLabel(buffer, assets, 'M_SKILL', T.skillTitle, SKILL.titleX, SKILL.titleY, graphics, report);
    const selected = state.screen === 'nightmare' ? SCREENS.skill.items.length - 1 : state.selected;
    SCREENS.skill.items.forEach((item, i) => {
      const y = SKILL.y + i * LINEHEIGHT;
      drawLabel(buffer, assets, SKILL_PATCHES[i], T[item.id], SKILL.x, y, graphics, report);
      if (i === selected) drawSkull(buffer, assets, time, SKILL.x + SKULLXOFF, y - 5);
    });
    // Confirmação (M_StartMessage): linhas centradas, o bloco centrado na vertical, por cima do menu.
    if (state.screen === 'nightmare') {
      const lines = T.nightmareConfirm.split('\n');
      const top = Math.floor((MENU_HEIGHT - lines.length * TEXT_NEWLINE) / 2);
      lines.forEach((line, i) => { if (line) drawText(buffer, assets.font, line, centeredX(assets.font, line), top + i * TEXT_NEWLINE, report); });
    }
  } else if (state.screen === 'levelDebug') { // etapa 23
    drawText(buffer, assets.font, T.levelDebugTitle, centeredX(assets.font, T.levelDebugTitle), OPTIONS.titleY, report);
    drawList(buffer, assets, T, 'levelDebug', state, time, report);
  } else if (state.screen === 'debug') {
    drawText(buffer, assets.font, T.debugTitle, centeredX(assets.font, T.debugTitle), OPTIONS.titleY, report);
    drawList(buffer, assets, T, 'debug', state, time, report);
  }

  if (state.started && state.resumeFailed) {
    drawText(buffer, assets.font, T.clickToResume, centeredX(assets.font, T.clickToResume), FOOTER_Y, report);
  }
  return buffer.data;
}
