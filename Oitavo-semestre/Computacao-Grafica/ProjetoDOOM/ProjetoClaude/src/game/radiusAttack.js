// Dano em raio (explosão do barril), como o P_RadiusAttack do Doom. Puro.
// dist = max(|dx|, |dy|) - raio do alvo (mínimo 0); sem efeito se dist >= danoMax; dano = danoMax - dist.
//
// Linha de visão (aproximação do P_CheckSight): o segmento 2D entre os centros não pode cruzar uma linha
// de um lado só nem uma de dois lados com abertura <= 0 (porta fechada). Alturas não são consideradas.

export const BARREL_DAMAGE = 128;

function segmentsCross(ax, ay, bx, by, l) {
  const side = (px, py, qx, qy, rx, ry) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
  const d1 = side(l.x1, l.y1, l.x2, l.y2, ax, ay), d2 = side(l.x1, l.y1, l.x2, l.y2, bx, by);
  const d3 = side(ax, ay, bx, by, l.x1, l.y1), d4 = side(ax, ay, bx, by, l.x2, l.y2);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

// world: { lines, sectors }. a e b: { x, y }.
export function hasLineOfSight(world, a, b) {
  for (const l of world.lines) {
    if (Math.max(a.x, b.x) < l.minX || Math.min(a.x, b.x) > l.maxX || Math.max(a.y, b.y) < l.minY || Math.min(a.y, b.y) > l.maxY) continue;
    if (!segmentsCross(a.x, a.y, b.x, b.y, l)) continue;
    if (l.oneSided) return false;
    const f = world.sectors[l.front], k = world.sectors[l.back];
    if (Math.min(f.ceilingHeight, k.ceilingHeight) - Math.max(f.floorHeight, k.floorHeight) <= 0) return false;
  }
  return true;
}

export function blastDamage(center, target, radius, damageMax) {
  const dist = Math.max(0, Math.max(Math.abs(target.x - center.x), Math.abs(target.y - center.y)) - radius);
  return dist >= damageMax ? 0 : damageMax - dist;
}

// center: { x, y }; source: o barril que explode (não recebe o próprio dano); monsters: lista do
// MonsterSystem; callbacks: { damage(monstro, valor, fonte), onPlayerDamaged(valor, fonte), player: { x, y, radius } }.
// Devolve [{ target, amount }] com os danos aplicados (o do jogador só é informado, não aplicado).
export function radiusAttack(world, center, damageMax = BARREL_DAMAGE, source, monsters, rng, callbacks = {}) {
  const applied = [];
  for (const m of monsters) {
    if (m === source || !m.shootable) continue;
    const amount = blastDamage(center, m, m.entry.radius, damageMax);
    if (amount <= 0 || !hasLineOfSight(world, center, m)) continue;
    callbacks.damage?.(m, amount, source);
    applied.push({ target: m, amount });
  }
  const p = callbacks.player;
  if (p) {
    const amount = blastDamage(center, p, p.radius, damageMax);
    if (amount > 0 && hasLineOfSight(world, center, p)) {
      callbacks.onPlayerDamaged?.(amount, source);
      applied.push({ target: 'player', amount });
    }
  }
  return applied;
}
