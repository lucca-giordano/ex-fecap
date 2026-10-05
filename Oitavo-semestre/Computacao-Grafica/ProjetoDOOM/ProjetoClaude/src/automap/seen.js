// Linhas vistas pelo jogador (etapa 22), para o automapa. Puro.
// Aproximação do "mapeado ao desenhar" do Doom: raios 2D no campo de visão horizontal, que marcam toda
// linha cruzada e só continuam por linhas de dois lados com o olho dentro da abertura corrente.

import { rayLineIntersection } from '../game/hitscan.js';

export const SEEN_RAYS = 192;
export const EYE = 41;
const FAR = 1e7; // sem limite de alcance

// Campo de visão horizontal (graus) para o aspecto da projeção: 2 * atan(0.75 * aspecto).
export const hfovDeg = (aspect) => 2 * Math.atan(0.75 * aspect) * 180 / Math.PI;

// Linhas de cada setor (índices em world.lines), calculadas uma vez por mundo.
const sectorLinesCache = new WeakMap();
function linesOfSector(world, s) {
  if (!sectorLinesCache.has(world)) {
    const lists = world.sectors.map(() => []);
    for (const l of world.lines) {
      lists[l.front]?.push(l.index);
      if (!l.oneSided) lists[l.back]?.push(l.index);
    }
    sectorLinesCache.set(world, lists);
  }
  return sectorLinesCache.get(world)[s] ?? [];
}

// world: { lines (com index = número da linedef), sectors }; mapped: Uint8Array por linedef;
// player: { x, y, z (pés), angle (graus do Doom) }; sector: setor do jogador (ou -1).
// Devolve quantas linhas novas foram marcadas.
export function markSeen(world, mapped, player, fovDeg, sector = -1, rays = SEEN_RAYS) {
  let added = 0;
  const mark = (i) => { if (!mapped[i]) { mapped[i] = 1; added++; } };
  const eyeZ = player.z + EYE;
  const hits = [];
  for (let r = 0; r < rays; r++) {
    // Raios igualmente espaçados de +fov/2 (esquerda) a -fov/2 (direita).
    const a = (player.angle + fovDeg / 2 - (fovDeg * (r + 0.5)) / rays) * Math.PI / 180;
    const dx = Math.cos(a), dy = Math.sin(a);
    hits.length = 0;
    for (const line of world.lines) {
      const h = rayLineIntersection(player.x, player.y, dx, dy, line, FAR);
      if (h) hits.push([h.t, line]);
    }
    hits.sort((p, q) => p[0] - q[0]);
    for (const [, line] of hits) {
      mark(line.index);
      if (line.oneSided) break;
      const f = world.sectors[line.front], b = world.sectors[line.back];
      const bottom = Math.max(f.floorHeight, b.floorHeight), top = Math.min(f.ceilingHeight, b.ceilingHeight);
      if (eyeZ < bottom || eyeZ > top) break; // o olho fora da abertura: para
    }
  }
  if (sector >= 0) for (const i of linesOfSector(world, sector)) mark(i);
  return added;
}
