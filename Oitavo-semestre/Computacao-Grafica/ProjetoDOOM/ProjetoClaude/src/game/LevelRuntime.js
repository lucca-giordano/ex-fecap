// Estado de execução de um nível (etapa 23): fase (LevelState), monstros e IA, itens, efeitos,
// projéteis, sólidos, automapa e o mundo da física, criados a partir de LevelData. Puro (sem GPU e sem
// DOM): o áudio, o dano ao jogador e a posição dele chegam como funções em `deps`.
// A lógica é a mesma que ficava no main.js das etapas 15 a 22.

import { findSector } from '../map/bsp.js';
import { MonsterSystem } from './MonsterSystem.js';
import { MonsterAI, checkPosition } from './MonsterAI.js';
import { ItemSystem } from './ItemSystem.js';
import { EffectList } from './effects.js';
import { CombatStats } from './stats.js';
import { MissileSystem, ROCKET_BLAST, missileTargets } from './Missiles.js';
import { radiusAttack, BARREL_DAMAGE } from './radiusAttack.js';
import { AutomapState } from '../automap/AutomapState.js';
import { staticSolids, getSolids, SOLID_DECORATION } from '../physics/solids.js';
import { SECRET_SECTOR } from './LevelData.js';
import { PLAYER_RADIUS } from '../physics/collision.js';

// deps: { rng, aiEnabled(), noTarget(), sound(nome, { origin, x, y }), damagePlayer(valor, origem, tipo,
//   atacante), playerFeet() -> { x, y, z, alive }, playerTarget() -> { x, y, radius }, useDoor(m, linha),
//   skillParams (etapa 23, opcional: skill.js) }.
export function createLevelRuntime(data, deps) {
  const { map } = data;
  const objects = data.spriteScene?.objects ?? [];
  const level = data.levelState;
  const physicsWorld = { map, lines: data.collisionLines, sectors: map.sectors, spawn: { x: data.spawn.x, y: data.spawn.y },
    lineSpecial: level.lineSpecial }; // etapa 20: spechit dos monstros
  const rng = deps.rng;
  const thingType = (obj) => map.things[obj.index].type;
  const thingSound = (name, m) => deps.sound(name, { origin: `thing:${m.thingIndex}`, x: m.x, y: m.y });

  const fixedSolids = staticSolids(objects, thingType); // decoração sólida (etapa 16)

  // --- Monstros, efeitos e contadores (etapa 15) ---
  const effects = new EffectList();
  const combat = new CombatStats();
  const monsters = new MonsterSystem(objects, data.monsterTable.entries, thingType, rng, {
    onSound: thingSound,
    skillParams: deps.skillParams, // etapa 23
    // Etapa 23 (Nightmare): volta só se o ponto de início estiver livre (linhas, monstros, decoração e jogador).
    canRespawn: (m) => {
      const solids = getSolids([], monsters.monsters, fixedSolids);
      const f = deps.playerFeet();
      if (f.alive) solids.push({ x: f.x, y: f.y, radius: PLAYER_RADIUS });
      return checkPosition(physicsWorld, m.spawn.x, m.spawn.y, m.entry.radius, solids).ok;
    },
    // Névoa e "telept" no corpo e no ponto de início.
    onRespawn: (m, from) => {
      for (const at of [from, m]) {
        effects.spawnFog(at.x, at.y, at.floorZ);
        deps.sound('telept', { origin: `fog:${m.thingIndex}:${at === m ? 'b' : 'a'}`, x: at.x, y: at.y });
      }
    },
    onKill: (m) => { combat.kills++; deps.onKill?.(m); },
    // Barril no quadro C: dano em raio a partir do centro dele (reação em cadeia acontece sozinha).
    onExplode: (m) => radiusAttack(physicsWorld, m, BARREL_DAMAGE, m, monsters.monsters, rng, {
      damage: (target, amount) => monsters.damage(target, amount),
      onPlayerDamaged: (amount) => deps.damagePlayer(amount, 'BAR1', 'explosion', null),
      player: deps.playerTarget(),
    }),
  });
  combat.totalMonsters = monsters.totalMonsters;

  // --- Itens e sólidos (etapa 16) ---
  const floorAt = (x, y) => map.sectors[findSector(map, x, y)]?.floorHeight ?? 0;
  const itemSystem = new ItemSystem(objects, thingType, floorAt, PLAYER_RADIUS);
  // Etapa 20: setor de cada item (elevadores mudam o floorZ) e objetos em setores móveis (sprites).
  for (const it of itemSystem.items) { it.sector = findSector(map, it.x, it.y); it.origFloorZ = it.floorZ; }
  const liftSectorOf = new Map();
  for (const obj of objects) {
    const s = findSector(map, obj.x, obj.y);
    if (data.dynSets.sectors.has(s)) liftSectorOf.set(obj.index, s);
  }
  // Decoração sólida como alvo de projétil: altura 64 por simplificação, no chão do setor (etapa 21).
  const solidTargets = fixedSolids.map((s) => ({ x: s.x, y: s.y, radius: s.radius, height: 64,
    z: map.sectors[findSector(map, s.x, s.y)]?.floorHeight ?? 0 }));
  const amSolids = objects.filter((o) => SOLID_DECORATION[thingType(o)]); // etapa 22: automapa

  // --- Projéteis (etapa 21) ---
  const missileSource = (p) => (p.ownerType === 3003 ? 'BOSS' : 'TROO');
  const missiles = new MissileSystem(physicsWorld, rng, {
    sectorAt: (x, y) => findSector(map, x, y),
    speedOf: deps.skillParams?.missileSpeed, // etapa 23: Nightmare
    // Regra de alvos em missileTargets (Missiles.js): sem infighting, decoração para todos.
    targets: (p) => {
      const f = deps.playerFeet();
      return missileTargets(p, { player: f.alive ? f : null, monsters: monsters.monsters, solids: solidTargets });
    },
    hit: (p, target, amount) => {
      if (target.kind === 'player') {
        const owner = monsters.byObject.get(p.owner);
        const attacker = owner && !owner.removed ? { x: owner.x, y: owner.y } : null; // posição atual do dono
        deps.damagePlayer(amount, missileSource(p), 'missile', attacker);
      } else {
        if (p.owner === 'player') combat.hits++; // acerto: dano direto em monstro ou barril
        monsters.damage(target.ref, amount);
      }
    },
    // A_Explode do foguete: monstros, barris e o próprio jogador (sem atacante).
    blast: (p) => radiusAttack(physicsWorld, { x: p.x, y: p.y }, ROCKET_BLAST, null, monsters.monsters, rng, {
      damage: (target, amount) => monsters.damage(target, amount),
      onPlayerDamaged: (amount) => deps.damagePlayer(amount, 'player', 'explosion', null),
      player: deps.playerTarget(),
    }),
    sound: (name, p) => deps.sound(name, { origin: `missile:${p.id}`, x: p.x, y: p.y }),
  });

  // --- IA dos monstros (etapa 18) ---
  const monsterAI = new MonsterAI({
    world: physicsWorld, rng, player: () => deps.playerFeet(),
    spawnMissile: (m, type) => missiles.spawnFromMonster(m, deps.playerFeet(), type), // etapa 21
    noTarget: () => deps.noTarget(), staticSolids: fixedSolids,
    onSound: thingSound,
    onPlayerDamaged: (amount, source, kind, attacker) => deps.damagePlayer(amount, source, kind, attacker),
    useDoor: (m, li) => deps.useDoor(m, li), // etapa 20: só portas do especial 1
    skillParams: deps.skillParams,
  }).attach(monsters);
  monsters.setAIEnabled(deps.aiEnabled());

  const automap = new AutomapState(map); // etapa 22: só da sessão, zerado a cada nível

  // --- Segredos e estatísticas da fase (etapa 23) ---
  // Cópia do especial de cada setor: o segredo (9) vira 0 quando é achado (os dados do mapa não mudam).
  const sectorSpecial = map.sectors.map((sec) => sec.special);
  let secrets = 0;
  // P_PlayerInSpecialSector: só conta com o jogador vivo e os pés exatamente no chão do setor.
  function checkSecret(x, y, z, alive) {
    if (!alive) return false;
    const s = findSector(map, x, y);
    if (s < 0 || sectorSpecial[s] !== SECRET_SECTOR || z !== map.sectors[s].floorHeight) return false;
    sectorSpecial[s] = 0;
    secrets++;
    return true;
  }
  // { kills, totalKills, items, totalItems, secrets, totalSecrets, tics }. Monstros que voltam no
  // Nightmare não entram no total (as mortes podem passar de 100%, como no Doom).
  const levelStats = () => ({
    kills: combat.kills, totalKills: combat.totalMonsters,
    items: itemSystem.collectedCountable, totalItems: itemSystem.totalCountable,
    secrets, totalSecrets: data.totals.secrets, tics: level.levelTics,
  });

  return {
    data, map, level, physicsWorld, effects, combat, monsters, itemSystem, liftSectorOf, fixedSolids, solidTargets,
    amSolids, missiles, monsterAI, automap, thingType, sectorSpecial, checkSecret, levelStats,
    // Solta as referências (o coletor de lixo libera o resto).
    dispose() {
      missiles.reset();
      effects.reset();
      level.onSectorChanged = null;
      level.onLineChanged = null;
    },
  };
}
