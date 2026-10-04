// Linha de visão do monstro ao jogador, como o P_CheckSight / P_CrossSubsector do Doom, só que
// percorrendo as linhas cruzadas em ordem de distância (sem BSP e sem tabela de rejeição). Puro.
// Coordenadas do Doom.

const EPS = 1e-9;

// Fração u (0..1) ao longo de a->b em que o segmento cruza a linha, ou null.
// Cruzamento inclui as pontas da linha, como o P_InterceptVector2 com as divisões de lado do Doom.
function crossFraction(ax, ay, bx, by, l) {
  const dx = bx - ax, dy = by - ay;
  const ex = l.x2 - l.x1, ey = l.y2 - l.y1;
  const denom = dx * ey - dy * ex;
  if (Math.abs(denom) < EPS) return null; // paralelos
  const wx = l.x1 - ax, wy = l.y1 - ay;
  const u = (wx * ey - wy * ex) / denom; // ao longo da visão
  const v = (wx * dy - wy * dx) / denom; // ao longo da linha
  if (u <= EPS || u >= 1 - EPS || v < 0 || v > 1) return null;
  return u;
}

// world: { lines, sectors }. eye: { x, y, z } (olho do monstro, pés + altura * 0.75);
// target: { x, y, z (pés), height }. Devolve true se há visão.
export function checkSight(world, eye, target) {
  const dist = Math.hypot(target.x - eye.x, target.y - eye.y);
  if (dist < EPS) return true;
  let topSlope = (target.z + target.height - eye.z) / dist;
  let bottomSlope = (target.z - eye.z) / dist;
  const minX = Math.min(eye.x, target.x), maxX = Math.max(eye.x, target.x);
  const minY = Math.min(eye.y, target.y), maxY = Math.max(eye.y, target.y);
  const hits = [];
  for (const l of world.lines) {
    if (l.maxX < minX || l.minX > maxX || l.maxY < minY || l.minY > maxY) continue;
    const u = crossFraction(eye.x, eye.y, target.x, target.y, l);
    if (u !== null) hits.push({ u, l });
  }
  hits.sort((a, b) => a.u - b.u);
  for (const { u, l } of hits) {
    if (l.oneSided) return false;
    const f = world.sectors[l.front], b = world.sectors[l.back];
    const openBottom = Math.max(f.floorHeight, b.floorHeight);
    const openTop = Math.min(f.ceilingHeight, b.ceilingHeight);
    if (openTop - openBottom <= 0) return false; // porta fechada
    const d = u * dist; // distância até a linha
    if (f.floorHeight !== b.floorHeight) bottomSlope = Math.max(bottomSlope, (openBottom - eye.z) / d);
    if (f.ceilingHeight !== b.ceilingHeight) topSlope = Math.min(topSlope, (openTop - eye.z) / d);
    if (topSlope <= bottomSlope) return false;
  }
  return true;
}
