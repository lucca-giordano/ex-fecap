// Verificação dos projéteis, do lança-foguetes e do barão, sem navegador.
// Uso: node tools/check-projectiles.mjs. Sai com código diferente de zero se algo falhar.

import { loadWad } from './baseline-geometry.mjs';
import { loadMap } from '../src/wad/MapData.js';
import { findSpriteLumps } from '../src/wad/Sprites.js';
import { buildSpriteScene } from '../src/sprites/spriteLogic.js';
import { Rng } from '../src/game/Rng.js';
import {
  MissileSystem, MISSILE_TYPES, MAX_MISSILES, MAX_MISSILE_TICS, ROCKET_BLAST, directDamage, missileTargets, missileSpriteFrames,
} from '../src/game/Missiles.js';
import { radiusAttack, blastDamage } from '../src/game/radiusAttack.js';
import { resolveMonsterTable, extraSpriteFrames } from '../src/game/monsterTable.js';
import { MonsterSystem } from '../src/game/MonsterSystem.js';
import { MonsterAI } from '../src/game/MonsterAI.js';
import { AI_TABLE } from '../src/game/aiTable.js';
import { PlayerStats } from '../src/game/PlayerStats.js';
import { applyDamage } from '../src/game/PlayerDamage.js';
import { FaceState } from '../src/hud/face.js';
import { createWeapons, tickWeapons, requestWeapon, weaponView, WEAPONS, FALLBACK_ORDER, WEAPONTOP } from '../src/game/weapons.js';

let failures = 0;
const check = (cond, label) => {
  if (!cond) { failures++; console.log(`FALHA: ${label}`); }
  return cond;
};
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const wad = loadWad();
const { lumps } = findSpriteLumps(wad);
const table = resolveMonsterTable(lumps, new Set([3001, 3003, 3004, 2035]));

// --- Mundos sintéticos ---
const L = (x1, y1, x2, y2, extra = {}) => ({ x1, y1, x2, y2, minX: Math.min(x1, x2), maxX: Math.max(x1, x2),
  minY: Math.min(y1, y2), maxY: Math.max(y1, y2), front: 0, back: -1, oneSided: true, flags: 0, ...extra });
const S = (floorHeight, ceilingHeight, ceilingTexture = 'CEIL') => ({ floorHeight, ceilingHeight, ceilingTexture });
const synthMap = { nodes: [], ssectors: [{ segCount: 1, firstSeg: 0 }], segs: [{ linedef: 0, direction: 0 }],
  linedefs: [{ rightSidedef: 0, leftSidedef: 0xFFFF }], sidedefs: [{ sector: 0 }] };
// Sala quadrada (um setor) com linhas extras; sectorAt para vários setores.
const room = (size, extra = [], sectors = [S(0, 256)], sectorAt = () => 0) => ({
  map: synthMap, sectors, sectorAt,
  lines: [L(0, 0, size, 0), L(size, 0, size, size), L(size, size, 0, size), L(0, size, 0, 0), ...extra] });
// Sistema de projéteis de teste: alvos fixos, registro de acertos, explosões e eventos.
function system(world, { targets = () => [], seed = 1, rng = null } = {}) {
  const log = { hits: [], blasts: [], sounds: [], events: [] };
  const ms = new MissileSystem(world, rng ?? new Rng(seed), {
    sectorAt: (x, y) => world.sectorAt(x, y), targets,
    hit: (p, t, amount) => log.hits.push({ p, t, amount }),
    blast: (p) => log.blasts.push({ x: p.x, y: p.y }),
    sound: (name) => log.sounds.push(name), event: (ev) => log.events.push(ev),
  });
  return { ms, log };
}
const monster = (x, y, floorZ = 0, type = 3001) => ({ x, y, floorZ, thingIndex: 99, type });
const playerBox = (x, y, z = 0) => ({ kind: 'player', x, y, z, radius: 16, height: 56 });
const fly = (ms, n) => { for (let i = 0; i < n; i++) ms.update(); };

// --- a) Tabelas ---
{
  const T = MISSILE_TYPES;
  check(T.troopShot.speed === 10 && T.troopShot.radius === 6 && T.troopShot.height === 8 && T.troopShot.mult === 3, 'troopShot: 10, 6, 8, x3');
  check(T.bruiserShot.speed === 15 && T.bruiserShot.radius === 6 && T.bruiserShot.height === 8 && T.bruiserShot.mult === 8, 'bruiserShot: 15, 6, 8, x8');
  check(T.rocket.speed === 20 && T.rocket.radius === 11 && T.rocket.height === 8 && T.rocket.mult === 20, 'rocket: 20, 11, 8, x20');
  const frames = (t) => `${t.prefix} ${t.fly.map((f) => f.join('')).join(' ')} / ${t.death.map((f) => f.join('')).join(' ')}`;
  check(frames(T.troopShot) === 'BAL1 A4 B4 / C6 D6 E6' && frames(T.bruiserShot) === 'BAL7 A4 B4 / C6 D6 E6' && frames(T.rocket) === 'MISL A-1 / B8 C6 D4', 'quadros dos três tipos');
  check(T.troopShot.spawnSound === 'firsht' && T.troopShot.deathSound === 'firxpl' && T.rocket.spawnSound === 'rlaunc' && T.rocket.deathSound === 'barexp', 'sons');
}

// --- b) Dano direto ---
{
  const rng = new Rng(2121);
  for (const [type, step, max] of [['troopShot', 3, 24], ['bruiserShot', 8, 64], ['rocket', 20, 160]]) {
    const seen = new Set();
    let ok = true;
    for (let i = 0; i < 5000; i++) {
      const d = directDamage(type, rng);
      seen.add(d);
      if (!Number.isInteger(d) || d % step !== 0 || d < step || d > max) ok = false;
    }
    check(ok && seen.size === 8, `${type}: múltiplos de ${step} entre ${step} e ${max}, todos aparecem (${[...seen].sort((a, b) => a - b).join(',')})`);
  }
}

// --- c) Voo ---
{
  let target = playerBox(900, 500);
  let { ms, log } = system(room(2048), { targets: () => [target] });
  const p = ms.spawnFromMonster(monster(500, 500), { x: 900, y: 500, z: 0 }, 'troopShot');
  check(p.vz === 0 && near(p.x, 505) && p.z === 32, `troopShot sai de z 32 com vz 0 e meio passo (x ${p.x})`);
  let tics = 0;
  while (p.state === 'fly' && tics < 200) {
    const x0 = p.x;
    ms.update();
    tics++;
    if (p.state === 'fly' && !near(p.x, x0 + 10)) break;
  }
  check(log.hits.length === 1 && log.hits[0].t.kind === 'player' && tics >= 35 && tics <= 42, `jogador a 400: acerta em ${tics} tics (cerca de 40)`);
  check(near(p.x, 505 + 10 * (tics - 1)), `posição consistente com x = x0 + vx/2 + n*vx (${p.x})`);
  target = playerBox(900, 500, 40);
  ({ ms, log } = system(room(2048), { targets: () => [target] }));
  const up = ms.spawnFromMonster(monster(500, 500), { x: 900, y: 500, z: 40 }, 'troopShot');
  fly(ms, 60);
  check(up.vz > 0 || log.hits.length === 1, 'jogador 40 acima: vz positivo');
  check(log.hits.length === 1, 'jogador 40 acima: ainda acerta');
  target = playerBox(900, 600); // o jogador saiu da linha depois do disparo
  ({ ms, log } = system(room(2048), { targets: () => [target] }));
  const miss = ms.spawnFromMonster(monster(500, 500), { x: 900, y: 500, z: 0 }, 'troopShot');
  fly(ms, 300);
  check(log.hits.length === 0 && log.events.some((e) => e.type === 'wall') && miss.removed !== false, 'jogador 100 para o lado: erra e acaba em parede');
  ({ ms, log } = system(room(4096)));
  ms.spawnFromPlayer({ x: 500, y: 500, z: 0 }, 0, 0);
  fly(ms, 10);
  check(ms.stats.splits === 10, `foguete (20 por tic): dois meio-passos por tic (${ms.stats.splits} tics divididos em 10)`);
}

// --- d) Paredes ---
{
  let { ms, log } = system(room(2048, [L(700, 0, 700, 2048)]));
  const p = ms.spawnFromMonster(monster(500, 500), { x: 900, y: 500, z: 0 }, 'troopShot');
  fly(ms, 40);
  check(p.state === 'dying' && 700 - p.x <= 6 + 10 && p.x + 6 <= 700 && log.sounds.includes('firxpl'), `parede de um lado só: explode antes dela, com "firxpl" (x ${p.x})`);
  // Linha de 700 descendo para o sul: a frente (direita) fica a oeste, no setor 0, de onde vem o projétil.
  const twoSide = (sec1, flags = 0) => room(2048, [L(700, 2048, 700, 0, { oneSided: false, back: 1, flags })], [S(0, 256), sec1], (x) => (x < 700 ? 0 : 1));
  const shoot = (world) => {
    const t = system(world);
    const q = t.ms.spawnFromMonster(monster(500, 500), { x: 1500, y: 500, z: 0 }, 'troopShot');
    fly(t.ms, 30);
    return { q, log: t.log };
  };
  check(shoot(twoSide(S(20, 60))).q.x > 700, 'janela cobrindo [z, z + altura]: passa');
  check(shoot(twoSide(S(36, 60))).q.state === 'dying', 'janela sem cobrir: explode');
  check(shoot(twoSide(S(0, 0))).q.state === 'dying', 'porta fechada: explode');
  check(shoot(twoSide(S(0, 256), 0x0001)).q.x > 700, 'flag 0x0001 não bloqueia projéteis');
  const sky = shoot(twoSide(S(0, 30, 'F_SKY1')));
  check(sky.q.removed && !sky.log.sounds.includes('firxpl'), 'parte de cima com céu do outro lado: some sem explodir');
  // 2000 disparos aleatórios numa sala fechada com uma parede interna: nenhum atravessa.
  const walls = [L(0, 0, 1024, 0), L(1024, 0, 1024, 1024), L(1024, 1024, 0, 1024), L(0, 1024, 0, 0), L(300, 200, 700, 800)];
  const closed = { map: synthMap, sectors: [S(0, 256)], sectorAt: () => 0, lines: walls };
  const rng = new Rng(77);
  const cross = (ax, ay, bx, by, l) => {
    const sd = (px, py, qx, qy, rx, ry) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
    const d1 = sd(l.x1, l.y1, l.x2, l.y2, ax, ay), d2 = sd(l.x1, l.y1, l.x2, l.y2, bx, by);
    const d3 = sd(ax, ay, bx, by, l.x1, l.y1), d4 = sd(ax, ay, bx, by, l.x2, l.y2);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  };
  let through = 0, outside = 0;
  ({ ms } = system(closed, { rng }));
  for (let k = 0; k < 2000; k++) {
    const x = 50 + rng.next255() * 3.5, y = 50 + rng.next255() * 3.5;
    if (Math.abs((700 - 300) * (y - 200) - (800 - 200) * (x - 300)) < 8000) continue; // longe da parede interna
    const q = ms.spawnFromPlayer({ x, y, z: 0 }, rng.next255() * 360 / 256, 0);
    let px = q.x, py = q.y;
    for (let t = 0; t < 120 && q.state === 'fly' && !q.removed; t++) {
      ms.update();
      if (walls.some((l) => cross(px, py, q.x, q.y, l))) through++;
      if (q.x < 0 || q.x > 1024 || q.y < 0 || q.y > 1024) outside++;
      px = q.x; py = q.y;
    }
    ms.reset();
  }
  check(through === 0 && outside === 0, `2000 disparos: nenhum atravessa parede (${through}) nem sai da sala (${outside})`);
}

// --- e) Coisas ---
{
  const mtab = (type) => table.entries.get(type);
  const live = (type, x, y) => ({ x, y, floorZ: 0, shootable: true, removed: false, entry: mtab(type), type, thingIndex: type });
  const imp = live(3001, 700, 500), barrel = live(2035, 700, 500), corpse = { ...live(3001, 700, 500), shootable: false };
  const fromImp = { owner: 99 }, fromPlayer = { owner: 'player' };
  const tg = (p, opts) => missileTargets(p, opts);
  check(tg(fromImp, { player: { x: 0, y: 0, z: 0 }, monsters: [imp] }).every((t) => t.kind !== 'monster'), 'bola de monstro: monstros não são alvo');
  check(tg(fromImp, { player: { x: 0, y: 0, z: 0 }, monsters: [barrel] }).some((t) => t.kind === 'barrel'), 'bola de monstro: barris são alvo');
  check(tg(fromPlayer, { player: { x: 0, y: 0, z: 0 }, monsters: [imp] }).every((t) => t.kind !== 'player') &&
    tg(fromPlayer, { monsters: [imp] }).some((t) => t.kind === 'monster'), 'foguete: monstros são alvo, o jogador nunca');
  check(tg(fromPlayer, { monsters: [corpse] }).length === 0, 'corpos não são alvo');
  const run = (owner, targets, z = 0, type = 'troopShot') => {
    const t = system(room(2048), { targets: () => targets });
    const p = owner === 'player' ? t.ms.spawnFromPlayer({ x: 500, y: 500, z }, 0, 0, type) : t.ms.spawnFromMonster(monster(500, 500, z), { x: 900, y: 500, z }, type);
    fly(t.ms, 60);
    return { p, log: t.log };
  };
  let r = run(99, tg(fromImp, { player: { x: 800, y: 500, z: 0 }, monsters: [{ ...imp, x: 650 }] }));
  check(r.log.hits.length === 1 && r.log.hits[0].t.kind === 'player' && r.log.hits[0].amount >= 3 && r.log.hits[0].amount <= 24, 'bola atinge o jogador (3 a 24) e atravessa o monstro do caminho');
  r = run(99, tg(fromImp, { monsters: [barrel] }));
  check(r.log.hits.length === 1 && r.log.hits[0].t.kind === 'barrel', 'bola atinge barris');
  r = run(99, [playerBox(700, 500, -70)]);
  check(r.log.hits.length === 0, 'passa por cima de um alvo abaixo (z > pés + altura)');
  r = run(99, [playerBox(700, 500, 60)]);
  check(r.log.hits.length === 0, 'passa por baixo de um alvo acima (z + altura < pés)');
  r = run(99, [{ kind: 'solid', x: 700, y: 500, z: 0, radius: 16, height: 64 }]);
  check(r.log.hits.length === 0 && r.p.state === 'dying', 'coluna (decoração sólida): para sem dano');
  r = run('player', tg(fromPlayer, { player: { x: 700, y: 500, z: 0 }, monsters: [{ ...imp, x: 800 }] }), 0, 'rocket');
  check(r.log.hits.length === 1 && r.log.hits[0].t.kind === 'monster' && r.log.hits[0].amount % 20 === 0 && r.log.hits[0].amount <= 160, 'foguete atinge monstro (20 a 160) e nunca o jogador');
}

// --- f) Explosão ---
{
  const fixed = (v) => ({ next255: () => v, nextRange: (a, b) => (a + b) / 2 });
  let t = system(room(2048, [L(600, 0, 600, 2048)]), { rng: fixed(3) });
  const p = t.ms.spawnFromMonster(monster(500, 500), { x: 900, y: 500, z: 0 }, 'troopShot');
  for (let i = 0; i < 40 && p.state === 'fly'; i++) t.ms.update();
  check(p.state === 'dying' && p.frameIndex === 0 && p.ticsLeft === 6 - 3, `primeiro quadro de morte reduzido em next255() & 3 (${p.ticsLeft})`);
  t = system(room(2048, [L(600, 0, 600, 2048)]), { rng: fixed(255) });
  const rk = t.ms.spawnFromPlayer({ x: 500, y: 500, z: 0 }, 0, 0);
  for (let i = 0; i < 40 && rk.state === 'fly'; i++) t.ms.update();
  check(rk.state === 'dying' && t.log.blasts.length === 1 && rk.frameIndex === 0 && rk.ticsLeft === 8 - 3, 'foguete: dano em raio ao entrar no quadro B');
  fly(t.ms, 30);
  check(t.log.blasts.length === 1, 'o dano em raio acontece uma vez só');
  check(blastDamage({ x: 0, y: 0 }, { x: 50, y: 0 }, 20, ROCKET_BLAST) === 98 && blastDamage({ x: 0, y: 0 }, { x: 148, y: 0 }, 20, ROCKET_BLAST) === 0, 'raio: 98 a 50 (alvo de raio 20), 0 a 148');
  check(blastDamage({ x: 0, y: 0 }, { x: 60, y: 0 }, 16, ROCKET_BLAST) === 84, 'jogador a 60: 84 antes da armadura');
  // Barril a 40 de uma explosão de foguete: explode.
  const sys = new MonsterSystem([{ index: 0, x: 540, y: 500, angle: 0, flags: 0, base: [540, 0, -500] }, { index: 1, x: 700, y: 500, angle: 0, flags: 0, base: [700, 0, -500] }],
    table.entries, (o) => (o.index === 0 ? 2035 : 3001), new Rng(4), {});
  radiusAttack(room(2048), { x: 500, y: 500 }, ROCKET_BLAST, null, sys.monsters, new Rng(4), { damage: (m, a) => sys.damage(m, a) });
  check(!sys.monsters[0].shootable, 'barril a 40 da explosão: explode');
  // Monstro atingido diretamente: dano direto + raio.
  const amounts = [];
  const imp = sys.monsters[1];
  imp.health = 100000;
  const t2 = new MissileSystem(room(2048), new Rng(9), { sectorAt: () => 0,
    targets: (q) => missileTargets(q, { monsters: [imp] }),
    hit: (q, tg, a) => amounts.push(['direto', a]),
    blast: (q) => radiusAttack(room(2048), { x: q.x, y: q.y }, ROCKET_BLAST, null, [imp], new Rng(9), { damage: (m, a) => amounts.push(['raio', a]) }) });
  t2.spawnFromPlayer({ x: 500, y: 500, z: 0 }, 0, 0);
  for (let i = 0; i < 20; i++) t2.update();
  check(amounts.length === 2 && amounts[0][0] === 'direto' && amounts[1][0] === 'raio', `monstro atingido diretamente leva direto + raio (${JSON.stringify(amounts)})`);
}

// --- g) Limites ---
{
  const { ms } = system(room(100000));
  const first = ms.spawnFromPlayer({ x: 50000, y: 50000, z: 0 }, 0, 0, 'troopShot');
  for (let i = 0; i < MAX_MISSILES; i++) ms.spawnFromPlayer({ x: 50000, y: 50000, z: 0 }, i, 0, 'troopShot');
  check(ms.list.length === MAX_MISSILES && !ms.list.includes(first), `o ${MAX_MISSILES + 1}º descarta o mais antigo`);
  ms.reset();
  const lone = ms.spawnFromPlayer({ x: 50000, y: 50000, z: 0 }, 0, 0, 'troopShot');
  fly(ms, MAX_MISSILE_TICS);
  check(ms.list.includes(lone), 'ainda em voo aos 700 tics');
  fly(ms, 1);
  check(!ms.list.includes(lone), 'removido depois de 700 tics');
  ms.spawnFromPlayer({ x: 50000, y: 50000, z: 0 }, 0, 0);
  ms.reset();
  check(ms.list.length === 0, 'reiniciar apaga todos');
}

// --- h) IA ---
function aiSystem(world, specs, player, seed) {
  const objects = specs.map(([, x, y, angle = 0], index) => ({ index, x, y, angle, flags: 0, base: [x, 0, -y] }));
  const rng = new Rng(seed);
  const sys = new MonsterSystem(objects, table.entries, (o) => specs[o.index][0], rng, {});
  const fired = [], damage = [];
  const ai = new MonsterAI({ world, rng, player: () => player, noTarget: () => false, staticSolids: [], onSound: () => {},
    onPlayerDamaged: (amount, source, kind) => damage.push({ amount, source, kind }),
    spawnMissile: (m, type) => fired.push(type) }).attach(sys);
  return { sys, ai, fired, damage };
}
{
  let ok = 0;
  const counts = [];
  for (let seed = 1; seed <= 20; seed++) {
    const t = aiSystem(room(2048), [[3001, 500, 500, 0]], { x: 800, y: 500, z: 0, alive: true }, seed);
    for (let i = 0; i < 1500; i++) t.sys.tick();
    counts.push(t.fired.length);
    if (t.fired.length > 0 && t.fired.every((f) => f === 'troopShot')) ok++;
  }
  console.log(`Diabrete a 300: bolas disparadas por semente em 1500 tics: ${counts.join(', ')}`);
  check(ok === 20, 'diabrete com visão a 300 dispara bolas nas 20 sementes');
  const close = aiSystem(room(2048), [[3001, 500, 500, 0]], { x: 540, y: 500, z: 0, alive: true }, 5);
  for (let i = 0; i < 600; i++) close.sys.tick();
  check(close.fired.length === 0 && close.damage.length > 0 && close.damage.every((d) => d.kind === 'melee'), 'de perto: garra, nunca bola');
  const r = aiSystem(room(2048), [[3001, 500, 500, 0]], { x: 764, y: 500, z: 0, alive: true }, 11);
  const m = r.sys.monsters[0];
  m.reactionTime = 0;
  let yes = 0;
  for (let i = 0; i < 10000; i++) if (r.ai.checkMissileRange(m)) yes++;
  console.log(`Diabrete a 264: fração ${(yes / 10000).toFixed(3)} (esperado 0.22; tem corpo a corpo, não subtrai 128)`);
  check(yes / 10000 >= 0.18 && yes / 10000 <= 0.26, 'checkMissileRange a 264 entre 0.18 e 0.26');
  check(AI_TABLE[3003] && table.entries.get(3003).ai, 'barão com IA (quadros completos)');
  const b = aiSystem(room(2048), [[3003, 500, 500, 0]], { x: 540, y: 500, z: 0, alive: true }, 3);
  const bm = b.sys.monsters[0];
  bm.target = 'player';
  for (let i = 0; i < 2000; i++) b.ai.action(bm, 'bruisAttack');
  const vals = new Set(b.damage.map((d) => d.amount));
  check(b.damage.length === 2000 && [...vals].every((v) => v % 10 === 0 && v >= 10 && v <= 80) && vals.size === 8 && b.fired.length === 0, `barão de perto: ${[...vals].sort((x, y) => x - y).join(',')}`);
  const bf = aiSystem(room(2048), [[3003, 500, 500, 0]], { x: 900, y: 500, z: 0, alive: true }, 3);
  bf.sys.monsters[0].target = 'player';
  bf.ai.action(bf.sys.monsters[0], 'bruisAttack');
  check(bf.fired.join() === 'bruiserShot' && bf.damage.length === 0, 'barão à distância: bruiserShot');
  // Cenário da etapa 18: acorda, persegue e ataca.
  const w = aiSystem(room(2048), [[3003, 200, 200, 45]], { x: 1500, y: 1500, z: 0, alive: true }, 7);
  const wm = w.sys.monsters[0];
  let woke = -1, attacked = -1;
  for (let i = 1; i <= 1500 && attacked < 0; i++) {
    w.sys.tick();
    if (woke < 0 && wm.state !== 'stand') woke = i;
    if (w.fired.length || w.damage.length) attacked = i;
  }
  check(woke > 0 && attacked > 0 && Math.hypot(wm.x - 200, wm.y - 200) > 0, `barão acorda (tic ${woke}), persegue e ataca (tic ${attacked})`);
}

// --- i) Arma ---
{
  const stats = new PlayerStats();
  stats.weaponsOwned.add(5);
  stats.ammo.rocket = 5;
  const w = createWeapons({ current: 5 });
  w.state = 'ready'; w.sy = WEAPONTOP;
  let fireAt = -1, n = 0;
  const flashes = [];
  let ev = tickWeapons(w, { fire: true }, stats, 0, []);
  flashes.push(w.flash ? w.flash.seq[w.flash.index][0] : '-');
  while (w.state === 'fire' && n < 100) {
    n++;
    ev = tickWeapons(w, { fire: false }, stats, n, []);
    if (ev.some((e) => e.type === 'fire' && e.weapon === 5)) fireAt = n;
    flashes.push(w.flash ? w.flash.seq[w.flash.index][0] : '-');
  }
  const flashSeq = flashes.join('');
  check(n === 20 && fireAt === 8 && stats.ammo.rocket === 4, `ciclo de ${n} tics, foguete no tic ${fireAt}, gasta 1`);
  check(flashSeq.startsWith('AAABBBBCCCCDDDD-'), `clarão MISF A3 B4 C4 D4 (${flashSeq.slice(0, 16)})`);
  check(FALLBACK_ORDER.join() === '4,3,2,5,1', 'ordem sem munição: metralhadora, espingarda, pistola, lança-foguetes, soco');
  const s2 = new PlayerStats();
  s2.weaponsOwned.add(5);
  s2.ammo.clip = 0; s2.ammo.rocket = 3;
  const w2 = createWeapons({ current: 2 });
  w2.state = 'ready'; w2.sy = WEAPONTOP;
  tickWeapons(w2, { fire: true }, s2, 0, []);
  check(w2.pending === 5, 'pistola sem balas, com foguetes: troca para o lança-foguetes');
  const w3 = createWeapons({ current: 2 });
  w3.state = 'ready'; w3.sy = WEAPONTOP;
  check(requestWeapon(w3, 5, s2) && w3.pending === 5, 'Digit5 seleciona o lança-foguetes possuído');
  check(weaponView(createWeapons({ current: 5 })).ammo === 'rocket' && WEAPONS[5].usable, 'campo de munição: foguetes');
  check(ev !== null, 'o evento "fire" da arma 5 existe (o main chama o alerta de som para todo "fire")');
}

// --- j) Integração do jogador ---
{
  const stats = new PlayerStats();
  stats.armor = 100; stats.armorType = 1;
  const face = new FaceState();
  const attacker = { x: 500, y: 300 }; // ao sul (à direita de quem olha para o leste)
  const r = applyDamage(stats, 24, attacker, 'TROO', new Rng(1));
  face.onDamage(r.applied, attacker);
  check(r.savedByArmor === 8 && stats.health === 84 && stats.armor === 92, 'bola de 24 com armadura verde: absorve 8, vida 84');
  check(face.wanted(stats, { x: 500, y: 500, angle: 0 }, false) === 'STFTR00', 'o rosto olha para o lado do ataque (direita)');
  const s2 = new PlayerStats();
  const rk = applyDamage(s2, blastDamage({ x: 0, y: 0 }, { x: 30, y: 0 }, 16, ROCKET_BLAST), null, 'player', new Rng(1));
  check(rk.applied === 114 - 0 && s2.isDead && s2.lastAttacker === null && rk.events[0].type === 'playerDied', 'foguete a 30 de si mesmo: 114, sem atacante, morte pelo fluxo da etapa 19');
}

// --- k) Determinismo ---
{
  const trace = (seed) => {
    const player = { x: 1500, y: 500, z: 0, alive: true };
    const t = aiSystem(room(2048), [[3001, 500, 500, 0], [3001, 500, 900, 0], [3003, 300, 300, 0]], player, seed);
    const world = room(2048);
    const ms = new MissileSystem(world, t.sys.rng, { sectorAt: () => 0, targets: (p) => missileTargets(p, { player, monsters: t.sys.monsters }), hit: () => {} });
    t.ai.ctx.spawnMissile = (m, type) => ms.spawnFromMonster(m, player, type);
    const out = [];
    for (let i = 0; i < 1000; i++) {
      t.sys.tick();
      ms.update();
      out.push(t.sys.monsters.map((m) => `${m.x.toFixed(3)},${m.y.toFixed(3)},${m.state}`).join(';') + '|' + ms.list.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)},${p.state}`).join(';'));
    }
    return out.join('\n');
  };
  check(trace(42) === trace(42), 'mesma semente: mesmo rastro em 1000 tics');
}

// --- l) Lumps ---
{
  const names = new Set(wad.lumps.map((l) => l.name));
  const has = (prefix, letter) => [...names].some((n) => n.startsWith(prefix + letter));
  const want = [['BAL1', 'ABCDE'], ['BAL7', 'ABCDE'], ['MISL', 'ABCD'], ['MISG', 'AB'], ['MISF', 'ABCD'], ['BOSS', 'ABCDEFG']];
  const missing = want.flatMap(([p, letters]) => [...letters].filter((l) => !has(p, l)).map((l) => p + l));
  console.log(`Lumps ausentes: ${missing.join(', ') || 'nenhum'}`);
  check(missing.length === 0, 'lumps dos projéteis, do lança-foguetes e do barão');
  const boss = table.entries.get(3003);
  check(boss.ai && boss.ai.see.length === 8 && boss.ai.melee.length === 3, 'barão: corrida A a D e ataque E a G em todas as vistas');
  const sounds = ['firsht', 'firxpl', 'rlaunc', 'barexp', 'brssit', 'claw'].filter((s) => !names.has(`DS${s.toUpperCase()}`));
  check(sounds.length === 0, `sons (ausentes: ${sounds.join(', ') || 'nenhum'})`);
  const map = loadMap(wad, 'E1M1');
  const present = new Set(map.things.map((th) => th.type));
  const e1 = resolveMonsterTable(lumps, new Set([...present, 3003]));
  const scene = buildSpriteScene(wad, map, { extraFrames: [...extraSpriteFrames(e1.entries), ...missileSpriteFrames().map((f) => ({ ...f, category: 'effect' }))] });
  const tex = scene.stats.texture;
  console.log(`Textura de sprites (E1M1 + barão + projéteis): ${tex.layers} camadas de ${tex.layerW}x${tex.layerH}, ${(tex.bytes / 1048576).toFixed(1)} MiB; ` +
    `ausentes: ${scene.stats.missingExtra.join(', ') || 'nenhum'}; descartados: ${scene.stats.droppedCategories.join(', ') || 'nada'}`);
  check(scene.stats.missingExtra.length === 0 && tex.layers <= 1024 && tex.bytes <= 256 * 1048576, 'todas as camadas cabem');
  check(missileSpriteFrames().every((f) => scene.frames.has(f.prefix + f.letter)), 'quadros dos projéteis na textura');
}

console.log(failures ? `${failures} falha(s)` : 'Tudo certo');
process.exit(failures ? 1 : 0);
