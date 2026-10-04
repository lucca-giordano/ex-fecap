// Tiro instantâneo (hitscan) em 3D. Puro. Coordenadas do Doom (x leste, y norte, z para cima);
// ângulos em graus anti-horários, 0 = leste. O alcance vale para a distância horizontal t ao longo do
// raio: d2 = (cos yaw, sin yaw), z(t) = z0 + tan(pitch) * t. Sem mira automática vertical.

import { findSector } from '../map/bsp.js';

export const MISSILE_RANGE = 2048; // alcance da pistola (Doom: MISSILERANGE = 32*64)
const SKY = 'F_SKY1';
const EPS = 1e-9;

// Interseção do raio 2D (o + t*d, t em (0, range]) com o segmento da linha.
// Devolve { t, fromFront } ou null; fromFront: a origem está do lado direito (frente) da linha.
export function rayLineIntersection(ox, oy, dx, dy, line, range) {
  const ex = line.x2 - line.x1, ey = line.y2 - line.y1;
  const denom = dx * ey - dy * ex;
  if (Math.abs(denom) < EPS) return null; // paralelos
  const wx = line.x1 - ox, wy = line.y1 - oy;
  const t = (wx * ey - wy * ex) / denom;
  const u = (wx * dy - wy * dx) / denom;
  if (t <= EPS || t > range || u < 0 || u > 1) return null;
  // Lado da origem: à direita de v1 -> v2 quando ex*(oy - y1) - ey*(ox - x1) < 0.
  const fromFront = ex * (oy - line.y1) - ey * (ox - line.x1) < 0;
  return { t, fromFront };
}

// Menor t >= 0 em que o raio 2D entra no círculo (centro cx, cy; raio r), ou null.
export function rayCircleT(ox, oy, dx, dy, cx, cy, r) {
  const fx = ox - cx, fy = oy - cy;
  const b = fx * dx + fy * dy;
  const c = fx * fx + fy * fy - r * r;
  const disc = b * b - c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t1 = -b - s, t2 = -b + s;
  if (t2 < 0) return null;            // círculo atrás da origem
  return t1 >= 0 ? t1 : t2;           // origem dentro do círculo: a saída é o menor t >= 0
}

// Batida num cilindro (monstro): t e z da entrada no círculo, se z(t) estiver entre o chão e o topo.
export function rayCylinder(o, d, slope, cx, cy, radius, floorZ, height, range) {
  const t = rayCircleT(o.x, o.y, d.x, d.y, cx, cy, radius);
  if (t === null || t > range) return null;
  const z = o.z + slope * t;
  if (z < floorZ || z > floorZ + height) return null;
  return { t, z };
}

// world: { map, lines (dados de linhas da física), sectors }.
// Devolve { kind: 'monster' | 'wall' | 'plane' | 'none', t, x, y, z, monster, line, sky }.
export function shoot(world, origin, yawDeg, pitchDeg, range, monsters) {
  const yaw = yawDeg * Math.PI / 180;
  const d = { x: Math.cos(yaw), y: Math.sin(yaw) };
  const slope = Math.tan(pitchDeg * Math.PI / 180);
  const zAt = (t) => origin.z + slope * t;
  const point = (t, extra) => ({ t, x: origin.x + d.x * t, y: origin.y + d.y * t, z: zAt(t), monster: null, line: null, sky: false, ...extra });

  // 1. Cruzamentos com todas as linhas (força bruta), ordenados por t.
  const crossings = [];
  for (const line of world.lines) {
    const hit = rayLineIntersection(origin.x, origin.y, d.x, d.y, line, range);
    if (hit) crossings.push({ ...hit, line });
  }
  crossings.sort((a, b) => a.t - b.t);

  // Piso ou teto do setor atual entre tFrom e tTo: devolve a batida no plano ou null.
  const planeHit = (sector, tFrom, tTo) => {
    if (slope < 0 && zAt(tTo) < sector.floorHeight) {
      const t = (sector.floorHeight - origin.z) / slope;
      if (t >= tFrom - EPS) return point(Math.max(t, 0), { kind: 'plane' });
    }
    if (slope > 0 && zAt(tTo) > sector.ceilingHeight) {
      const t = (sector.ceilingHeight - origin.z) / slope;
      if (t >= tFrom - EPS) return point(Math.max(t, 0), { kind: 'plane', sky: sector.ceilingTexture === SKY });
    }
    return null;
  };

  // 2. Percurso pelos setores: planos antes de cada cruzamento; parede ou abertura no cruzamento.
  let sector = world.sectors[findSector(world.map, origin.x, origin.y)];
  let block = null;
  let tPrev = 0;
  for (const c of crossings) {
    block = sector && planeHit(sector, tPrev, c.t);
    if (block) break;
    const { line } = c;
    if (line.oneSided) { block = point(c.t, { kind: 'wall', line }); break; }
    const f = world.sectors[line.front], b = world.sectors[line.back];
    const openBottom = Math.max(f.floorHeight, b.floorHeight);
    const openTop = Math.min(f.ceilingHeight, b.ceilingHeight);
    const z = zAt(c.t);
    if (z < openBottom || z > openTop) { block = point(c.t, { kind: 'wall', line }); break; }
    sector = c.fromFront ? b : f; // passou para o outro lado
    tPrev = c.t;
  }
  if (!block && sector) block = planeHit(sector, tPrev, range);
  const tBlock = block ? block.t : Infinity;

  // 3. Monstros atiráveis: o cilindro mais próximo antes da parede ou do plano.
  let best = null;
  for (const m of monsters) {
    if (!m.shootable) continue;
    const hit = rayCylinder(origin, d, slope, m.x, m.y, m.entry.radius, m.floorZ, m.entry.height, range);
    if (hit && hit.t < tBlock && (!best || hit.t < best.t)) best = point(hit.t, { kind: 'monster', monster: m, z: hit.z });
  }
  if (best) return best;
  if (block) return block;
  return { kind: 'none', t: range, x: origin.x + d.x * range, y: origin.y + d.y * range, z: zAt(range), monster: null, line: null, sky: false };
}
