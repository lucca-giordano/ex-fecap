// Regras de coleta (P_TouchSpecialThing, P_GiveBody, P_GiveArmor, P_GiveAmmo, P_GiveWeapon do Doom).
// Puro. tryPickup só altera `stats` quando o item é pego.

import { CLIP_AMMO, AMMO_TYPES, BONUS_ADD, MAX_HEALTH, MAX_ARMOR, ARMOR_GREEN, ARMOR_BLUE } from './PlayerStats.js';

// Dá munição: n clips (0 = meio clip, como o P_GiveAmmo). Devolve false se já estava no máximo.
export function giveAmmo(stats, type, clips) {
  if (stats.ammo[type] >= stats.maxAmmoOf(type)) return false;
  const amount = clips > 0 ? clips * CLIP_AMMO[type] : Math.floor(CLIP_AMMO[type] / 2);
  stats.addAmmo(amount, type);
  return true;
}

// Devolve true se o item seria pego, aplicando o efeito.
function apply(def, stats, dropped) {
  const p = def.params;
  switch (def.kind) {
    case 'health':
      if (p.needBelow !== undefined && stats.health >= p.needBelow) return false;
      stats.health = Math.min(p.limit, stats.health + p.amount);
      return true;
    case 'megasphere':
      stats.health = MAX_HEALTH;
      stats.armor = MAX_ARMOR;
      stats.armorType = ARMOR_BLUE;
      return true;
    case 'armorBonus':
      stats.armor = Math.min(p.limit, stats.armor + p.amount);
      if (stats.armorType === 0) stats.armorType = ARMOR_GREEN;
      return true;
    case 'armor':
      if (stats.armor >= p.armor) return false;
      stats.armor = p.armor;
      stats.armorType = p.type;
      return true;
    case 'ammo':
      // Caixa pequena de balas largada: meio clip (5 balas).
      return giveAmmo(stats, p.ammo, dropped && def.messageKey === 'clip' ? 0 : p.clips);
    case 'backpack':
      if (!stats.hasBackpack) stats.hasBackpack = true; // dobra os máximos
      for (const type of AMMO_TYPES) giveAmmo(stats, type, 1);
      return true; // sempre pega
    case 'weapon': {
      // A motosserra divide o slot 1 com o soco (sempre possuído): tem o próprio campo.
      const owned = p.chainsaw ? stats.hasChainsaw : stats.weaponsOwned.has(p.slot);
      const gaveAmmo = p.ammo ? giveAmmo(stats, p.ammo, dropped ? 1 : 2) : false;
      if (owned) return gaveAmmo; // já possuída: só pega se ganhou munição
      stats.weaponsOwned.add(p.slot);
      if (p.chainsaw) stats.hasChainsaw = true;
      return true;
    }
    case 'key':
      if (stats.keys[p.key]) return false;
      stats.keys[p.key] = true;
      return true;
    default:
      return false;
  }
}

// def: entrada de ITEM_TABLE. Devolve { pickedUp, messageKey, sound }.
export function tryPickup(def, stats, { dropped = false } = {}) {
  const pickedUp = apply(def, stats, dropped);
  if (pickedUp) stats.bonusCount += BONUS_ADD;
  return { pickedUp, messageKey: def.messageKey, sound: def.sound };
}
