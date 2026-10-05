// Desenho do automapa (etapa 22) na camada de HUD de 320x200, região 320x168. Puro.
// Regras de cor na ordem do am_map.c do Doom (AM_drawWalls); recorte Cohen-Sutherland e Bresenham.

import { nearestPaletteIndex } from '../particles/particleConfig.js';
import { AM_WIDTH, AM_HEIGHT } from './AutomapState.js';

export const ML_SECRET = 0x0020;
export const ML_DONTDRAW = 0x0080;
export const ML_MAPPED = 0x0100; // no Doom o bit fica na linha; aqui usamos o array mapped
export const NO_SIDE = 0xFFFF;
export const GRID_SIZE = 128;

// Cores-alvo (RGB) e o índice mais próximo da paleta 0.
export const AM_COLORS = {
  wall: [220, 0, 0], floor: [140, 96, 48], ceiling: [230, 220, 0], special39: [150, 0, 0],
  twoSided: [120, 120, 120], allmap: [100, 100, 100], thing: [0, 190, 0], grid: [45, 45, 45], player: [255, 255, 255],
};
export function automapColors(palette) {
  const out = {};
  for (const [k, rgb] of Object.entries(AM_COLORS)) {
    const index = nearestPaletteIndex(palette, rgb);
    out[k] = { index, rgb: [palette[index * 3], palette[index * 3 + 1], palette[index * 3 + 2]] };
  }
  return out;
}

// Tipo de cor de uma linha (ou null: não desenha). map: alturas correntes; cheat 0..2.
export function lineColorKind(map, li, mapped, cheat, allmap) {
  const line = map.linedefs[li];
  if (cheat >= 1 || mapped[li]) {
    if ((line.flags & ML_DONTDRAW) && cheat === 0) return null;
    if (line.leftSidedef === NO_SIDE) return 'wall';
    if (line.special === 39) return 'special39';
    if (line.flags & ML_SECRET) return 'wall';
    const f = map.sectors[map.sidedefs[line.rightSidedef].sector], b = map.sectors[map.sidedefs[line.leftSidedef].sector];
    if (f.floorHeight !== b.floorHeight) return 'floor';
    if (f.ceilingHeight !== b.ceilingHeight) return 'ceiling';
    if (cheat >= 1) return 'twoSided';
    return null;
  }
  if (allmap && !(line.flags & ML_DONTDRAW)) return 'allmap';
  return null;
}

// Cohen-Sutherland contra [0, W-1] x [0, H-1]. Devolve [x0, y0, x1, y1] ou null.
const INSIDE = 0, LEFT = 1, RIGHT = 2, TOP = 4, BOTTOM = 8;
function outcode(x, y, w, h) {
  let c = INSIDE;
  if (x < 0) c |= LEFT; else if (x > w - 1) c |= RIGHT;
  if (y < 0) c |= TOP; else if (y > h - 1) c |= BOTTOM;
  return c;
}
export function clipLine(x0, y0, x1, y1, w = AM_WIDTH, h = AM_HEIGHT) {
  let c0 = outcode(x0, y0, w, h), c1 = outcode(x1, y1, w, h);
  for (let guard = 0; guard < 8; guard++) {
    if (!(c0 | c1)) return [Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1)];
    if (c0 & c1) return null;
    const c = c0 || c1;
    let x, y;
    if (c & BOTTOM) { x = x0 + (x1 - x0) * (h - 1 - y0) / (y1 - y0); y = h - 1; }
    else if (c & TOP) { x = x0 + (x1 - x0) * (0 - y0) / (y1 - y0); y = 0; }
    else if (c & RIGHT) { y = y0 + (y1 - y0) * (w - 1 - x0) / (x1 - x0); x = w - 1; }
    else { y = y0 + (y1 - y0) * (0 - x0) / (x1 - x0); x = 0; }
    if (c === c0) { x0 = x; y0 = y; c0 = outcode(x0, y0, w, h); } else { x1 = x; y1 = y; c1 = outcode(x1, y1, w, h); }
  }
  return null;
}

// Bresenham de 1 pixel; plot(x, y) só é chamado dentro da região.
export function bresenham(x0, y0, x1, y1, plot, w = AM_WIDTH, h = AM_HEIGHT) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, x = x0, y = y0;
  for (;;) {
    if (x >= 0 && x < w && y >= 0 && y < h) plot(x, y);
    if (x === x1 && y === y1) return;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

// Seta do jogador (R = 16 * 8 / 7), em coordenadas locais (+x para a frente).
const R = 16 * 8 / 7;
export const PLAYER_ARROW = [
  [-R + R / 8, 0, R, 0], [R, 0, R - R / 2, R / 4], [R, 0, R - R / 2, -R / 4],
  [-R + R / 8, 0, -R - R / 8, R / 4], [-R + R / 8, 0, -R - R / 8, -R / 4],
  [-R + 3 * R / 8, 0, -R + R / 8, R / 4], [-R + 3 * R / 8, 0, -R + R / 8, -R / 4],
];
// Triângulo das coisas (R = 16).
const T = 16;
export const THING_TRIANGLE = [[-T / 2, -T / 2, T, 0], [T, 0, -T / 2, T / 2], [-T / 2, T / 2, -T / 2, -T / 2]];

// Segmentos de uma figura girada pelo ângulo (graus do Doom) e transladada para (x, y), no mundo.
export function figureSegments(figure, x, y, angleDeg) {
  const a = angleDeg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return figure.map(([ax, ay, bx, by]) => [x + ax * c - ay * s, y + ax * s + ay * c, x + bx * c - by * s, y + bx * s + by * c]);
}

// buffer: { width, height, data } (camada 320x200 RGBA); state: AutomapState; map: alturas correntes;
// player: { x, y, angle }; things: [{ x, y, angle }] (só com cheat 2); colors: automapColors(paleta);
// font e text: nome do mapa no canto inferior esquerdo (drawText do menu).
export function drawAutomap(buffer, state, map, player, things, colors, label = null) {
  const { data, width } = buffer;
  // Fundo preto opaco nas linhas 0 a 167.
  for (let i = 0; i < width * AM_HEIGHT * 4; i += 4) { data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 255; }
  const plotWith = (color) => (x, y) => {
    const o = (y * width + x) * 4;
    data[o] = color.rgb[0]; data[o + 1] = color.rgb[1]; data[o + 2] = color.rgb[2]; data[o + 3] = 255;
  };
  const worldLine = (x0, y0, x1, y1, color) => {
    const [a, b] = state.toScreen(x0, y0), [c, d] = state.toScreen(x1, y1);
    const clipped = clipLine(a, b, c, d);
    if (clipped) bresenham(...clipped, plotWith(color));
  };
  // Grade a cada 128 unidades (alinhada aos múltiplos de 128, não ao BLOCKMAP), antes das linhas.
  if (state.grid) {
    const half = { x: AM_WIDTH / 2 / state.scale, y: AM_HEIGHT / 2 / state.scale };
    const x0 = Math.floor((state.centerX - half.x) / GRID_SIZE) * GRID_SIZE, x1 = state.centerX + half.x;
    const y0 = Math.floor((state.centerY - half.y) / GRID_SIZE) * GRID_SIZE, y1 = state.centerY + half.y;
    for (let x = x0; x <= x1; x += GRID_SIZE) worldLine(x, state.centerY - half.y, x, y1, colors.grid);
    for (let y = y0; y <= y1; y += GRID_SIZE) worldLine(state.centerX - half.x, y, x1, y, colors.grid);
  }
  for (let li = 0; li < map.linedefs.length; li++) {
    const kind = lineColorKind(map, li, state.mapped, state.cheat, state.allmap);
    if (!kind) continue;
    const l = map.linedefs[li];
    const a = map.vertexes[l.v1], b = map.vertexes[l.v2];
    worldLine(a.x, a.y, b.x, b.y, colors[kind]);
  }
  if (state.cheat >= 2) {
    for (const t of things) for (const s of figureSegments(THING_TRIANGLE, t.x, t.y, t.angle)) worldLine(...s, colors.thing);
  }
  for (const s of figureSegments(PLAYER_ARROW, player.x, player.y, player.angle)) worldLine(...s, colors.player);
  if (!state.follow) plotWith(colors.player)(AM_WIDTH / 2, AM_HEIGHT / 2); // mira
  label?.();
}
