// Verificação do combate sem navegador. Uso: node tools/check-combat.mjs
// Sai com código diferente de zero se algo falhar.

import fs from 'node:fs';
import { WadFile } from '../src/wad/WadFile.js';
import { loadMap } from '../src/wad/MapData.js';
import { findSector } from '../src/map/bsp.js';
import { findSpriteLumps } from '../src/wad/Sprites.js';
import { buildCollisionLines } from '../src/physics/collisionData.js';
import { closestPointOnSegment } from '../src/physics/collision.js';
import { buildSpriteScene } from '../src/sprites/spriteLogic.js';
import { Rng } from '../src/game/Rng.js';
import { resolveMonsterTable, extraSpriteFrames, MONSTER_TABLE } from '../src/game/monsterTable.js';
import { MonsterSystem } from '../src/game/MonsterSystem.js';
import { shoot, rayCylinder, MISSILE_RANGE } from '../src/game/hitscan.js';
import { radiusAttack, blastDamage, hasLineOfSight } from '../src/game/radiusAttack.js';
import { EffectList, MAX_EFFECTS } from '../src/game/effects.js';

let failures = 0;
const check = (cond, label) => {
  if (!cond) { failures++; console.log(`FALHA: ${label}`); }
  return cond;
};
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

// --- a) Rng ---
const r1 = new Rng(1234), r2 = new Rng(1234);
const seqA = Array.from({ length: 20 }, () => r1.next255()), seqB = Array.from({ length: 20 }, () => r2.next255());
check(seqA.join() === seqB.join(), 'semente fixa: sequência reproduzível');
const rr = new Rng(42);
const damages = new Set();
let in255 = true;
for (let i = 0; i < 3000; i++) {
  const v = rr.next255();
  if (v < 0 || v > 255 || !Number.isInteger(v)) in255 = false;
  damages.add(5 * (rr.next255() % 3 + 1));
}
check(in255, 'next255 entre 0 e 255');
check([...damages].sort((a, b) => a - b).join() === '5,10,15', `dano só 5, 10 e 15 (vistos: ${[...damages].join(', ')})`);
const f = new Rng(7).nextFloat();
check(f >= 0 && f < 1 && new Rng(7).nextRange(10, 20) >= 10, 'nextFloat e nextRange');

// --- b) Cilindro ---
const O = { x: 0, y: 0, z: 41 };
const D = { x: 1, y: 0 };
check(rayCylinder(O, D, 0, 100, 0, 20, 0, 56, 2048)?.t === 80, 'dentro da altura: entra em t = 80');
check(rayCylinder(O, D, 0, 100, 0, 20, 50, 56, 2048) === null, 'raio abaixo do monstro');
check(rayCylinder(O, D, 0, 100, 0, 20, -100, 56, 2048) === null, 'raio acima do monstro');
check(rayCylinder(O, D, 0, 100, 20, 20, 0, 56, 2048) !== null, 'pela borda (tangente)');
check(rayCylinder(O, D, 0, 100, 20.5, 20, 0, 56, 2048) === null, 'fora da borda');
const inside = rayCylinder(O, D, 0, 5, 0, 20, 0, 56, 2048);
check(inside !== null && inside.t >= 0, 'origem dentro do círculo');
check(rayCylinder(O, D, 0, -100, 0, 20, 0, 56, 2048) === null, 'círculo atrás da origem');
check(rayCylinder(O, D, Math.tan(Math.PI / 4), 100, 0, 20, 0, 56, 2048) === null, 'olhando para cima passa por cima');

// --- c) hitscan em mapa sintético ---
const L = (x1, y1, x2, y2, extra = {}) => ({ x1, y1, x2, y2, minX: Math.min(x1, x2), maxX: Math.max(x1, x2),
  minY: Math.min(y1, y2), maxY: Math.max(y1, y2), front: 0, back: -1, oneSided: true, flags: 0, ...extra });
const synthMap = { nodes: [], ssectors: [{ segCount: 1, firstSeg: 0 }], segs: [{ linedef: 0, direction: 0 }],
  linedefs: [{ rightSidedef: 0, leftSidedef: 0xFFFF }], sidedefs: [{ sector: 0 }] };
const room = (size, extraLines = [], sectors = [{ floorHeight: 0, ceilingHeight: 128, ceilingTexture: 'CEIL' }]) => ({
  map: synthMap, sectors,
  lines: [L(0, 0, size, 0), L(size, 0, size, size), L(size, size, 0, size), L(0, size, 0, 0), ...extraLines],
});
let hit = shoot(room(512), { x: 100, y: 256, z: 41 }, 0, 0, MISSILE_RANGE, []);
check(hit.kind === 'wall' && near(hit.t, 412) && near(hit.x, 512), `parede de um lado só a 412 (${hit.kind} ${hit.t})`);
const windowSectors = [{ floorHeight: 0, ceilingHeight: 128 }, { floorHeight: 64, ceilingHeight: 100 }];
const win = room(512, [L(300, 0, 300, 512, { oneSided: false, back: 1 })], windowSectors);
hit = shoot(win, { x: 100, y: 256, z: 80 }, 0, 0, MISSILE_RANGE, []);
check(hit.kind === 'wall' && near(hit.t, 412), `janela: passa com z = 80 na abertura 64..100 (${hit.kind} ${hit.t})`);
hit = shoot(win, { x: 100, y: 256, z: 41 }, 0, 0, MISSILE_RANGE, []);
check(hit.kind === 'wall' && near(hit.t, 200) && hit.line.oneSided === false, `janela: bate abaixo da abertura (${hit.kind} ${hit.t})`);
hit = shoot(win, { x: 100, y: 256, z: 110 }, 0, 0, MISSILE_RANGE, []);
check(hit.kind === 'wall' && near(hit.t, 200), 'janela: bate acima da abertura');
hit = shoot(room(512), { x: 100, y: 256, z: 41 }, 0, -45, MISSILE_RANGE, []);
check(hit.kind === 'plane' && near(hit.t, 41) && near(hit.z, 0), `pitch -45: piso a 41 (${hit.kind} ${hit.t})`);
hit = shoot(room(512), { x: 100, y: 256, z: 41 }, 0, 30, MISSILE_RANGE, []);
check(hit.kind === 'plane' && near(hit.t, 87 / Math.tan(Math.PI / 6)) && near(hit.z, 128), `pitch +30: teto a ${(87 / Math.tan(Math.PI / 6)).toFixed(2)}`);
hit = shoot(room(5000), { x: 100, y: 2500, z: 41 }, 0, 0, MISSILE_RANGE, []);
check(hit.kind === 'none', `parede a 4900 (além de 2048): none (${hit.kind})`);
// Monstro antes e depois da parede.
const fakeMonster = (x) => ({ x, y: 256, floorZ: 0, shootable: true, entry: { radius: 20, height: 56 } });
hit = shoot(room(512), { x: 100, y: 256, z: 41 }, 0, 0, MISSILE_RANGE, [fakeMonster(300)]);
check(hit.kind === 'monster' && near(hit.t, 180), 'monstro antes da parede é atingido');
hit = shoot(win, { x: 100, y: 256, z: 41 }, 0, 0, MISSILE_RANGE, [fakeMonster(400)]);
check(hit.kind === 'wall', 'monstro atrás da parede da janela não é atingido');

// --- d) hitscan no E1M1 ---
const bytes = fs.readFileSync(new URL('../assets/freedoom1.wad', import.meta.url));
const wad = new WadFile(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const map = loadMap(wad, 'E1M1');
const spawn = map.things.find((t) => t.type === 1);
const world = { map, lines: buildCollisionLines(map), sectors: map.sectors };
const eye = { x: spawn.x, y: spawn.y, z: map.sectors[findSector(map, spawn.x, spawn.y)].floorHeight + 41 };
const oneSided = world.lines.filter((l) => l.oneSided);
const crossesStrict = (ax, ay, bx, by, l) => {
  const s = (px, py, qx, qy, rx, ry) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
  const d1 = s(l.x1, l.y1, l.x2, l.y2, ax, ay), d2 = s(l.x1, l.y1, l.x2, l.y2, bx, by);
  const d3 = s(ax, ay, bx, by, l.x1, l.y1), d4 = s(ax, ay, bx, by, l.x2, l.y2);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
};
for (const pitch of [0, 10]) {
  const kinds = {};
  let nan = 0, offLine = 0, crossed = 0;
  for (let deg = 0; deg < 360; deg++) {
    const h = shoot(world, eye, deg, pitch, MISSILE_RANGE, []);
    kinds[h.kind] = (kinds[h.kind] ?? 0) + 1;
    if (![h.t, h.x, h.y, h.z].every(Number.isFinite)) { nan++; continue; }
    if (h.kind === 'wall' && closestPointOnSegment(h.x, h.y, h.line).d >= 0.5) offLine++;
    // Força bruta: nenhuma linha de um lado só cruza o raio antes do ponto de batida.
    const a = deg * Math.PI / 180, tEnd = h.t - 0.01;
    const bx = eye.x + Math.cos(a) * tEnd, by = eye.y + Math.sin(a) * tEnd;
    if (oneSided.some((l) => crossesStrict(eye.x, eye.y, bx, by, l))) crossed++;
  }
  console.log(`E1M1 pitch ${pitch}: ${JSON.stringify(kinds)}; NaN ${nan}, fora do segmento ${offLine}, atravessou parede ${crossed}`);
  check(nan === 0 && offLine === 0 && crossed === 0, `hitscan no E1M1 com pitch ${pitch}`);
}

// --- e) e f) Dano e estados ---
const { lumps } = findSpriteLumps(wad);
const table = resolveMonsterTable(lumps, new Set([3004, 2035, 3001, 3002, 58, 9, 3005, 3003, 3006]));
const fixedRng = (v) => ({ next255: () => v });
function system(specs, rng = fixedRng(255), extraCb = {}) {
  const objects = specs.map(([, x, y], index) => ({ index, x, y, base: [x, 0, -y] }));
  const sounds = [], kills = [], explodes = [];
  const sys = new MonsterSystem(objects, table.entries, (o) => specs[o.index][0], rng, {
    onSound: (n, m) => sounds.push([n, m.thingIndex]), onKill: (m) => kills.push(m.thingIndex),
    onExplode: (m) => { explodes.push(m.thingIndex); extraCb.onExplode?.(m, sys); },
  });
  return { sys, sounds, kills, explodes };
}
let s = system([[3004, 0, 0]]);
let z = s.sys.monsters[0];
for (let i = 0; i < 3; i++) s.sys.damage(z, 5);
check(z.health === 5 && z.shootable && z.state === 'stand', 'zumbi: 3 danos de 5 não matam (rng 255: sem dor)');
s.sys.damage(z, 5);
check(z.state === 'die' && !z.shootable && s.kills.length === 1, 'zumbi morre no 4º dano de 5');
check(['podth1', 'podth2', 'podth3'].includes(s.sounds.at(-1)[0]), 'som de morte do zumbi');
s.sys.damage(z, 50);
check(z.health === 0 && s.kills.length === 1, 'morto não recebe dano');
s = system([[3004, 0, 0], [3004, 0, 0]]);
s.sys.damage(s.sys.monsters[0], 128);
s.sys.damage(s.sys.monsters[1], 25);
check(s.sys.monsters[0].state === 'xdie' && s.sounds[0][0] === 'slop', 'dano 128: morte esfacelada com "slop"');
check(s.sys.monsters[1].state === 'die', 'dano 25 (vida -5): morte normal');
s = system([[3004, 0, 0]], fixedRng(0));
s.sys.damage(s.sys.monsters[0], 5);
check(s.sys.monsters[0].state === 'pain' && s.sounds[0][0] === 'popain', 'rng 0: dor em dano que não mata');
s = system([[3002, 0, 0], [3004, 0, 0], [3005, 0, 0]], fixedRng(255));
for (const m of s.sys.monsters) s.sys.damage(m, 5);
check(s.sys.monsters.every((m) => m.state === 'stand'), 'rng 255: sem dor em chance < 255');
// Sequências.
s = system([[3004, 0, 0]], fixedRng(0));
z = s.sys.monsters[0];
s.sys.damage(z, 5);
let tics = 0;
while (z.state === 'pain' && tics < 100) { s.sys.tick(); tics++; }
check(tics === 6 && z.state === 'stand', `dor do zumbi: 6 tics (G3 G3) e volta a parado (${tics})`);
s = system([[3004, 0, 0]]);
z = s.sys.monsters[0];
s.sys.damage(z, 20);
tics = 0;
while (z.state === 'die' && tics < 200) { s.sys.tick(); tics++; }
check(tics === 20 && z.state === 'dead' && s.sys.frameOf(z).letter === 'L' && !z.removed, `morte do zumbi: 20 tics, corpo em L (${tics})`);
for (let i = 0; i < 100; i++) s.sys.tick();
check(z.state === 'dead' && s.kills.length === 1, 'corpo permanece; morte contada uma vez');
s.sys.reset();
check(z.state === 'stand' && z.health === 20 && z.shootable, 'reset restaura');

// --- g) Barris e dano em raio ---
check(blastDamage({ x: 0, y: 0 }, { x: 0, y: 0 }, 0, 128) === 128, 'no centro: 128');
check(blastDamage({ x: 0, y: 0 }, { x: 84, y: 0 }, 20, 128) === 64, 'a 64 (descontando o raio 20): 64');
check(blastDamage({ x: 0, y: 0 }, { x: 148, y: 0 }, 20, 128) === 0 && blastDamage({ x: 0, y: 0 }, { x: 200, y: 0 }, 20, 128) === 0, 'a 128 ou mais: nada');
const walled = { lines: [L(50, -100, 50, 100)], sectors: [] };
check(!hasLineOfSight(walled, { x: 0, y: 0 }, { x: 100, y: 0 }) && hasLineOfSight({ lines: [], sectors: [] }, { x: 0, y: 0 }, { x: 100, y: 0 }), 'parede de um lado só bloqueia a visão');
const door = { lines: [L(50, -100, 50, 100, { oneSided: false, back: 1 })], sectors: [{ floorHeight: 0, ceilingHeight: 0 }, { floorHeight: 0, ceilingHeight: 128 }] };
check(!hasLineOfSight(door, { x: 0, y: 0 }, { x: 100, y: 0 }), 'porta fechada bloqueia a visão');
const openWorld = { lines: [], sectors: [] };
const chain = (specs) => system(specs, fixedRng(255), {
  onExplode: (m, sys) => radiusAttack(openWorld, m, 128, m, sys.monsters, null, { damage: (t, amt) => sys.damage(t, amt) }),
});
s = chain([[2035, 0, 0], [2035, 100, 0]]);
const [b1, b2] = s.sys.monsters;
s.sys.damage(b1, 20);
const explodeTic = [];
for (let t = 1; t <= 60; t++) {
  const before = s.explodes.length;
  s.sys.tick();
  if (s.explodes.length > before) explodeTic.push(t);
}
check(s.explodes.join() === '0,1' && explodeTic.join() === '10,20', `barris: explosões nos tics ${explodeTic.join(', ')} (esperado 10 e 20)`);
check(b1.removed && b2.removed && s.kills.length === 0, 'barris removidos no fim e não contam como monstros');
check(s.sounds.filter(([n]) => n === 'barexp').length === 2, 'cada barril toca "barexp"');
s = chain([[2035, 0, 0], [3004, 40, 0]]);
s.sys.damage(s.sys.monsters[0], 20);
for (let t = 0; t < 10; t++) s.sys.tick();
check(s.sys.monsters[1].state === 'xdie' && s.kills.length === 1, 'zumbi a 40 de um barril: morte esfacelada pela explosão');
let playerHit = 0;
radiusAttack(openWorld, { x: 0, y: 0 }, 128, null, [], null, { onPlayerDamaged: (v) => { playerHit += v; }, player: { x: 50, y: 0, radius: 16 } });
check(playerHit === 128 - 34, 'jogador: dano só informado ao callback');

// Efeitos.
const fx = new EffectList();
const er = new Rng(5);
for (let i = 0; i < MAX_EFFECTS + 10; i++) fx.spawnPuff(0, 0, 0, er);
check(fx.items.length === MAX_EFFECTS, 'máximo de 256 efeitos (descarta o mais antigo)');
fx.reset();
const blood = fx.spawnBlood(0, 0, 10, 5, er);
check(blood.frames.map((x) => x[0]).join('') === 'A' && fx.spawnBlood(0, 0, 0, 10, er).frames.map((x) => x[0]).join('') === 'BA' &&
  fx.spawnBlood(0, 0, 0, 15, er).frames.map((x) => x[0]).join('') === 'CBA', 'sangue começa em A, B ou C conforme o dano');
const z0 = blood.z;
fx.tick();
check(near(blood.z - z0, 1), 'efeito sobe 35 u/s (1 por tic)');

// --- h) Lumps ---
const present = new Set(map.things.map((t) => t.type));
const e1 = resolveMonsterTable(lumps, present);
console.log(`Tipos atiráveis no E1M1: ${[...e1.entries.keys()].join(', ')}; quadros removidos: ${e1.removed.join(', ') || 'nenhum'}; ` +
  `sem morte: ${e1.unresolved.join(', ') || 'nenhum'}`);
check(e1.unresolved.length === 0 && [...e1.entries.values()].every((e) => e.death.length > 0), 'todo tipo tem quadros de morte');
for (const e of e1.entries.values()) {
  const base = MONSTER_TABLE[e.type];
  const all = ['idle', 'pain', 'death', 'xdeath'].every((k) => (base[k]?.length ?? 0) === (e[k]?.length ?? 0));
  check(all, `tipo ${e.type}: todos os quadros da tabela existem`);
}
const scene = buildSpriteScene(wad, map, { extraFrames: extraSpriteFrames(e1.entries) });
check(scene.stats.missingExtra.length === 0, `PUFF, BLUD, BEXP e quadros de combate presentes (faltando: ${scene.stats.missingExtra.join(', ')})`);
for (const k of ['PUFFA', 'PUFFD', 'BLUDA', 'BLUDC', 'BEXPA', 'BEXPE']) check(scene.frames.has(k), `quadro ${k} na textura`);
console.log(`Camadas necessárias para os sprites do E1M1: ${scene.layers.length}`);

console.log(failures ? `${failures} falha(s)` : 'Tudo certo');
process.exit(failures ? 1 : 0);
