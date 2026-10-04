// Itens coletáveis: tipo do THING -> { kind, params, counts, messageKey, sound }. Puro.
// Valores de partida do p_inter.c do Doom (lembrados de memória). counts: entra na contagem de itens.
// Sprites: thingTable.js (conferidos contra o WAD por tools/check-items.mjs).

const SOUND_ITEM = 'itemup';
const SOUND_WEAPON = 'wpnup';

const item = (kind, params, messageKey, counts = false, sound = SOUND_ITEM) => ({ kind, params, counts, messageKey, sound });

export const ITEM_TABLE = {
  // Saúde e armadura
  2011: item('health', { amount: 10, limit: 100, needBelow: 100 }, 'stimpack'),
  2012: item('health', { amount: 25, limit: 100, needBelow: 100 }, 'medikit'),
  2014: item('health', { amount: 1, limit: 200 }, 'healthBonus', true),
  2013: item('health', { amount: 100, limit: 200 }, 'soulsphere', true),
  83: item('megasphere', {}, 'megasphere', true),
  2015: item('armorBonus', { amount: 1, limit: 200 }, 'armorBonus', true),
  2018: item('armor', { armor: 100, type: 1 }, 'greenArmor', true),
  2019: item('armor', { armor: 200, type: 2 }, 'blueArmor', true),
  // Munição: clips * tamanho do clip do tipo
  2007: item('ammo', { ammo: 'clip', clips: 1 }, 'clip'),
  2048: item('ammo', { ammo: 'clip', clips: 5 }, 'ammoBox'),
  2008: item('ammo', { ammo: 'shell', clips: 1 }, 'shells'),
  2049: item('ammo', { ammo: 'shell', clips: 5 }, 'shellBox'),
  2010: item('ammo', { ammo: 'rocket', clips: 1 }, 'rocket'),
  2046: item('ammo', { ammo: 'rocket', clips: 5 }, 'rocketBox'),
  2047: item('ammo', { ammo: 'cell', clips: 1 }, 'cell'),
  17: item('ammo', { ammo: 'cell', clips: 5 }, 'cellPack'),
  8: item('backpack', {}, 'backpack'),
  // Armas: 2 clips de munição (1 se largada por um monstro)
  2001: item('weapon', { slot: 3, ammo: 'shell' }, 'shotgun', false, SOUND_WEAPON),
  2002: item('weapon', { slot: 4, ammo: 'clip' }, 'chaingun', false, SOUND_WEAPON),
  2003: item('weapon', { slot: 5, ammo: 'rocket' }, 'rocketLauncher', false, SOUND_WEAPON),
  2004: item('weapon', { slot: 6, ammo: 'cell' }, 'plasma', false, SOUND_WEAPON),
  2006: item('weapon', { slot: 7, ammo: 'cell' }, 'bfg', false, SOUND_WEAPON),
  2005: item('weapon', { slot: 1, ammo: null, chainsaw: true }, 'chainsaw', false, SOUND_WEAPON),
  // Chaves
  5: item('key', { key: 'blueCard' }, 'blueCard'),
  6: item('key', { key: 'yellowCard' }, 'yellowCard'),
  13: item('key', { key: 'redCard' }, 'redCard'),
  40: item('key', { key: 'blueSkull' }, 'blueSkull'),
  39: item('key', { key: 'yellowSkull' }, 'yellowSkull'),
  38: item('key', { key: 'redSkull' }, 'redSkull'),
};
// Fora desta etapa (poderes temporários; continuam como decoração): 2022, 2023, 2024, 2025, 2026, 2045.

// Itens largados por monstros: tipo do monstro -> tipo do item.
export const MONSTER_DROPS = { 3004: 2007, 9: 2001, 65: 2002 };
// Sprites dos itens largados, sempre incluídos na textura de sprites.
export const DROP_SPRITES = [{ prefix: 'CLIP', letter: 'A' }, { prefix: 'SHOT', letter: 'A' }, { prefix: 'MGUN', letter: 'A' }];
