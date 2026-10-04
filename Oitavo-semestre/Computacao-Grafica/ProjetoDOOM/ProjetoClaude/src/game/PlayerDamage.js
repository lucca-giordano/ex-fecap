// Dano ao jogador, na ordem do P_DamageMobj do Doom (etapa 19). Puro.

import { ARMOR_NONE, MAX_DAMAGE_COUNT, MIN_HEALTH } from './PlayerStats.js';

export const OVERKILL_HI = -50; // vida final abaixo disso: som de morte "pdiehi" (Doom: health < -50)

// stats: PlayerStats; attacker: { x, y } ou null (barril, dano de teste); source: 'POSS', 'BAR1', ...;
// rng: { next255() }. Devolve { applied, savedByArmor, died, events } com events em
// [{ type: 'playerPain' }] ou [{ type: 'playerDied', overkill }].
export function applyDamage(stats, amount, attacker, source, rng, godMode = false) {
  const none = { applied: 0, savedByArmor: 0, died: false, events: [] };
  if (godMode || stats.isDead || amount <= 0) return none;
  amount = Math.trunc(amount);
  // 1. Armadura: verde absorve 1/3, azul 1/2 (divisão inteira); se acabar, o tipo zera.
  let saved = 0;
  if (stats.armorType !== ARMOR_NONE) {
    saved = stats.armorType === 1 ? Math.floor(amount / 3) : Math.floor(amount / 2);
    if (stats.armor <= saved) {
      saved = stats.armor;
      stats.armorType = ARMOR_NONE;
    }
    stats.armor -= saved;
    amount -= saved;
  }
  // 2. Vida (pode ficar negativa), contador do flash e atacante.
  stats.health = Math.max(MIN_HEALTH, stats.health - amount);
  stats.damageCount = Math.min(MAX_DAMAGE_COUNT, stats.damageCount + amount);
  stats.lastAttacker = attacker ? { x: attacker.x, y: attacker.y } : null;
  // 3. Morte ou dor (o Doom toca o som de dor quase sempre: P_Random() < painchance 255).
  const events = [];
  if (stats.isDead) {
    stats.deathTics = 0;
    events.push({ type: 'playerDied', overkill: stats.health, source });
  } else if (rng.next255() < 255) {
    events.push({ type: 'playerPain', source });
  }
  return { applied: amount, savedByArmor: saved, died: stats.isDead, events };
}

// Som da morte: "pdiehi" com overkill abaixo de -50 (se o lump existir), senão "pldeth".
export function deathSound(overkill, hasSound) {
  return overkill < OVERKILL_HI && hasSound('pdiehi') ? 'pdiehi' : 'pldeth';
}
