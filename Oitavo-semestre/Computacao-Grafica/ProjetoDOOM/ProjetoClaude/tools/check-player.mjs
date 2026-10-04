// Verificação do dano ao jogador, da morte, dos flashes e do rosto, sem navegador.
// Uso: node tools/check-player.mjs. Sai com código diferente de zero se algo falhar.

import fs from 'node:fs';
import { WadFile } from '../src/wad/WadFile.js';
import { findSpriteLumps } from '../src/wad/Sprites.js';
import { PlayerStats } from '../src/game/PlayerStats.js';
import { applyDamage, deathSound } from '../src/game/PlayerDamage.js';
import { deathEyeHeight, turnTowards, canRestart } from '../src/game/PlayerDeath.js';
import { FaceState, painLevel, EVIL_TICS } from '../src/hud/face.js';
import { computeTintTable, flashPalette, tintFor } from '../src/gpu/palettesTint.js';
import { TINT_POST_UNIFORM } from '../src/gpu/Display.js';
import { createWeapons, tickWeapons, killWeapons, startRaise, WEAPONTOP, WEAPONBOTTOM, PISTOL } from '../src/game/weapons.js';
import { Rng } from '../src/game/Rng.js';
import { resolveMonsterTable } from '../src/game/monsterTable.js';
import { MonsterSystem } from '../src/game/MonsterSystem.js';
import { MonsterAI } from '../src/game/MonsterAI.js';
import { radiusAttack, BARREL_DAMAGE } from '../src/game/radiusAttack.js';

let failures = 0;
const check = (cond, label) => {
  if (!cond) { failures++; console.log(`FALHA: ${label}`); }
  return cond;
};
const always = { next255: () => 0 }; // 0 < 255: sempre toca o som de dor
const bytes = fs.readFileSync(new URL('../assets/freedoom1.wad', import.meta.url));
const wad = new WadFile(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));

const withArmor = (armor, type) => { const s = new PlayerStats(); s.armor = armor; s.armorType = type; return s; };

// --- a) Armadura ---
{
  let s = withArmor(100, 1);
  let r = applyDamage(s, 10, null, 'test', always);
  check(r.savedByArmor === 3 && s.armor === 97 && s.health === 93 && r.applied === 7, `tipo 1, dano 10: absorve 3, armadura 97, vida 93 (${s.armor}, ${s.health})`);
  s = withArmor(100, 2);
  r = applyDamage(s, 10, null, 'test', always);
  check(r.savedByArmor === 5 && s.armor === 95 && s.health === 95, 'tipo 2, dano 10: absorve 5, armadura 95');
  check(applyDamage(withArmor(100, 1), 7, null, 't', always).savedByArmor === 2 && applyDamage(withArmor(100, 2), 7, null, 't', always).savedByArmor === 3, 'dano 7: absorve 2 (tipo 1) e 3 (tipo 2)');
  s = withArmor(2, 1);
  r = applyDamage(s, 30, null, 'test', always);
  check(r.savedByArmor === 2 && s.armor === 0 && s.armorType === 0 && s.health === 72, `armadura 2, dano 30: absorve 2, tipo 0, vida 72 (${s.health})`);
  check(applyDamage(withArmor(100, 1), 3, null, 't', always).savedByArmor === 1, 'dano 3 tipo 1: absorve 1');
  s = new PlayerStats();
  r = applyDamage(s, 13, null, 'test', always);
  check(r.savedByArmor === 0 && s.health === 87, 'sem armadura: dano integral');
  check([s.health, s.armor, s.damageCount].every(Number.isInteger), 'valores inteiros');
  check(r.events.some((e) => e.type === 'playerPain'), 'evento de dor');
}

// --- b) Contadores ---
{
  const s = withArmor(100, 1);
  applyDamage(s, 30, null, 't', always);
  check(s.damageCount === 20, `damageCount soma o dano pós-armadura (${s.damageCount})`);
  applyDamage(s, 150, null, 't', always);
  check(s.damageCount === 100, 'damageCount limitado a 100');
  for (let i = 0; i < 99; i++) s.tickDamage();
  check(s.damageCount === 1, 'decai 1 por tic');
  s.tickDamage(); s.tickDamage();
  check(s.damageCount === 0, 'para em 0');
}

// --- c) Paleta de flash ---
{
  const cases = [[0, 0, 0], [1, 0, 2], [8, 0, 2], [9, 0, 3], [16, 0, 3], [17, 0, 4], [24, 0, 4], [33, 0, 6], [40, 0, 6],
    [57, 0, 8], [100, 0, 8], [0, 1, 10], [0, 8, 10], [0, 9, 11], [0, 16, 11], [0, 17, 12], [0, 60, 12], [0, 6, 10], [5, 30, 2]];
  const bad = cases.filter(([d, b, p]) => flashPalette(d, b) !== p);
  check(bad.length === 0, `paleta de flash (erradas: ${bad.map((c) => c.join('/')).join(' ')})`);
}

// --- d) Tabela de mistura ---
{
  const table = computeTintTable(wad.getLumpBytes(wad.findLump('PLAYPAL')));
  console.log(`t_k e erro médio por canal: ${table.map((e) => `${e.palette}:${e.t.toFixed(3)}/${e.error.toFixed(2)}`).join('  ')}`);
  check(table[0].t === 0 && table[13].t === 0 && tintFor(table, 0)[3] === 0, 't_0 = t_13 = 0 e tint nulo na paleta 0');
  if (table.some((e) => e.error > 6)) console.log('AVISO: alguma paleta com erro médio acima de 6');
  const grows = (a, b) => table.slice(a, b + 1).every((e, i, arr) => i === 0 || e.t > arr[i - 1].t);
  if (!grows(1, 8) || !grows(9, 12)) console.log('AVISO: t não cresce com k dentro de um grupo');
  check(tintFor(table, 8, false)[3] === 0, 'flashes desligados: tint nulo');
}

// --- e) Morte ---
{
  const s = new PlayerStats();
  const r = applyDamage(s, 160, null, 'test', always);
  check(s.isDead && r.died && s.health === -60 && r.events[0].type === 'playerDied' && s.deathTics === 0, 'vida <= 0: morto (overkill -60)');
  const after = applyDamage(s, 50, { x: 0, y: 0 }, 'test', always);
  check(after.applied === 0 && s.health === -60, 'dano depois de morto não muda nada');
  const has = (yes) => (n) => yes && n === 'pdiehi';
  check(deathSound(-60, has(true)) === 'pdiehi' && deathSound(-50, has(true)) === 'pldeth' && deathSound(-60, has(false)) === 'pldeth', 'som de morte: pdiehi abaixo de -50, senão pldeth');
  check(deathEyeHeight(0) === 41 && deathEyeHeight(35) === 6 && deathEyeHeight(200) === 6 && deathEyeHeight(10) === 31, 'olho: 41 no tic 0, 6 a partir do 35');
  const w = createWeapons({ current: PISTOL });
  w.state = 'ready'; w.sy = WEAPONTOP;
  killWeapons(w);
  let n = 0;
  while (w.sy < WEAPONBOTTOM && n < 100) { tickWeapons(w, { fire: true }, s, n, []); n++; }
  const ev = [];
  for (let i = 0; i < 50; i++) tickWeapons(w, { fire: true }, s, i, ev);
  check(n === 16 && w.sy === WEAPONBOTTOM && w.state === 'dead' && ev.length === 0, `arma desce em ${n} tics (16) e fica, sem disparar`);
  let t = turnTowards(0, 90);
  check(t.angle === 5 && !t.locked, 'gira 5 graus por tic');
  t = turnTowards(88, 90);
  check(t.angle === 90 && t.locked, 'a menos de 5 graus, trava na direção');
  t = turnTowards(10, 340);
  check(t.angle === 5, 'gira pelo lado mais curto');
  check(!canRestart(34) && canRestart(35), 'reinício só a partir de 35 tics');
  // Reinício: a mesma rotina do NEW GAME (stats.reset, arma subindo).
  s.damageCount = 40; s.bonusCount = 12; s.deathTics = 80;
  s.reset();
  startRaise(w, PISTOL);
  check(s.health === 100 && s.armor === 0 && s.ammo.clip === 50 && w.current === PISTOL && w.state === 'raise' &&
    s.damageCount === 0 && s.bonusCount === 0 && s.deathTics === 0 && s.lastAttacker === null, 'depois do reinício: vida 100, pistola com 50 balas, contadores zerados');
}

// --- f) Rosto ---
const patches = new Proxy({}, { get: () => ({}) }); // todos os lumps "existem"
const P = { x: 0, y: 0, angle: 0 };
{
  const s = new PlayerStats();
  const f = new FaceState();
  s.health = 0;
  check(f.wanted(s, P, false) === 'STFDEAD0', 'morto: STFDEAD0');
  s.health = 100;
  f.onWeaponGained();
  for (let i = 0; i < EVIL_TICS - 1; i++) f.tick();
  check(f.wanted(s, P, false) === 'STFEVL0', 'sorriso durante 70 tics');
  f.tick();
  check(f.wanted(s, P, false).startsWith('STFST0'), 'sorriso termina no tic 70');
  f.onDamage(21, { x: 100, y: 0 });
  check(f.wanted(s, P, false) === 'STFOUCH0', 'golpe de 21: STFOUCH');
  f.onDamage(10, { x: 100, y: 0 });
  check(f.wanted(s, P, false) === 'STFKILL0', 'golpe de 10 de frente: STFKILL');
  f.onDamage(10, { x: 0, y: -100 });
  check(f.wanted(s, P, false) === 'STFTR00', 'atacante à direita: STFTR');
  f.onDamage(10, { x: 0, y: 100 });
  check(f.wanted(s, P, false) === 'STFTL00', 'atacante à esquerda: STFTL');
  f.onDamage(10, null);
  check(f.wanted(s, P, false) === 'STFKILL0', 'barril (sem atacante), golpe pequeno: STFKILL');
  f.onDamage(30, null);
  check(f.wanted(s, P, false) === 'STFOUCH0', 'barril, golpe grande: STFOUCH');
  for (let i = 0; i < 35; i++) f.tick();
  check(f.wanted(s, P, true) === 'STFGOD0', 'godMode: STFGOD0 (depois dos 35 tics de dano)');
  const looks = new Set();
  for (let i = 0; i < 17 * 40; i++) { f.tick(); looks.add(f.wanted(s, P, false)); }
  check([...looks].every((n) => /^STFST0[012]$/.test(n)) && looks.size === 3, `normal: STFST0{0,1,2} (${[...looks].join(', ')})`);
  const levels = [100, 99, 80, 60, 40, 20, 1].map(painLevel);
  console.log(`Nível de dor (fórmula) para vida 100, 99, 80, 60, 40, 20, 1: ${levels.join(', ')}`);
  check(levels.join() === '0,0,0,1,2,3,4', 'nível de dor pela fórmula floor((100 - vida) * 5 / 101)');
  check(painLevel(-50) === 4 && painLevel(150) === 0, 'nível de dor com vida negativa e acima de 100');
  // Determinismo do sorteio (gerador próprio).
  const a = new FaceState(), b = new FaceState();
  let same = true;
  for (let i = 0; i < 500; i++) { a.tick(); b.tick(); if (a.straight !== b.straight) same = false; }
  check(same, 'sorteio do rosto determinístico');
  const missing = { STFST01: {}, STFST21: {} };
  const g = new FaceState();
  g.onDamage(30, null);
  const prevWarn = console.warn; console.warn = () => {};
  check(g.lump(s, P, false, missing) === 'STFST01', 'lump ausente: rosto reto');
  console.warn = prevWarn;
  void patches;
}

// --- g) Fluxo completo: sargento a 40 unidades ---
const { lumps } = findSpriteLumps(wad);
const table = resolveMonsterTable(lumps, new Set([3002]));
const L = (x1, y1, x2, y2) => ({ x1, y1, x2, y2, minX: Math.min(x1, x2), maxX: Math.max(x1, x2),
  minY: Math.min(y1, y2), maxY: Math.max(y1, y2), front: 0, back: -1, oneSided: true, flags: 0 });
const synthMap = { nodes: [], ssectors: [{ segCount: 1, firstSeg: 0 }], segs: [{ linedef: 0, direction: 0 }],
  linedefs: [{ rightSidedef: 0, leftSidedef: 0xFFFF }], sidedefs: [{ sector: 0 }] };
const room = { map: synthMap, sectors: [{ floorHeight: 0, ceilingHeight: 256, ceilingTexture: 'CEIL' }], sectorAt: () => 0,
  lines: [L(0, 0, 2048, 0), L(2048, 0, 2048, 2048), L(2048, 2048, 0, 2048), L(0, 2048, 0, 0)] };
function fight(seed, { armor = 0, armorType = 0, god = false, tics = 900 } = {}) {
  const stats = new PlayerStats();
  stats.armor = armor; stats.armorType = armorType;
  const player = { x: 540, y: 500, z: 0, get alive() { return !stats.isDead; } };
  const rng = new Rng(seed);
  const sys = new MonsterSystem([{ index: 0, x: 500, y: 500, angle: 0, flags: 0, base: [500, 0, -500] }], table.entries, () => 3002, rng, {});
  let bites = 0, afterDeath = 0, diedAt = -1, standAt = -1;
  new MonsterAI({ world: room, rng, player: () => player, noTarget: () => false, staticSolids: [],
    onSound: () => {}, onPlayerDamaged: (amount, source, kind, attacker) => {
      const r = applyDamage(stats, amount, attacker, source, rng, god);
      if (diedAt >= 0) afterDeath += r.applied;
      else bites++;
    } }).attach(sys);
  const m = sys.monsters[0];
  for (let t = 1; t <= tics; t++) {
    sys.tick();
    if (stats.isDead && diedAt < 0) diedAt = t;
    if (diedAt >= 0 && standAt < 0 && m.state === 'stand') standAt = t - diedAt;
    if (diedAt >= 0 && t - diedAt > 60) break;
  }
  return { died: diedAt >= 0, bites, afterDeath, standAt, health: stats.health };
}
{
  let deaths = 0, extra = 0, slowStand = 0, bitesNone = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const r = fight(seed);
    if (r.died) { deaths++; bitesNone += r.bites; if (r.standAt < 0 || r.standAt > 40) slowStand++; }
    extra += r.afterDeath;
  }
  console.log(`Sargento a 40: o jogador morre em ${deaths} de 100 sementes (900 tics); média de ${(bitesNone / deaths).toFixed(2)} mordidas`);
  check(deaths >= 95, 'morre em ao menos 95 de 100');
  check(extra === 0, 'nenhum dano depois da morte');
  check(slowStand === 0, 'o sargento volta a parado em até 40 tics depois da morte');
  let godDeaths = 0;
  for (let seed = 1; seed <= 20; seed++) if (fight(seed, { god: true }).died) godDeaths++;
  check(godDeaths === 0, 'godMode: nunca morre');
  let blueBites = 0, blueDeaths = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const r = fight(seed, { armor: 200, armorType: 2, tics: 3000 });
    if (r.died) { blueDeaths++; blueBites += r.bites; }
  }
  console.log(`Com armadura azul: morre em ${blueDeaths} de 100; média de ${(blueBites / blueDeaths).toFixed(2)} mordidas (sem armadura: ${(bitesNone / deaths).toFixed(2)})`);
  check(blueBites / blueDeaths > bitesNone / deaths, 'armadura azul aumenta as mordidas até morrer');
}

// --- h) Barril ---
{
  const stats = new PlayerStats();
  stats.health = 200; // a 40 unidades o barril tira 104: com 100 de vida o rosto seria o de morto
  const face = new FaceState();
  const rng = new Rng(3);
  const applied = radiusAttack(room, { x: 500, y: 500 }, BARREL_DAMAGE, null, [], rng, {
    player: { x: 540, y: 500, radius: 16 },
    onPlayerDamaged: (amount) => { const r = applyDamage(stats, amount, null, 'BAR1', rng); face.onDamage(r.applied, null); },
  });
  const name = face.wanted(stats, { x: 540, y: 500, angle: 0 }, false);
  console.log(`Barril a 40: dano ${applied[0]?.amount}, vida ${stats.health}, rosto ${name}`);
  check(applied.length === 1 && stats.health === 200 - applied[0].amount && stats.lastAttacker === null, 'explosão aplica o dano do radiusAttack, sem atacante');
  check(/^STF(KILL|OUCH)\d$/.test(name), 'rosto: STFKILL ou STFOUCH');
}

// --- i) Lumps ---
{
  const names = ['STFGOD0', 'STFDEAD0'];
  for (let p = 0; p < 5; p++) {
    for (let r = 0; r < 3; r++) names.push(`STFST${p}${r}`);
    names.push(`STFTR${p}0`, `STFTL${p}0`, `STFOUCH${p}`, `STFEVL${p}`, `STFKILL${p}`);
  }
  const missing = names.filter((n) => wad.findLump(n) < 0);
  console.log(`Lumps do rosto ausentes: ${missing.join(', ') || 'nenhum'}`);
  check(missing.length === 0, 'todos os lumps do rosto existem');
  const sounds = ['DSPLPAIN', 'DSPLDETH'].filter((n) => wad.findLump(n) < 0);
  check(sounds.length === 0, `sons plpain e pldeth (ausentes: ${sounds.join(', ') || 'nenhum'})`);
  console.log(`pdiehi (opcional): ${wad.findLump('DSPDIEHI') >= 0 ? 'presente' : 'ausente'}`);
}

// --- j) Uniform do blit com flash ---
{
  const src = fs.readFileSync(new URL('../src/shaders/blitTint.wgsl', import.meta.url), 'utf8');
  const body = /struct PostUniforms\s*\{([\s\S]*?)\};/.exec(src)[1].replace(/\/\/.*$/gm, '');
  const fields = [...body.matchAll(/(\w+)\s*:\s*(vec[234]<f32>|f32)/g)].map((mm) => ({ name: mm[1], type: mm[2] }));
  const layout = { f32: [4, 4], 'vec2<f32>': [8, 8], 'vec3<f32>': [16, 12], 'vec4<f32>': [16, 16] };
  let offset = 0, align = 0;
  const offsets = {};
  for (const fl of fields) {
    const [a, size] = layout[fl.type];
    offset = Math.ceil(offset / a) * a;
    offsets[fl.name] = offset;
    offset += size;
    align = Math.max(align, a);
  }
  const total = Math.ceil(offset / align) * align;
  console.log(`PostUniforms (blitTint.wgsl): ${fields.map((fl) => `${fl.name}@${offsets[fl.name]}`).join(', ')}; tamanho ${total}`);
  check(total === TINT_POST_UNIFORM.bytes && offsets.tint === TINT_POST_UNIFORM.tintOffset && TINT_POST_UNIFORM.floats * 4 === total,
    `uniform de ${total} bytes com tint no offset ${offsets.tint} confere com o código`);
  const orig = fs.readFileSync(new URL('../src/shaders/blit.wgsl', import.meta.url), 'utf8');
  check(!/tint/.test(orig), 'blit.wgsl original sem mudanças de flash');
}

console.log(failures ? `${failures} falha(s)` : 'Tudo certo');
process.exit(failures ? 1 : 0);
