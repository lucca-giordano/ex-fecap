// Itens do mapa e itens largados por monstros: alcance de coleta, drops e contadores. Puro.
// Coordenadas do Doom. Atualizado uma vez por tic de jogo (35/s).

import { ITEM_TABLE, MONSTER_DROPS } from './itemTable.js';
import { tryPickup } from './pickups.js';
import { AMMO_TYPES } from './PlayerStats.js';

export const MAX_DROPS = 128;
export const PICKUP_REACH = 20;        // raio dos itens (mobjinfo do Doom)
export const PICKUP_BELOW = -8;        // item até 8 abaixo dos pés
export const PICKUP_ABOVE = 56;        // item até 56 acima dos pés (altura do jogador)

// Alcance como o PIT_CheckThing: caixa (não círculo) e diferença de altura entre -8 e 56.
export function inReach(item, player, playerRadius) {
  const reach = PICKUP_REACH + playerRadius;
  if (Math.abs(item.x - player.x) >= reach || Math.abs(item.y - player.y) >= reach) return false;
  const dz = item.floorZ - player.z;
  return dz >= PICKUP_BELOW && dz <= PICKUP_ABOVE;
}

export class ItemSystem {
  // objects: objetos do mapa (já filtrados pela dificuldade), com { index, x, y, base };
  // typeOf(obj) -> tipo do THING; floorAt(x, y) -> altura do chão; playerRadius: raio do jogador.
  constructor(objects, typeOf, floorAt, playerRadius) {
    this.floorAt = floorAt;
    this.playerRadius = playerRadius;
    this.items = [];
    for (const obj of objects) {
      const type = typeOf(obj);
      if (!ITEM_TABLE[type]) continue;
      this.items.push({ id: `map:${obj.index}`, objIndex: obj.index, type, x: obj.x, y: obj.y, floorZ: obj.base[1], dropped: false, collected: false });
    }
    this.byObject = new Map(this.items.map((it) => [it.objIndex, it]));
    this.totalCountable = this.items.filter((it) => ITEM_TABLE[it.type].counts).length;
    this.drops = [];
    this.dropSeq = 0;
    this.seenDeaths = new Set();
    this.reset();
  }

  reset() {
    for (const it of this.items) it.collected = false;
    this.drops = [];
    this.seenDeaths.clear();
    this.collectedCountable = 0;
  }

  isCollected(objIndex) {
    return this.byObject.get(objIndex)?.collected ?? false;
  }

  // Evento "died" do MonsterSystem: cria o item largado (uma vez por morte).
  // event: { type: 'died', monsterType, x, y, thingIndex }.
  onMonsterDied(event) {
    const dropType = MONSTER_DROPS[event.monsterType];
    if (!dropType) return null;
    const key = event.thingIndex ?? `${event.x},${event.y}`;
    if (this.seenDeaths.has(key)) return null; // o mesmo evento repetido não duplica
    this.seenDeaths.add(key);
    const drop = { id: `drop:${++this.dropSeq}`, type: dropType, x: event.x, y: event.y,
      floorZ: this.floorAt(event.x, event.y), dropped: true, collected: false };
    this.drops.push(drop);
    if (this.drops.length > MAX_DROPS) this.drops.shift(); // descarta o mais antigo
    return drop;
  }

  // Um tic: tenta pegar cada item ao alcance. player: { x, y, z (pés) }. Devolve eventos "pickup"
  // { messageKey, sound, item, weaponGained (slot novo ou null), ammoFromZero (tipos que estavam em 0) }.
  update(player, stats) {
    const events = [];
    if (stats.isDead) return events;
    for (const list of [this.items, this.drops]) {
      for (const it of list) {
        if (it.collected || !inReach(it, player, this.playerRadius)) continue;
        const def = ITEM_TABLE[it.type];
        const ammoBefore = { ...stats.ammo };
        const ownedBefore = new Set(stats.weaponsOwned);
        const r = tryPickup(def, stats, { dropped: it.dropped });
        if (!r.pickedUp) continue; // não pego (ex.: vida cheia): fica no mapa
        it.collected = true;
        if (def.counts && !it.dropped) this.collectedCountable++;
        // Gancho da troca automática de arma (etapa 17): arma nova e tipos de munição que saíram do zero.
        const gained = def.kind === 'weapon' && !def.params.chainsaw && !ownedBefore.has(def.params.slot) ? def.params.slot : null;
        const ammoFromZero = AMMO_TYPES.filter((t) => ammoBefore[t] === 0 && stats.ammo[t] > 0);
        events.push({ type: 'pickup', messageKey: r.messageKey, sound: r.sound, item: it, weaponGained: gained, ammoFromZero });
      }
    }
    if (this.drops.some((d) => d.collected)) this.drops = this.drops.filter((d) => !d.collected);
    return events;
  }
}
