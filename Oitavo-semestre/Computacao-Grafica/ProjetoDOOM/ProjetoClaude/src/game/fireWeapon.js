// Um evento "fire" da máquina de armas vira hitscans, sangue, fumaça e dano. Puro (sem DOM e sem
// WebGPU), para ser verificado no Node. Coordenadas do Doom.

import { shoot } from './hitscan.js';
import { PUFF_BACKOFF } from './effects.js';
import { shotsFor } from './weapons.js';

// ev: { weapon, refire }; ctx: { world, origin {x, y, z} (olho), yaw e pitch (graus), monsters (lista
// atirável), rng, effects (EffectList), lightAt(x, y), damage(monstro, valor) }.
// Devolve { hit (algum projétil acertou monstro ou barril), results (um por projétil) }.
export function fireWeapon(ev, ctx) {
  const { world, origin, pitch, rng, effects } = ctx;
  const results = [];
  let hit = false;
  for (const s of shotsFor(ev.weapon, ev.refire, ctx.yaw, rng)) {
    const r = shoot(world, origin, s.yaw, pitch, s.range, ctx.monsters);
    results.push({ ...r, damage: s.damage, yaw: s.yaw });
    if (r.kind === 'monster') {
      hit = true;
      const blood = effects.spawnBlood(r.x, r.y, r.z, s.damage, rng);
      blood.lightnum = ctx.lightAt(r.x, r.y);
      ctx.damage(r.monster, s.damage);
    } else if ((r.kind === 'wall' || r.kind === 'plane') && !r.sky) {
      // Fumaça 4 unidades antes do ponto de batida, ao longo do raio (sem fumaça no céu, como no Doom);
      // no soco, começa no quadro C.
      const t = Math.max(0, r.t - PUFF_BACKOFF);
      const a = s.yaw * Math.PI / 180;
      const x = origin.x + Math.cos(a) * t, y = origin.y + Math.sin(a) * t;
      const puff = effects.spawnPuff(x, y, origin.z + Math.tan(pitch * Math.PI / 180) * t, rng, { melee: s.melee });
      puff.lightnum = ctx.lightAt(x, y);
    }
  }
  return { hit, results };
}
