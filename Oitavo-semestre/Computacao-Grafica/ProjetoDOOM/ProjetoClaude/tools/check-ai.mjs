// Verificação da IA dos monstros, sem navegador. Uso: node tools/check-ai.mjs
// Sai com código diferente de zero se algo falhar.

import fs from 'node:fs';
import { WadFile } from '../src/wad/WadFile.js';
import { loadMap } from '../src/wad/MapData.js';
import { findSector } from '../src/map/bsp.js';
import { findSpriteLumps } from '../src/wad/Sprites.js';
import { buildCollisionLines } from '../src/physics/collisionData.js';
import { buildSpriteScene } from '../src/sprites/spriteLogic.js';
import { staticSolids } from '../src/physics/solids.js';
import { Rng } from '../src/game/Rng.js';
import { resolveMonsterTable, extraSpriteFrames } from '../src/game/monsterTable.js';
import { MonsterSystem } from '../src/game/MonsterSystem.js';
import { MonsterAI, checkPosition, tryMove, newChaseDir, monsterShots, angleTo } from '../src/game/MonsterAI.js';
import {
  OPPOSITE, DIAGS, XSPEED, YSPEED, NODIR, MELEERANGE, AI_TABLE, AI_TYPES, MONSTER_SPREAD_DEG, aproxDist, dirAngle,
} from '../src/game/aiTable.js';
import { checkSight } from '../src/game/sight.js';
import { buildSoundGraph, noiseAlert } from '../src/game/sound.js';

let failures = 0;
const check = (cond, label) => {
  if (!cond) { failures++; console.log(`FALHA: ${label}`); }
  return cond;
};
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

const bytes = fs.readFileSync(new URL('../assets/freedoom1.wad', import.meta.url));
const wad = new WadFile(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const map = loadMap(wad, 'E1M1');
const { lumps } = findSpriteLumps(wad);
const table = resolveMonsterTable(lumps, new Set([3004, 9, 3001, 3002, 58, 2035]));

// --- Mundos sintéticos ---
const L = (x1, y1, x2, y2, extra = {}) => ({ x1, y1, x2, y2, minX: Math.min(x1, x2), maxX: Math.max(x1, x2),
  minY: Math.min(y1, y2), maxY: Math.max(y1, y2), front: 0, back: -1, oneSided: true, flags: 0, ...extra });
const two = (x1, y1, x2, y2, front, back, flags = 0) => L(x1, y1, x2, y2, { front, back, oneSided: false, flags });
const S = (floorHeight, ceilingHeight) => ({ floorHeight, ceilingHeight, ceilingTexture: 'CEIL' });
const synthMap = { nodes: [], ssectors: [{ segCount: 1, firstSeg: 0 }], segs: [{ linedef: 0, direction: 0 }],
  linedefs: [{ rightSidedef: 0, leftSidedef: 0xFFFF }], sidedefs: [{ sector: 0 }] };
// Sala quadrada de um setor, com linhas extras; sectorAt opcional para mapas de vários setores.
const room = (size, extra = [], sectors = [S(0, 256)], sectorAt = null) => ({
  map: synthMap, sectors, sectorAt: sectorAt ?? (() => 0),
  lines: [L(0, 0, size, 0), L(size, 0, size, size), L(size, size, 0, size), L(0, size, 0, 0), ...extra],
});

// Sistema com IA: specs [[tipo, x, y, ângulo, flags]]; player { x, y, z, alive }.
function aiSystem(world, specs, { seed = 1, player = { x: 0, y: 0, z: 0, alive: true }, noTarget = false, rng = null } = {}) {
  const objects = specs.map(([, x, y, angle = 0, flags = 0], index) => ({ index, x, y, angle, flags, base: [x, 0, -y] }));
  const sounds = [], damage = [];
  const r = rng ?? new Rng(seed);
  const sys = new MonsterSystem(objects, table.entries, (o) => specs[o.index][0], r, { onSound: (n, m) => sounds.push([n, m.thingIndex]) });
  const flags = { noTarget };
  const ai = new MonsterAI({ world, rng: r, player: () => player, noTarget: () => flags.noTarget, staticSolids: [],
    onSound: (n, m) => sounds.push([n, m.thingIndex]), onPlayerDamaged: (amount, source, kind) => damage.push({ amount, source, kind }) }).attach(sys);
  return { sys, ai, sounds, damage, player, flags };
}
const runTics = (sys, n) => { for (let i = 0; i < n; i++) sys.tick(); };

// --- a) Tabelas ---
check(OPPOSITE.join() === '4,5,6,7,0,1,2,3,8' && DIAGS.join() === '3,1,5,7', 'opposite e diags');
check(XSPEED.map((v) => Math.round(v * 65536)).join() === '47000,32000,0,-32000,-47000,-32000,0,32000', 'xspeed');
check(YSPEED.map((v) => Math.round(v * 65536)).join() === '0,32000,47000,32000,0,-32000,-47000,-32000', 'yspeed');
check([0, 1, 2, 3, 4, 5, 6, 7].every((d) => dirAngle(d) === d * 45), 'ângulo de cada direção = d * 45');
check(near(AI_TABLE[3004].speed * XSPEED[0], 8 * 47000 / 65536) && near(AI_TABLE[3004].speed * XSPEED[0], 5.737, 1e-3), 'passo cardinal do POSS ~ 5.737');
check(MELEERANGE === 64, 'MELEERANGE = 64');

// --- b) aproxDist e checkMeleeRange ---
check(aproxDist(300, 400) === 550, 'aproxDist(300, 400) = 550');
{
  const P = { x: 559, y: 500, z: 0, alive: true };
  const t = aiSystem(room(2048), [[3001, 500, 500]], { player: P });
  const m = t.sys.monsters[0];
  check(t.ai.checkMeleeRange(m), 'corpo a corpo a 59: verdadeiro');
  P.x = 560;
  check(!t.ai.checkMeleeRange(m), 'corpo a corpo a 60: falso');
  const walled = aiSystem(room(2048, [L(530, 0, 530, 2048)]), [[3001, 500, 500]], { player: { x: 550, y: 500, z: 0, alive: true } });
  check(!walled.ai.checkMeleeRange(walled.sys.monsters[0]), 'corpo a corpo sem visão: falso');
}

// --- c) checkMissileRange ---
{
  const P = { x: 650, y: 500, z: 0, alive: true };
  const t = aiSystem(room(2048), [[3004, 500, 500]], { player: P, seed: 777 });
  const m = t.sys.monsters[0];
  m.reactionTime = 0;
  let all = true;
  for (let i = 0; i < 10000; i++) if (!t.ai.checkMissileRange(m)) all = false;
  check(all, 'POSS a 150: sempre verdadeiro');
  P.x = 892;
  let yes = 0;
  for (let i = 0; i < 10000; i++) if (t.ai.checkMissileRange(m)) yes++;
  console.log(`POSS a 392: fração verdadeira ${(yes / 10000).toFixed(3)} (esperado ~0.22)`);
  check(yes / 10000 >= 0.18 && yes / 10000 <= 0.26, 'POSS a 392: fração entre 0.18 e 0.26');
  P.x = 1900;
  m.justHit = true;
  check(t.ai.checkMissileRange(m) && !m.justHit, 'justHit: verdadeiro uma vez e limpa a flag');
  m.reactionTime = 3;
  check(!t.ai.checkMissileRange(m), 'reactionTime > 0: falso');
  const walled = aiSystem(room(2048, [L(700, 0, 700, 2048)]), [[3004, 500, 500]], { player: { x: 650 + 300, y: 500, z: 0, alive: true } });
  walled.sys.monsters[0].reactionTime = 0;
  check(!walled.ai.checkMissileRange(walled.sys.monsters[0]), 'sem visão: falso');
}

// --- d) checkSight ---
{
  const eye = { x: 0, y: 500, z: 42 }; // monstro de 56 de altura no chão 0: 56 * 0.75
  const player = { x: 200, y: 500, z: 0, height: 56 };
  const W = (lines, sectors) => ({ lines, sectors });
  check(checkSight(W([], [S(0, 128)]), eye, player), 'sala aberta: visível');
  check(!checkSight(W([L(100, 0, 100, 1000)], [S(0, 128)]), eye, player), 'parede de um lado só: bloqueia');
  // Janela: setor 1 entre x = 100 e 110.
  const win = (floor, ceil) => W([two(100, 0, 100, 1000, 0, 1), two(110, 0, 110, 1000, 1, 0)], [S(0, 128), S(floor, ceil)]);
  check(!checkSight(win(80, 100), eye, player), 'janela acima do olho e do jogador: bloqueia');
  check(checkSight(win(0, 100), eye, player), 'abertura cobrindo o jogador: visível');
  // Degrau: setor 1 (chão 40) entre x = 100 e 150; jogador deitado (altura 8) atrás.
  const step = W([two(100, 0, 100, 1000, 0, 1), two(150, 0, 150, 1000, 1, 0)], [S(0, 128), S(40, 128)]);
  check(!checkSight(step, eye, { ...player, height: 8 }), 'degrau esconde o jogador deitado');
  check(checkSight(step, eye, player), 'degrau não esconde o jogador em pé');
  check(!checkSight(win(0, 0), eye, player), 'porta fechada (abertura 0): bloqueia');

  // E1M1: do início do jogador 1 a cada monstro.
  const world = { map, lines: buildCollisionLines(map), sectors: map.sectors };
  const start = map.things.find((t) => t.type === 1);
  const startZ = map.sectors[findSector(map, start.x, start.y)].floorHeight;
  const oneSided = world.lines.filter((l) => l.oneSided);
  const crosses = (ax, ay, bx, by, l) => {
    const side = (px, py, qx, qy, rx, ry) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
    const d1 = side(l.x1, l.y1, l.x2, l.y2, ax, ay), d2 = side(l.x1, l.y1, l.x2, l.y2, bx, by);
    const d3 = side(ax, ay, bx, by, l.x1, l.y1), d4 = side(ax, ay, bx, by, l.x2, l.y2);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  };
  let visible = 0, bad = 0, total = 0;
  for (const t of map.things.filter((th) => AI_TYPES.includes(th.type))) {
    total++;
    const floor = map.sectors[findSector(map, t.x, t.y)].floorHeight;
    const v = checkSight(world, { x: t.x, y: t.y, z: floor + 42 }, { x: start.x, y: start.y, z: startZ, height: 56 });
    if (typeof v !== 'boolean') bad++;
    if (v) {
      visible++;
      if (oneSided.some((l) => crosses(t.x, t.y, start.x, start.y, l))) bad++;
    }
  }
  console.log(`E1M1: ${visible} de ${total} monstros com IA veem o início do jogador 1`);
  // A sala de início é fechada; para a verificação por força bruta ter casos, também os pares de monstros.
  const ai = map.things.filter((th) => AI_TYPES.includes(th.type));
  let pairs = 0, pairVisible = 0;
  for (const a of ai) {
    const fa = map.sectors[findSector(map, a.x, a.y)].floorHeight;
    for (const b of ai) {
      if (a === b) continue;
      const fb = map.sectors[findSector(map, b.x, b.y)].floorHeight;
      const v = checkSight(world, { x: a.x, y: a.y, z: fa + 42 }, { x: b.x, y: b.y, z: fb, height: 56 });
      pairs++;
      if (typeof v !== 'boolean') bad++;
      if (v) {
        pairVisible++;
        if (oneSided.some((l) => crosses(a.x, a.y, b.x, b.y, l))) bad++;
      }
    }
  }
  console.log(`E1M1: ${pairVisible} de ${pairs} pares de monstros com visão`);
  check(pairVisible > 0, 'E1M1: há pares visíveis para conferir');
  check(bad === 0, 'E1M1: sem NaN e nenhum par visível atravessa linha de um lado só');
}

// --- e) noiseAlert ---
{
  // BFS independente sobre estados (setor, bloqueios).
  const bfs = (world, start) => {
    const g = world.sectors.map(() => []);
    for (const l of world.lines) {
      if (l.oneSided) continue;
      const f = world.sectors[l.front], b = world.sectors[l.back];
      if (Math.min(f.ceilingHeight, b.ceilingHeight) - Math.max(f.floorHeight, b.floorHeight) <= 0) continue;
      const blk = (l.flags & 0x40) !== 0;
      g[l.front].push([l.back, blk]); g[l.back].push([l.front, blk]);
    }
    const seen = new Set([`${start},0`]);
    const queue = [[start, 0]];
    const out = new Set([start]);
    while (queue.length) {
      const [s, b] = queue.shift();
      for (const [to, blk] of g[s]) {
        const nb = blk ? b + 1 : b;
        if (nb > 1 || seen.has(`${to},${nb}`)) continue;
        seen.add(`${to},${nb}`);
        out.add(to);
        queue.push([to, nb]);
      }
    }
    return out;
  };
  const alertedOf = (world, start) => {
    const a = new Array(world.sectors.length).fill(false);
    noiseAlert(buildSoundGraph(world), start, a);
    return new Set(a.flatMap((v, i) => (v ? [i] : [])));
  };
  const same = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
  // Porta fechada: 0 - 1 (porta, abertura 0) - 2.
  const door = { lines: [two(0, 0, 0, 10, 0, 1), two(1, 0, 1, 10, 1, 2)], sectors: [S(0, 128), S(0, 0), S(0, 128)] };
  check(alertedOf(door, 0).size === 1, 'porta fechada não propaga');
  // Duas linhas 0x40 em sequência: 0 -|- 1 -|- 2.
  const blocks = { lines: [two(0, 0, 0, 10, 0, 1, 0x40), two(1, 0, 1, 10, 1, 2, 0x40)], sectors: [S(0, 128), S(0, 128), S(0, 128)] };
  const ab = alertedOf(blocks, 0);
  check(ab.has(1) && !ab.has(2), 'uma linha 0x40 propaga; a segunda corta');
  // Ciclo de 6 setores com uma linha 0x40.
  const ring = { lines: [], sectors: Array.from({ length: 6 }, () => S(0, 128)) };
  for (let i = 0; i < 6; i++) ring.lines.push(two(i, 0, i, 10, i, (i + 1) % 6, i === 2 ? 0x40 : 0));
  check(same(alertedOf(ring, 0), bfs(ring, 0)) && alertedOf(ring, 0).size === 6, 'ciclo: sem laço infinito, todos alertados');
  // Grafos aleatórios contra a BFS.
  const rng = new Rng(99);
  let agree = 0;
  for (let k = 0; k < 200; k++) {
    const n = 3 + (rng.next255() % 12);
    const w = { lines: [], sectors: Array.from({ length: n }, () => S(0, rng.next255() % 5 === 0 ? 0 : 128)) };
    const edges = n + (rng.next255() % (2 * n));
    for (let e = 0; e < edges; e++) {
      const a = rng.next255() % n, b = rng.next255() % n;
      if (a !== b) w.lines.push(two(0, 0, 0, 10, a, b, rng.next255() % 4 === 0 ? 0x40 : 0));
    }
    if (same(alertedOf(w, 0), bfs(w, 0))) agree++;
  }
  check(agree === 200, `200 grafos aleatórios iguais à BFS independente (${agree})`);
  const world = { lines: buildCollisionLines(map), sectors: map.sectors };
  const start = map.things.find((t) => t.type === 1);
  const n = alertedOf(world, findSector(map, start.x, start.y)).size;
  console.log(`E1M1: um tiro no início alerta ${n} de ${map.sectors.length} setores`);
  check(n > 0, 'E1M1: alerta ao menos o setor do jogador');
}

// --- f) Acordar ---
{
  const at = (px, py) => ({ x: px, y: py, z: 0, alive: true });
  const awake = (m) => m.state === 'chase' || m.state === 'missile' || m.state === 'melee';
  let t = aiSystem(room(2048), [[3004, 500, 500, 0]], { player: at(700, 500) });
  runTics(t.sys, 10);
  check(awake(t.sys.monsters[0]) && t.sounds.some(([n]) => n.startsWith('posit')), 'de frente a 200: acorda em até 10 tics, com som de ver');
  t = aiSystem(room(2048), [[3004, 500, 500, 180]], { player: at(700, 500) });
  runTics(t.sys, 40);
  check(!awake(t.sys.monsters[0]), 'de costas a 200: não acorda');
  t = aiSystem(room(2048), [[3004, 500, 500, 180]], { player: at(560, 500) });
  runTics(t.sys, 10);
  check(awake(t.sys.monsters[0]), 'de costas a 60: acorda');
  t = aiSystem(room(2048), [[3004, 500, 500, 180]], { player: at(700, 500) });
  t.ai.noise(0);
  runTics(t.sys, 10);
  check(awake(t.sys.monsters[0]), 'setor alertado: acorda');
  // Ambush: parede entre os dois (o som passa, a visão não).
  t = aiSystem(room(2048, [L(600, 0, 600, 1500)]), [[3004, 500, 500, 0, 0x0008]], { player: at(700, 500) });
  t.ai.noise(0);
  runTics(t.sys, 40);
  check(!awake(t.sys.monsters[0]), 'ambush sem visão: não acorda pelo som');
  t = aiSystem(room(2048), [[3004, 500, 500, 180, 0x0008]], { player: at(700, 500) });
  t.ai.noise(0);
  runTics(t.sys, 10);
  check(awake(t.sys.monsters[0]), 'ambush com visão: acorda pelo som');
  t = aiSystem(room(2048), [[3004, 500, 500, 180]], { player: at(1500, 500), rng: { next255: () => 255, nextRange: (a, b) => (a + b) / 2 } });
  t.sys.damage(t.sys.monsters[0], 1);
  check(awake(t.sys.monsters[0]) && !t.sounds.some(([n]) => n.startsWith('posit')), 'dano acorda sem som de ver');
  t = aiSystem(room(2048), [[3004, 500, 500, 0]], { player: at(700, 500), noTarget: true });
  t.ai.noise(0);
  runTics(t.sys, 40);
  check(!awake(t.sys.monsters[0]), 'noTarget: nada acorda');
  t = aiSystem(room(2048), [[3004, 500, 500, 0]], { player: at(700, 500) });
  t.sys.setAIEnabled(false);
  t.ai.noise(0);
  runTics(t.sys, 40);
  const m = t.sys.monsters[0];
  check(m.state === 'stand' && m.x === 500 && m.y === 500 && m.angle === 0, 'IA desligada: nada muda');
}

// --- g) newChaseDir ---
{
  const fixed = (v) => ({ next255: () => v });
  const run = (olddir, dx, dy, allowed, rngValue = 0) => {
    const tries = [];
    const m = { movedir: olddir };
    newChaseDir(m, dx, dy, (mm) => { tries.push(mm.movedir); return allowed.includes(mm.movedir); }, fixed(rngValue));
    return { dir: m.movedir, tries };
  };
  let r = run(0, 100, 50, [5]);
  check(r.tries.join() === '1,0,2,0,7,6,5' && r.dir === 5, `ordem das tentativas: ${r.tries.join()} (esperado 1,0,2,0,7,6,5)`);
  r = run(0, 100, 50, [5], 255); // > 200: troca os eixos; & 1: ordem crescente
  // Diagonal 1; eixos trocados (2, depois 0); direção antiga 0; ordem crescente sem a meia-volta (4).
  check(r.tries.join() === '1,2,0,0,0,1,2,3,5' && r.dir === 5, `com troca de eixos e ordem crescente: ${r.tries.join()}`);
  r = run(0, 100, 50, [4]);
  check(r.dir === 4 && r.tries.at(-1) === 4, 'só a meia-volta livre: meia-volta por último');
  r = run(0, 100, 50, []);
  check(r.dir === NODIR, 'tudo bloqueado: 8');
  const rng = new Rng(5);
  let ok = true;
  for (let k = 0; k < 2000; k++) {
    const old = rng.next255() % 9;
    const allowed = [0, 1, 2, 3, 4, 5, 6, 7].filter(() => rng.next255() < 100);
    const res = run(old, rng.next255() - 128, rng.next255() - 128, allowed, rng.next255());
    const turn = OPPOSITE[old];
    const alt = allowed.some((d) => d !== turn);
    if (alt && res.dir === turn && turn !== NODIR) ok = false;
    if (allowed.length === 0 && res.dir !== NODIR) ok = false;
  }
  check(ok, 'nunca meia-volta com alternativa (2000 casos aleatórios)');
}

// --- h) Perseguição ---
{
  const P = { x: 1500, y: 1500, z: 0, alive: true };
  const t = aiSystem(room(2048), [[3004, 200, 200, 45]], { player: P, seed: 3 });
  const m = t.sys.monsters[0];
  let tics = 0, reached = false, nan = false;
  for (; tics < 600 && !reached; tics++) {
    t.sys.tick();
    if (![m.x, m.y, m.floorZ, m.angle].every(Number.isFinite)) nan = true;
    if (aproxDist(P.x - m.x, P.y - m.y) < 60 || m.state === 'missile') reached = true;
  }
  check(reached && !nan, `POSS em sala aberta: perto ou atacando em ${tics} tics (< 600)`);
  // Parede com abertura lateral: demônio até o jogador do outro lado.
  let arrived = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const Q = { x: 1700, y: 800, z: 0, alive: true };
    const w = room(2048, [L(1024, 0, 1024, 1600)]);
    const d = aiSystem(w, [[3002, 400, 800, 0]], { player: Q, seed });
    const dm = d.sys.monsters[0];
    d.ai.noise(0);
    let ok = false;
    for (let i = 0; i < 1500 && !ok; i++) {
      d.sys.tick();
      if (![dm.x, dm.y].every(Number.isFinite)) nan = true;
      if (dm.state === 'melee' || aproxDist(Q.x - dm.x, Q.y - dm.y) < 60) ok = true;
    }
    if (ok) arrived++;
  }
  console.log(`Parede com abertura lateral: ${arrived} de 20 sementes chegaram em até 1500 tics`);
  check(arrived >= 16 && !nan, `ao menos 16 de 20 chegam (${arrived}), sem NaN`);
}

// --- i) Máquina de estados ---
{
  const P = { x: 800, y: 500, z: 0, alive: true };
  const t = aiSystem(room(2048), [[3004, 500, 500, 0]], { player: P });
  const m = t.sys.monsters[0];
  m.target = 'player';
  t.sys.setState(m, 'missile');
  let n = 0, shotAt = -1;
  while (m.state === 'missile' && n < 100) {
    t.sys.tick();
    n++;
    if (shotAt < 0 && t.sounds.some(([s]) => s === 'pistol')) shotAt = n;
  }
  check(n === 26 && m.state === 'chase', `ataque do POSS: ${n} tics (esperado 26)`);
  check(shotAt === 10, `tiro ao entrar em F, no tic ${shotAt} (esperado 10)`);
  check(!m.justAttacked && m.state === 'chase', 'a entrada em chase depois do ataque limpa justAttacked e não ataca de novo');
  m.justAttacked = true;
  t.sys.setState(m, 'chase');
  check(m.state === 'chase' && !m.justAttacked, 'chase com justAttacked: limpa e só muda de direção');
  // Dor leva à corrida (demônio, jogador longe: sem ataque ao entrar na corrida; desde a etapa 21 o
  // diabrete com justHit dispara a bola de fogo na hora, como no Doom).
  const p = aiSystem(room(2048), [[3002, 500, 500, 0]], { player: P, rng: { next255: () => 0, nextRange: (a, b) => (a + b) / 2 } });
  const pm = p.sys.monsters[0];
  p.sys.damage(pm, 1);
  check(pm.state === 'pain', 'dano com chance: dor');
  runTics(p.sys, 4);
  check(pm.state === 'chase', 'fim da dor (H2 H2): corrida, não parado');
  for (const type of [3002, 58]) {
    const s = aiSystem(room(2048), [[type, 500, 500, 0]], { player: { x: 540, y: 500, z: 0, alive: true } });
    const sm = s.sys.monsters[0];
    sm.target = 'player';
    s.sys.setState(sm, 'melee');
    // Com o jogador ao alcance, o fim do ataque volta à corrida, que ataca de novo: mordidas a cada 24 tics.
    const bites = [];
    for (let k = 1; k <= 60; k++) {
      const before = s.damage.length;
      s.sys.tick();
      if (s.damage.length > before) bites.push(k);
    }
    check(bites.slice(0, 2).join() === '16,40', `tipo ${type}: ataque de 24 tics com a mordida ao entrar em G (tics ${bites.join(', ')}; esperado 16 e 40)`);
  }
}

// --- j) Dano ---
{
  const rng = new Rng(4242);
  let ok = true, maxDev = 0;
  for (let k = 0; k < 5000; k++) {
    for (const s of monsterShots(1, 0, rng)) {
      if (![3, 6, 9, 12, 15].includes(s.damage)) ok = false;
      maxDev = Math.max(maxDev, Math.abs(s.yaw));
    }
  }
  check(ok && maxDev <= 22.4, `POSS: dano em {3..15} de 3 em 3; desvio máximo ${maxDev.toFixed(2)} <= 22.4`);
  let three = true, independent = 0;
  for (let k = 0; k < 5000; k++) {
    const shots = monsterShots(3, 0, rng);
    if (shots.length !== 3 || shots.some((s) => ![3, 6, 9, 12, 15].includes(s.damage) || Math.abs(s.yaw) > 22.4)) three = false;
    if (new Set(shots.map((s) => s.yaw)).size > 1) independent++;
  }
  check(three && independent > 4900, `SPOS: 3 projéteis com desvios independentes (${independent}/5000 com desvios diferentes)`);
  check(near(255 * MONSTER_SPREAD_DEG, 22.389, 1e-3), 'desvio máximo 255 * 0.0878');
  for (const [type, step, max] of [[3001, 3, 24], [3002, 4, 40]]) {
    const t = aiSystem(room(2048), [[type, 500, 500, 0]], { player: { x: 540, y: 500, z: 0, alive: true }, seed: 11 });
    const m = t.sys.monsters[0];
    m.target = 'player';
    for (let k = 0; k < 5000; k++) t.ai.action(m, type === 3001 ? 'troopAttack' : 'sargAttack');
    const values = new Set(t.damage.map((d) => d.amount));
    check(t.damage.length === 5000 && [...values].every((v) => Number.isInteger(v) && v % step === 0 && v >= step && v <= max) && values.size === max / step,
      `tipo ${type}: dano em múltiplos de ${step} entre ${step} e ${max} (${[...values].sort((a, b) => a - b).join(',')})`);
    check(t.damage.every((d) => d.kind === 'melee' && d.source === (type === 3001 ? 'TROO' : 'SARG')), `tipo ${type}: evento melee com a origem certa`);
  }
  const far = aiSystem(room(2048), [[3001, 500, 500, 0]], { player: { x: 700, y: 500, z: 0, alive: true } });
  far.sys.monsters[0].target = 'player';
  let spawned = null;
  far.ai.ctx.spawnMissile = (mm, type) => { spawned = type; };
  far.ai.action(far.sys.monsters[0], 'troopAttack');
  check(far.damage.length === 0 && spawned === 'troopShot', 'fora do alcance da garra: sem dano direto, bola de fogo (etapa 21)');
}

// --- k) Hitscan de monstro ---
{
  const P = { x: 800, y: 500, z: 0, alive: true };
  const t = aiSystem(room(2048, [], [S(0, 512)]), [[3004, 500, 500, 0]], { player: P });
  const m = t.sys.monsters[0];
  check(t.ai.monsterShot(m, angleTo(m.x, m.y, P.x, P.y), 3, 'POSS') && t.damage.at(-1).kind === 'hitscan', 'jogador à vista a 300: acerta');
  const walled = aiSystem(room(2048, [L(650, 0, 650, 2048)], [S(0, 512)]), [[3004, 500, 500, 0]], { player: P });
  check(!walled.ai.monsterShot(walled.sys.monsters[0], 0, 3, 'POSS'), 'parede de um lado só no meio: não acerta');
  // Jogador 400 para o lado a 1000 de distância (21.8 graus): só o desvio máximo alcança.
  const side = { x: 1500, y: 900, z: 0, alive: true };
  const s = aiSystem(room(2048, [], [S(0, 512)]), [[3004, 500, 500, 0]], { player: side, seed: 8 });
  let hits = 0;
  const rng = new Rng(8);
  for (let k = 0; k < 2000; k++) {
    const [shot] = monsterShots(1, 0, rng);
    if (s.ai.monsterShot(s.sys.monsters[0], shot.yaw, shot.damage, 'POSS')) hits++;
  }
  console.log(`Jogador 400 para o lado: ${hits} acertos em 2000 (${(hits / 20).toFixed(2)}%)`);
  check(hits < 1000, 'jogador fora da mira: erra na maioria dos casos');
  const up = { x: 800, y: 500, z: 80, alive: true };
  const u = aiSystem(room(2048, [], [S(0, 512)]), [[3004, 500, 500, 0]], { player: up });
  check(u.ai.monsterShot(u.sys.monsters[0], 0, 3, 'POSS'), 'mira vertical acerta o jogador 80 acima');
}

// --- l) tryMove ---
{
  const mon = (x, y, z = 0) => ({ x, y, floorZ: z });
  const walk = (world, m, dx, n, solids = [], r = 20) => { for (let i = 0; i < n; i++) tryMove(world, m, m.x + dx, m.y, r, 56, solids); return m; };
  let m = walk(room(2048, [L(100, 0, 100, 2048)]), mon(50, 500), 4, 40);
  check(m.x + 20 <= 100, `não atravessa linha de um lado só (x ${m.x})`);
  const sec2 = (floor1, floor0 = 0) => [S(floor0, 256), S(floor1, 256)];
  const split = (x) => (px) => (px < x ? 0 : 1);
  for (const flag of [0x0001, 0x0002]) {
    const w = room(2048, [two(100, 0, 100, 2048, 0, 1, flag)], sec2(0), split(100));
    w.sectorAt = (px) => (px < 100 ? 0 : 1);
    m = walk(w, mon(50, 500), 4, 40);
    check(m.x + 20 <= 100, `flag 0x000${flag} bloqueia`);
  }
  const stepWorld = (h) => { const w = room(2048, [two(100, 0, 100, 2048, 0, 1)], sec2(h)); w.sectorAt = (px) => (px < 100 ? 0 : 1); return w; };
  m = walk(stepWorld(24), mon(50, 500), 4, 40);
  check(m.x > 120 && m.floorZ === 24, 'sobe degrau de 24 (z = 24)');
  m = walk(stepWorld(25), mon(50, 500), 4, 40);
  check(m.x + 20 <= 100 && m.floorZ === 0, 'degrau de 25 bloqueia');
  const dropWorld = (h) => { const w = room(2048, [two(100, 0, 100, 2048, 0, 1)], [S(h, 256), S(0, 256)]); w.sectorAt = (px) => (px < 100 ? 0 : 1); return w; };
  m = walk(dropWorld(30), mon(50, 500, 30), 4, 40);
  check(m.x + 20 <= 100 && m.floorZ === 30, 'não desce beirada de 30');
  m = walk(dropWorld(24), mon(50, 500, 24), 4, 40);
  check(m.x > 120 && m.floorZ === 0, 'desce beirada de 24 (z = 0)');
  const other = { x: 150, y: 500, radius: 20, ref: {} };
  m = walk(room(2048), mon(50, 500), 4, 40, [other]);
  check(m.x + 20 <= 130 + 1e-9, 'outro monstro vivo bloqueia');
  m = walk(room(2048), mon(50, 500), 4, 40, [{ x: 150, y: 500, radius: 10 }]);
  check(m.x + 20 <= 140, 'barril bloqueia');
  m = walk(room(2048), mon(50, 500), 4, 40, [{ x: 150, y: 500, radius: 16 }]);
  check(m.x + 20 <= 134, 'jogador bloqueia');
  const self = mon(50, 500);
  check(checkPosition(room(2048), 54, 500, 20, [{ x: 50, y: 500, radius: 20, ref: self }], self).ok, 'o próprio monstro não se bloqueia');
  // Corpos: getSolids e solidsFor só incluem atiráveis.
  const t = aiSystem(room(2048), [[3004, 500, 500], [3004, 560, 500]], { player: { x: 1900, y: 1900, z: 0, alive: true } });
  t.sys.damage(t.sys.monsters[1], 1000);
  check(!t.ai.solidsFor().some((s) => s.ref === t.sys.monsters[1]), 'corpo não bloqueia');

  // E1M1: cada monstro com IA persegue o início do jogador 1 por 2000 tics.
  const present = new Set(map.things.map((th) => th.type));
  const e1 = resolveMonsterTable(lumps, present);
  const scene = buildSpriteScene(wad, map, { extraFrames: extraSpriteFrames(e1.entries) });
  const typeOf = (o) => map.things[o.index].type;
  const world = { map, lines: buildCollisionLines(map), sectors: map.sectors };
  const oneSided = world.lines.filter((l) => l.oneSided);
  const start = map.things.find((th) => th.type === 1);
  const target = { x: start.x, y: start.y, z: map.sectors[findSector(map, start.x, start.y)].floorHeight, alive: true };
  const simulate = (seed, tics, trace) => {
    const r = new Rng(seed);
    const sys = new MonsterSystem(scene.objects, e1.entries, typeOf, r, {});
    new MonsterAI({ world, rng: r, player: () => target, noTarget: () => false,
      staticSolids: staticSolids(scene.objects, typeOf), onSound: () => {}, onPlayerDamaged: () => {} }).attach(sys);
    for (const mm of sys.monsters) if (mm.aiDef) { mm.target = 'player'; sys.setState(mm, 'chase'); }
    let crossings = 0, nan = 0, zBad = 0, overlap = 0;
    for (let i = 0; i < tics; i++) {
      const prev = sys.monsters.map((mm) => [mm.x, mm.y]);
      sys.tick();
      sys.monsters.forEach((mm, k) => {
        if (!mm.aiDef) return;
        if (![mm.x, mm.y, mm.floorZ, mm.angle].every(Number.isFinite)) nan++;
        const [ax, ay] = prev[k];
        if (ax !== mm.x || ay !== mm.y) {
          for (const l of oneSided) {
            if (Math.max(ax, mm.x) < l.minX || Math.min(ax, mm.x) > l.maxX || Math.max(ay, mm.y) < l.minY || Math.min(ay, mm.y) > l.maxY) continue;
            const side = (px, py) => (l.x2 - l.x1) * (py - l.y1) - (l.y2 - l.y1) * (px - l.x1);
            const s1 = side(ax, ay), s2 = side(mm.x, mm.y);
            const t1 = (mm.x - ax) * (l.y1 - ay) - (mm.y - ay) * (l.x1 - ax), t2 = (mm.x - ax) * (l.y2 - ay) - (mm.y - ay) * (l.x2 - ax);
            if (((s1 > 0 && s2 < 0) || (s1 < 0 && s2 > 0)) && ((t1 > 0 && t2 < 0) || (t1 < 0 && t2 > 0))) crossings++;
          }
          if (mm.floorZ !== checkPosition(world, mm.x, mm.y, mm.entry.radius).floor) zBad++;
        }
      });
      const live = sys.monsters.filter((mm) => mm.shootable);
      for (let a = 0; a < live.length; a++) {
        for (let b = a + 1; b < live.length; b++) {
          const r2 = live[a].entry.radius + live[b].entry.radius;
          const o = Math.min(r2 - Math.abs(live[a].x - live[b].x), r2 - Math.abs(live[a].y - live[b].y));
          if (o > 1) overlap++;
        }
      }
      if (trace) trace.push(sys.monsters.map((mm) => `${mm.x.toFixed(4)},${mm.y.toFixed(4)},${mm.state},${mm.frameIndex}`).join(';'));
    }
    const near128 = sys.monsters.filter((mm) => mm.aiDef && aproxDist(mm.x - target.x, mm.y - target.y) < 128).length;
    return { crossings, nan, zBad, overlap, near128, total: sys.monsters.filter((mm) => mm.aiDef).length, events: sys.takeEvents().length };
  };
  const res = simulate(2026, 2000);
  console.log(`E1M1 2000 tics: ${res.near128} de ${res.total} monstros a menos de 128 do alvo; cruzamentos ${res.crossings}, ` +
    `NaN ${res.nan}, z fora do chão ${res.zBad}, sobreposições > 1 ${res.overlap}`);
  check(res.crossings === 0 && res.nan === 0 && res.zBad === 0, 'E1M1: sem cruzar linhas de um lado só, sem NaN, z no chão');
  if (res.overlap) console.log(`AVISO: ${res.overlap} sobreposições de caixas maiores que 1 entre monstros vivos`);

  // --- m) Determinismo ---
  const t1 = [], t2 = [];
  const r1 = simulate(77, 1000, t1), r2 = simulate(77, 1000, t2);
  check(t1.join('|') === t2.join('|') && r1.events === r2.events, 'mesma semente: mesmo rastro em 1000 tics');

  // --- n) Lumps ---
  const aiPresent = [...present].filter((ty) => AI_TYPES.includes(ty));
  const removedAI = e1.removed.filter((r) => aiPresent.some((ty) => r.startsWith(`${ty} `)));
  console.log(`Tipos com IA no E1M1: ${aiPresent.join(', ')}; quadros ausentes: ${removedAI.join(', ') || 'nenhum'}; ` +
    `sem IA: ${e1.noAI.join('; ') || 'nenhum'}`);
  check(removedAI.length === 0 && e1.noAI.length === 0, 'todos os quadros de parado, corrida, ataque, dor e morte existem');
  check(aiPresent.every((ty) => e1.entries.get(ty).ai), 'todos os tipos com IA do E1M1 ficam com IA');
  const tex = scene.stats.texture;
  console.log(`Textura de sprites: ${tex.layers} camadas de ${tex.layerW}x${tex.layerH}, ${(tex.bytes / 1048576).toFixed(1)} MiB; ` +
    `descartados: ${scene.stats.droppedCategories.join(', ') || 'nada'}`);
  check(tex.layers <= 1024 && tex.bytes <= 256 * 1048576, 'textura dentro de 1024 camadas e 256 MiB');
  const keys = [...e1.entries.values()].filter((e) => e.ai).flatMap((e) => [...e.ai.see, ...(e.ai.melee ?? []), ...(e.ai.missile ?? [])].map(([l]) => e.prefix + l));
  check(keys.every((k) => scene.frames.has(k)), 'quadros de corrida e ataque na textura');
}

console.log(failures ? `${failures} falha(s)` : 'Tudo certo');
process.exit(failures ? 1 : 0);
