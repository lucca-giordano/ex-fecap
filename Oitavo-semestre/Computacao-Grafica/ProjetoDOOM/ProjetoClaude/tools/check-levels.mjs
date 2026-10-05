// Testes da etapa 23 (níveis, sessão, dificuldade, intermissão, menus e IDCLEV). Uso: node tools/check-levels.mjs
// Sem navegador: a GPU é um device falso que conta buffers e texturas vivos. Sai com código diferente de
// zero se algo falhar; avisos não falham.

import fs from 'node:fs';
import { loadWad } from './baseline-geometry.mjs';
import { digestOf, ALL_BASELINE_PATH } from './baseline-all-maps.mjs';
import { buildLevelData } from '../src/game/LevelData.js';
import { uploadLevel, liveCounts } from '../src/gpu/LevelGpu.js';
import { createLevelRuntime } from '../src/game/LevelRuntime.js';
import { createTextureBindGroupLayout, createLitPaletteTexture } from '../src/gpu/TextureSet.js';
import { TextureCache } from '../src/wad/TextureCache.js';
import { Rng } from '../src/game/Rng.js';
import { findSector } from '../src/map/bsp.js';
import { WORDS_PER_VERTEX } from '../src/map/vertexLayout.js';
import { listMaps, GameSession } from '../src/game/GameSession.js';
import { nextMap, LEVEL_ENTRY, applyPlayerEntry, SECRET_RETURN } from '../src/game/GameFlow.js';
import { skillParams, scaleDamage, RESPAWN_TICS } from '../src/game/skill.js';
import { skillFilter } from '../src/sprites/thingTable.js';
import { MonsterSystem } from '../src/game/MonsterSystem.js';
import { MonsterAI } from '../src/game/MonsterAI.js';
import { MissileSystem, MISSILE_TYPES } from '../src/game/Missiles.js';
import { AI_TABLE, REACTION_TIME } from '../src/game/aiTable.js';
import { MONSTER_TABLE, resolveMonsterTable } from '../src/game/monsterTable.js';
import { ITEM_TABLE } from '../src/game/itemTable.js';
import { findSpriteLumps } from '../src/wad/Sprites.js';
import { PlayerStats } from '../src/game/PlayerStats.js';
import { tryPickup } from '../src/game/pickups.js';
import { applyDamage } from '../src/game/PlayerDamage.js';
import { Intermission, percent } from '../src/game/Intermission.js';
import { loadIntermissionAssets, composeIntermission } from '../src/hud/IntermissionRenderer.js';
import { Finale, FINALE_TEXT_POS } from '../src/game/Finale.js';
import { Menu, SCREENS } from '../src/menu/Menu.js';
import { composeMenu, measureText } from '../src/menu/MenuRenderer.js';
import { loadMenuAssets } from '../src/menu/MenuAssets.js';
import { MENU_TEXT } from '../src/menu/menuText.js';
import { CheatReader, CLEV_WAIT_TICS } from '../src/game/Cheats.js';
import { tickLevel, openAllDoors, monsterUseDoor } from '../src/game/UseLines.js';
import { findLastLump } from '../src/wad/Textures.js';

let failures = 0;
const warnings = [];
function check(name, ok, detail = '') {
  console.log(`${ok ? 'OK  ' : 'FALHA'} ${name}${detail ? `: ${detail}` : ''}`);
  if (!ok) failures++;
  return ok;
}
const warn = (text) => { warnings.push(text); console.log(`AVISO ${text}`); };

// Constantes do WebGPU que os módulos usam (no navegador vêm do próprio WebGPU).
globalThis.GPUBufferUsage ??= { MAP_READ: 1, MAP_WRITE: 2, COPY_SRC: 4, COPY_DST: 8, INDEX: 16, VERTEX: 32, UNIFORM: 64, STORAGE: 128 };
globalThis.GPUTextureUsage ??= { COPY_SRC: 1, COPY_DST: 2, TEXTURE_BINDING: 4, STORAGE_BINDING: 8, RENDER_ATTACHMENT: 16 };
globalThis.GPUShaderStage ??= { VERTEX: 1, FRAGMENT: 2, COMPUTE: 4 };

// Device falso: conta objetos vivos e bytes; `failScope` faz o N-ésimo popErrorScope devolver um erro.
function fakeDevice({ failScope = 0 } = {}) {
  const live = { buffers: 0, textures: 0, bindGroups: 0 };
  const bytes = { buffers: 0, textures: 0 };
  let scopes = 0;
  const destroyable = (kind) => {
    live[kind]++;
    let destroyed = false;
    return { destroy() { if (!destroyed) { destroyed = true; live[kind]--; } } };
  };
  return {
    live, bytes,
    limits: { maxBufferSize: 268435456, maxStorageBufferBindingSize: 134217728, maxTextureArrayLayers: 1024, maxTextureDimension2D: 8192 },
    createBuffer: (d) => { bytes.buffers += d.size; return destroyable('buffers'); },
    createTexture: (d) => {
      const [w, h, l = 1] = d.size;
      bytes.textures += w * h * l * (d.format === 'rgba8unorm' ? 4 : 2);
      return { ...destroyable('textures'), createView: () => ({}) };
    },
    createBindGroup: () => { live.bindGroups++; return {}; },
    createBindGroupLayout: () => ({}),
    queue: { writeBuffer() {}, writeTexture() {} },
    pushErrorScope() {},
    popErrorScope: async () => (++scopes === failScope ? { message: 'erro de validação simulado' } : null),
  };
}

const wad = loadWad();
const maps = listMaps(wad);
const cache = { textures: new TextureCache(), spriteLumps: null };
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const tablesBefore = JSON.stringify([MISSILE_TYPES, AI_TABLE, MONSTER_TABLE, ITEM_TABLE]);
const sprite = { getBindGroupLayout: () => ({}) };

function depsFor(player = { x: 0, y: 0, z: 0, alive: false }, log = { sounds: [] }) {
  return {
    rng: new Rng(1), aiEnabled: () => true, noTarget: () => false,
    sound: (name, opts) => log.sounds.push([name, opts?.origin]),
    damagePlayer: () => ({ applied: 0 }), playerFeet: () => player, playerTarget: () => ({ x: player.x, y: player.y, radius: 16 }),
    useDoor: () => false,
  };
}

// --- a) Todos os mapas ExMy ---
console.log('\n--- a) todos os mapas ---');
check('a0 lista de mapas: 36 ExMy em ordem', maps.length === 36 && maps[0].name === 'E1M1' && maps.at(-1).name === 'E4M9' &&
  maps.every((m, i) => i === 0 || m.episode * 10 + m.map > maps[i - 1].episode * 10 + maps[i - 1].map), maps.map((m) => m.name).join(' '));
{
  const times = [];
  let allOk = true;
  for (const m of maps) {
    let d;
    try {
      d = buildLevelData(wad, m.name, { cache });
    } catch (err) {
      allOk = check(`a1 ${m.name} constrói`, false, err.message) && allOk;
      continue;
    }
    times.push(`${m.name} ${d.ms.toFixed(0)}`);
    const problems = [];
    for (const [label, geo] of [['paredes', d.walls], ['planos', d.flats], ['dinâmica', d.dyn]]) {
      const count = geo.vertexCount ?? geo.vertices.length / WORDS_PER_VERTEX;
      if (geo.indices.some((i) => i >= count)) problems.push(`${label}: índice fora`);
      for (let v = 0; v < count; v++) {
        for (let k = 0; k < 11; k++) if (Number.isNaN(geo.vertices[v * WORDS_PER_VERTEX + k])) { problems.push(`${label}: NaN`); v = count; break; }
      }
    }
    const s = d.map.sectors[d.spawnSector];
    if (!s) problems.push('início fora de setor');
    else if (s.ceilingHeight - s.floorHeight < 56) warn(`${m.name}: abertura no início ${s.ceilingHeight - s.floorHeight} < 56`);
    const layers = Math.max(d.wallLayers.size, d.flatLayers.size, d.spriteScene?.layers.length ?? 0);
    if (layers > 1024) problems.push(`${layers} camadas`);
    const dev = fakeDevice();
    const gpu = await uploadLevel(dev, d, { textureLayout: {}, paletteView: {}, spritePipeline: sprite });
    const mib = (dev.bytes.buffers + dev.bytes.textures) / 1048576;
    if (mib >= 256) problems.push(`memória ${mib.toFixed(0)} MiB`);
    else if (mib > 128) warn(`${m.name}: memória estimada ${mib.toFixed(0)} MiB`);
    gpu.dispose();
    if (problems.length) allOk = check(`a1 ${m.name}`, false, problems.join('; ')) && allOk;
  }
  check('a1 os 36 mapas constroem, com índices válidos, sem NaN, início dentro de um setor, camadas <= 1024 e < 256 MiB', allOk);
  console.log(`     tempo de construção (ms): ${times.join(', ')}`);
}

// --- b) Linhas de base ---
console.log('\n--- b) linhas de base ---');
{
  const all = JSON.parse(fs.readFileSync(ALL_BASELINE_PATH, 'utf8')).maps;
  const e1m1 = JSON.parse(fs.readFileSync(new URL('./baselines/geometry-e1m1.json', import.meta.url), 'utf8'));
  const differ = [];
  for (const m of maps) {
    const data = buildLevelData(wad, m.name, { cache });
    const full = data.staticWithoutExclusions();
    const d = digestOf({ wallsFull: full.walls, flatsFull: full.flats, walls: data.walls, flats: data.flats, dyn: data.dyn,
      map: data.map, scene: data.spriteScene, lines: data.collisionLines, info: data.specialsInfo, textures: data.textures, spawn: data.spawn });
    const base = all[m.name];
    if (JSON.stringify([d.static, d.excluded, d.dynamic, d.counts]) !== JSON.stringify([base.static, base.excluded, base.dynamic, base.counts])) differ.push(m.name);
    if (m.name === 'E1M1') {
      check('b1 E1M1 estático (paredes e planos) igual a geometry-e1m1.json',
        JSON.stringify(d.static.walls) === JSON.stringify(e1m1.walls) && JSON.stringify(d.static.flats) === JSON.stringify(e1m1.flats));
      check('b2 E1M1 estático com exclusões e dinâmico iguais a geometry-all.json',
        JSON.stringify(d.excluded) === JSON.stringify(base.excluded) && JSON.stringify(d.dynamic) === JSON.stringify(base.dynamic),
        `${d.dynamic.vertexCount} vértices dinâmicos`);
    }
  }
  // A parte 0 não achou mapas com falha; nenhuma correção mudou geometria, então nenhum hash pode mudar.
  check('b3 todos os mapas iguais a geometry-all.json (nenhuma correção mudou geometria)', differ.length === 0, differ.join(', ') || 'nenhum diferente');
}

// --- c) Vazamentos com device falso ---
console.log('\n--- c) vazamentos ---');
{
  const device = fakeDevice();
  const textureLayout = createTextureBindGroupLayout(device);
  const palette = createLitPaletteTexture(device, new Uint8Array(256 * 4 * 32)); // global: fica viva
  const start = { ...device.live };
  const startCounts = { ...liveCounts };
  let previous = null;
  for (let i = 0; i < 20; i++) {
    const data = buildLevelData(wad, i % 2 ? 'E1M2' : 'E1M1', { cache });
    const gpu = await uploadLevel(device, data, { textureLayout, paletteView: palette.view, spritePipeline: sprite });
    const rt = createLevelRuntime(data, depsFor());
    // Troca: o anterior só é descartado depois que o novo existe.
    if (previous) { previous.rt.dispose(); previous.gpu.dispose(); }
    previous = { gpu, rt };
  }
  const during = { ...device.live };
  previous.rt.dispose();
  previous.gpu.dispose();
  previous.gpu.dispose(); // descartar duas vezes não desconta de novo
  check('c1 20 cargas/descartes (E1M1 e E1M2 alternados): buffers e texturas vivos iguais ao início',
    device.live.buffers === start.buffers && device.live.textures === start.textures,
    `início ${start.buffers}/${start.textures}, com dois níveis ${during.buffers}/${during.textures}, fim ${device.live.buffers}/${device.live.textures}`);
  // Bind groups não têm destroy() no WebGPU (o coletor de lixo os libera quando ninguém os referencia):
  // a contagem de vivos fica nos contadores do LevelGpu, que descontam no dispose().
  check('c2 contadores do LevelGpu (buffers, texturas e bind groups) voltam ao início', sum(liveCounts) === sum(startCounts) &&
    liveCounts.bindGroups === startCounts.bindGroups, JSON.stringify(liveCounts));

  // Falha no meio da construção (2º escopo: texturas e buffers estáticos): erro e nada vivo; o atual intacto.
  const current = await uploadLevel(device, buildLevelData(wad, 'E1M1', { cache }), { textureLayout, paletteView: palette.view, spritePipeline: sprite });
  const before = { ...device.live };
  const failing = fakeDevice({ failScope: 2 });
  let threw = false;
  try {
    await uploadLevel(failing, buildLevelData(wad, 'E1M3', { cache }), { textureLayout, paletteView: palette.view, spritePipeline: sprite });
  } catch {
    threw = true;
  }
  check('c3 falha de validação no meio: erro lançado e nada vivo do nível novo', threw && failing.live.buffers === 0 && failing.live.textures === 0,
    `vivos ${failing.live.buffers}/${failing.live.textures}`);
  check('c4 ... e o nível atual continua intacto', JSON.stringify(device.live) === JSON.stringify(before) && current.staticBuffers.vertex !== null);
  current.dispose();
  // Falha só nos buffers dinâmicos (1º escopo): segue com o estático sem exclusões.
  const dynFail = fakeDevice({ failScope: 1 });
  const data = buildLevelData(wad, 'E1M1', { cache });
  const gpu = await uploadLevel(dynFail, data, { textureLayout, paletteView: palette.view, spritePipeline: sprite });
  const full = data.staticWithoutExclusions();
  check('c5 falha nos buffers dinâmicos: setores móveis desligados e estático sem exclusões',
    !gpu.movingEnabled && gpu.dynamic === null && gpu.walls.vertexCount === full.walls.vertexCount);
  gpu.dispose();
  check('c6 ... e o descarte libera tudo', dynFail.live.buffers === 0 && dynFail.live.textures === 0);
}

// --- Mundo sintético para a IA (como o check-ai) ---
const L = (x1, y1, x2, y2) => ({ x1, y1, x2, y2, minX: Math.min(x1, x2), maxX: Math.max(x1, x2),
  minY: Math.min(y1, y2), maxY: Math.max(y1, y2), front: 0, back: -1, oneSided: true, flags: 0 });
const synthMap = { nodes: [], ssectors: [{ segCount: 1, firstSeg: 0 }], segs: [{ linedef: 0, direction: 0 }],
  linedefs: [{ rightSidedef: 0, leftSidedef: 0xFFFF }], sidedefs: [{ sector: 0 }] };
const room = (size) => ({ map: synthMap, sectors: [{ floorHeight: 0, ceilingHeight: 256, ceilingTexture: 'CEIL' }], sectorAt: () => 0,
  lines: [L(0, 0, size, 0), L(size, 0, size, size), L(size, size, 0, size), L(0, size, 0, 0)] });
const table = resolveMonsterTable(findSpriteLumps(wad).lumps, new Set([3004, 9, 3001, 3002, 58, 3003, 2035]));
function aiSystem(specs, skill, { player = { x: 0, y: 0, z: 0, alive: true }, seed = 1, cb = {} } = {}) {
  const world = room(4096);
  const objects = specs.map(([, x, y, angle = 0], index) => ({ index, x, y, angle, flags: 7, base: [x, 0, -y] }));
  const rng = new Rng(seed);
  const params = skillParams(skill);
  const sys = new MonsterSystem(objects, table.entries, (o) => specs[o.index][0], rng, { skillParams: params, ...cb });
  const ai = new MonsterAI({ world, rng, player: () => player, noTarget: () => false, staticSolids: [], skillParams: params }).attach(sys);
  return { sys, ai, player, world };
}

// --- d) Dificuldade ---
console.log('\n--- d) dificuldade ---');
{
  const okFor = (flags) => [1, 2, 3, 4, 5].map((s) => skillFilter(flags, s) === 'ok');
  check('d1 filtro em flags sintéticas: bit 1 (1 e 2), bit 2 (3), bit 4 (4 e 5)',
    JSON.stringify([okFor(1), okFor(2), okFor(4)]) === JSON.stringify([[true, true, false, false, false], [false, false, true, false, false], [false, false, false, true, true]]));
  const counts = [1, 2, 3, 4, 5].map((s) => buildLevelData(wad, 'E1M1', { cache, skill: s }).spriteScene.objects.length);
  check('d2 E1M1: objetos por dificuldade crescentes de 1 a 4, 5 igual a 4', counts[0] <= counts[1] && counts[1] <= counts[2] && counts[2] <= counts[3] &&
    counts[4] === counts[3] && counts[0] < counts[3], counts.join(' / '));
  const clip = (s, dropped) => {
    const st = new PlayerStats();
    st.ammoScale = skillParams(s).ammoScale;
    st.ammo.clip = 0;
    tryPickup(ITEM_TABLE[2007], st, { dropped });
    return st.ammo.clip;
  };
  check('d3 pente de balas: 20 / 10 / 10 / 10 / 20', [1, 2, 3, 4, 5].map((s) => clip(s, false)).join() === '20,10,10,10,20');
  check('d4 pente largado: 10 / 5 / 5 / 5 / 10', [1, 2, 3, 4, 5].map((s) => clip(s, true)).join() === '10,5,5,5,10');
  const hit = (s) => {
    const st = new PlayerStats();
    st.armor = 100;
    st.armorType = 2;
    const r = applyDamage(st, scaleDamage(10, skillParams(s)), null, 'teste', new Rng(1));
    return [r.applied, r.savedByArmor, st.health];
  };
  check('d5 dano 10 com armadura azul: nível 1 -> 5, salvo 2, vida 97; nível 3 -> 10, salvo 5, vida 95',
    hit(1).join() === '3,2,97' && hit(3).join() === '5,5,95', `${hit(1)} / ${hit(3)}`);
  // Nightmare na IA.
  const rt5 = aiSystem([[3004, 1000, 1000]], 5).sys.monsters[0].reactionTime;
  const rt4 = aiSystem([[3004, 1000, 1000]], 4).sys.monsters[0].reactionTime;
  check('d6 reactionTime: 0 no Nightmare, 8 nos outros', rt5 === 0 && rt4 === REACTION_TIME && REACTION_TIME === 8);
  const missileWith = (skill) => {
    const t = aiSystem([[3004, 1000, 1000]], skill, { player: { x: 1150, y: 1000, z: 0, alive: true } });
    const m = t.sys.monsters[0];
    t.sys.setState(m, 'chase');
    Object.assign(m, { target: 'player', reactionTime: 0, movecount: 5, justAttacked: false });
    t.ai.chase(m);
    return m.state;
  };
  check('d7 ataque à distância com movecount 5: Nightmare ataca, nível 4 não', missileWith(5) === 'missile' && missileWith(4) !== 'missile',
    `${missileWith(5)} / ${missileWith(4)}`);
  const chaseDirsAfterAttack = (skill) => {
    const t = aiSystem([[3004, 1000, 1000]], skill, { player: { x: 1800, y: 1000, z: 0, alive: true } });
    const m = t.sys.monsters[0];
    t.sys.setState(m, 'chase');
    Object.assign(m, { target: 'player', justAttacked: true });
    let calls = 0;
    const orig = t.ai.newChaseDir.bind(t.ai);
    t.ai.newChaseDir = (mm) => { calls++; return orig(mm); };
    t.ai.chase(m);
    return calls;
  };
  check('d8 depois do ataque: sem newChaseDir no Nightmare, com no nível 4', chaseDirsAfterAttack(5) === 0 && chaseDirsAfterAttack(4) === 1);
  const sargTics = (skill) => {
    const t = aiSystem([[3002, 1000, 1000]], skill);
    const m = t.sys.monsters[0];
    const out = [];
    for (const st of ['chase', 'melee', 'pain']) { t.sys.setState(m, st); out.push(m.ticsLeft); }
    return out.join();
  };
  check('d9 demônio: corrida, ataque e dor com metade dos tics no Nightmare (2->1, 8->4, 2->1)', sargTics(5) === '1,4,1' && sargTics(4) === '2,8,2',
    `${sargTics(5)} / ${sargTics(4)}`);
  const speeds = (skill) => {
    const ms = new MissileSystem(room(4096), new Rng(1), { speedOf: skillParams(skill).missileSpeed, targets: () => [], sectorAt: () => 0, hit() {}, blast() {} });
    return ['troopShot', 'bruiserShot', 'rocket'].map((t) => ms.speedOf(t)).join();
  };
  check('d10 velocidades: 20/20/20 no Nightmare, 10/15/20 nos outros', speeds(5) === '20,20,20' && speeds(3) === '10,15,20', `${speeds(5)} / ${speeds(3)}`);
  check('d11 tabelas originais sem alteração', JSON.stringify([MISSILE_TYPES, AI_TABLE, MONSTER_TABLE, ITEM_TABLE]) === tablesBefore);
}

// --- e) Renascimento no Nightmare ---
console.log('\n--- e) renascimento ---');
{
  // Tics do corpo até voltar (ou null), com o MonsterSystem no ponto de início livre.
  const respawnAfter = (skill, seed, { blocker = false, type = 3004, limit = 20000 } = {}) => {
    const specs = [[type, 1000, 1000, 90]];
    if (blocker) specs.push([3004, 1010, 1000]);
    let t;
    const cb = {
      canRespawn: (m) => !t.sys.monsters.some((o) => o !== m && o.shootable && !o.removed && Math.abs(o.x - m.spawn.x) < 40 && Math.abs(o.y - m.spawn.y) < 40),
    };
    t = aiSystem(specs, skill, { seed, player: { x: 0, y: 0, z: 0, alive: false }, cb });
    t.sys.setAIEnabled(false);
    const m = t.sys.monsters[0];
    m.x = 1200; // morre longe do ponto de início
    m.health = 0;
    t.sys.kill(m, false);
    let deadAt = null;
    for (let i = 1; i <= limit; i++) {
      t.sys.tick();
      if (m.state === 'dead' && deadAt === null) deadAt = i;
      if (deadAt !== null && m.shootable) return { tics: i - deadAt, m };
    }
    return null;
  };
  const samples = [];
  let early = false;
  for (let seed = 1; seed <= 50; seed++) {
    const r = respawnAfter(5, seed);
    if (r) { samples.push(r.tics); if (r.tics < RESPAWN_TICS) early = true; }
  }
  const mean = samples.reduce((a, b) => a + b, 0) / Math.max(1, samples.length);
  check('e1 50 sementes: todos voltam, nunca antes de 420 tics de corpo', samples.length === 50 && !early,
    `média ${mean.toFixed(0)} tics (esperado ~420 + 1638), faixa ${Math.min(...samples)}..${Math.max(...samples)}`);
  check('e2 média depois dos 420 perto de 32 * 256 / 5 = 1638 (entre 1000 e 2400)', mean - RESPAWN_TICS > 1000 && mean - RESPAWN_TICS < 2400);
  const back = respawnAfter(5, 7);
  const m = back.m;
  check('e3 volta no ponto e ângulo originais, vida cheia, parado, reactionTime 18', m.x === 1000 && m.y === 1000 && m.angle === 90 &&
    m.health === m.entry.health && m.state === 'stand' && m.reactionTime === 18);
  check('e4 só no Nightmare (nível 4: nada em 20000 tics)', respawnAfter(4, 1) === null);
  check('e5 não volta com alguém no ponto de início', respawnAfter(5, 1, { blocker: true }) === null);
  check('e6 barril não volta', respawnAfter(5, 1, { type: 2035, limit: 8000 }) === null);
  // No nível real (LevelRuntime): névoa nos dois pontos, "telept" duas vezes, sem mudar o total.
  const data = buildLevelData(wad, 'E1M1', { cache, skill: 5 });
  const log = { sounds: [] };
  const rt = createLevelRuntime(data, { ...depsFor({ x: 0, y: 0, z: 0, alive: false }, log), skillParams: skillParams(5), aiEnabled: () => false });
  const zombie = rt.monsters.monsters.find((mm) => mm.type === 3004);
  const total = rt.levelStats().totalKills;
  rt.monsters.damage(zombie, 1000);
  let fogs = 0;
  for (let i = 0; i < 30000 && fogs === 0; i++) {
    rt.monsters.tick();
    fogs = rt.effects.items.filter((e) => e.type === 'fog').length;
  }
  const items0 = rt.itemSystem.items.length;
  check('e7 LevelRuntime: duas névoas TFOG, dois "telept", total de mortes igual, mortes 1', fogs === 2 &&
    log.sounds.filter(([n]) => n === 'telept').length === 2 && rt.levelStats().totalKills === total && rt.levelStats().kills === 1,
    `névoas ${fogs}, sons ${log.sounds.filter(([n]) => n === 'telept').length}`);
  check('e8 itens não renascem (lista de itens igual)', rt.itemSystem.items.length === items0);
  check('e9 TFOG na textura só no Nightmare', data.spriteScene.frames.has('TFOGA') && !buildLevelData(wad, 'E1M1', { cache, skill: 4 }).spriteScene.frames.has('TFOGA'));
}

// --- f) Estatísticas e segredos ---
console.log('\n--- f) estatísticas e segredos ---');
{
  const data = buildLevelData(wad, 'E1M1', { cache });
  const rt = createLevelRuntime(data, depsFor());
  // Um ponto dentro de cada setor secreto: centro de um subsector dele.
  const pointIn = (s) => {
    for (const info of data.flats.subsectorInfo) {
      if (!info || info.sector !== s) continue;
      const pts = info.polygon.map((p) => (Array.isArray(p) ? { x: p[0], y: p[1] } : p));
      const c = { x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts.reduce((a, p) => a + p.y, 0) / pts.length };
      if (findSector(data.map, c.x, c.y) === s) return c;
    }
    return null;
  };
  const secretSectors = data.map.sectors.flatMap((sec, i) => (sec.special === 9 ? [i] : []));
  const [s1, s2] = secretSectors;
  const p1 = pointIn(s1), p2 = pointIn(s2);
  const floor1 = data.map.sectors[s1].floorHeight, floor2 = data.map.sectors[s2].floorHeight;
  const first = rt.checkSecret(p1.x, p1.y, floor1, true);
  const again = rt.checkSecret(p1.x, p1.y, floor1, true);
  check('f1 setor 9 com os pés no chão: conta 1 vez e zera o especial (o mapa não muda)', first && !again && rt.sectorSpecial[s1] === 0 &&
    data.map.sectors[s1].special === 9 && rt.levelStats().secrets === 1);
  check('f2 no ar ou morto não conta', !rt.checkSecret(p2.x, p2.y, floor2 + 10, true) && !rt.checkSecret(p2.x, p2.y, floor2, false) && rt.levelStats().secrets === 1);
  // Mortes: pelo jogador e pela explosão de um barril.
  const zombies = rt.monsters.monsters.filter((m) => m.type === 3004);
  rt.monsters.damage(zombies[0], 1000);
  const barrel = rt.monsters.monsters.find((m) => m.type === 2035);
  Object.assign(zombies[1], { x: barrel.x + 20, y: barrel.y });
  rt.monsters.damage(barrel, 1000);
  for (let i = 0; i < 40; i++) rt.monsters.tick();
  check('f3 mortes pelo jogador e pela explosão de barril contam', rt.levelStats().kills === 2 && zombies[1].health <= 0, `mortes ${rt.levelStats().kills}`);
  const survey = JSON.parse(fs.readFileSync(new URL('./out/survey.json', import.meta.url), 'utf8')).maps;
  const bad = maps.filter((m) => buildLevelData(wad, m.name, { cache }).totals.secrets !== survey.find((x) => x.name === m.name)?.secrets);
  check('f4 totalSecrets de cada mapa igual ao levantamento da etapa 22', bad.length === 0, bad.map((m) => m.name).join(', ') || '36 mapas');
}

// --- g) Progressão e estado entre mapas ---
console.log('\n--- g) progressão ---');
{
  const has = (e, m) => maps.some((x) => x.episode === e && x.map === m);
  const go = (e, m, secret = false, ret = null) => { const n = nextMap(e, m, secret, has, ret); return n.kind === 'map' ? `E${n.episode}M${n.map}` : 'fim'; };
  check('g1 mapas 1 a 7 vão ao seguinte; o 8 termina o episódio', [1, 2, 3, 4].every((e) => [1, 2, 3, 4, 5, 6, 7].every((m) => go(e, m) === `E${e}M${m + 1}`) && go(e, 8) === 'fim'));
  check('g2 saída secreta vai ao 9; a volta é origem + 1', go(1, 3, true) === 'E1M9' && go(1, 9, false, 4) === 'E1M4' && go(2, 5, true) === 'E2M9' && go(2, 9, false, 6) === 'E2M6');
  check('g3 mapa 9 por IDCLEV (sem volta guardada): tabela E1->4, E2->6, E3->7, E4->3',
    [1, 2, 3, 4].map((e) => go(e, 9)).join() === 'E1M4,E2M6,E3M7,E4M3' && JSON.stringify(SECRET_RETURN) === '{"1":4,"2":6,"3":7,"4":3}');
  const onlyTwo = (e, m) => e === 1 && m <= 2;
  check('g4 mapa inexistente vira fim; episódios independentes', nextMap(1, 2, false, onlyTwo).kind === 'finale' && go(1, 7) === 'E1M8' && go(2, 1) === 'E2M2');
  // Estado do jogador.
  const st = new PlayerStats();
  Object.assign(st, { health: 57, armor: 80, armorType: 1, hasBackpack: true, damageCount: 30, bonusCount: 6 });
  st.weaponsOwned.add(3);
  st.ammo.shell = 12;
  st.keys.blueCard = true;
  applyPlayerEntry(st, LEVEL_ENTRY.exit.player);
  check('g5 troca de fase: vida, armadura, armas, munição e mochila passam; chaves e contadores zeram',
    st.health === 57 && st.armor === 80 && st.armorType === 1 && st.weaponsOwned.has(3) && st.ammo.shell === 12 && st.hasBackpack &&
    !st.keys.blueCard && st.damageCount === 0 && st.bonusCount === 0);
  applyPlayerEntry(st, LEVEL_ENTRY.death.player);
  check('g6 morte: começo de pistola (vida 100, 50 balas, sem espingarda nem mochila)', st.health === 100 && st.ammo.clip === 50 && !st.weaponsOwned.has(3) && !st.hasBackpack);
  check('g7 modo deus e noclip: continuam na troca de fase e na morte; zeram no NEW GAME e no IDCLEV',
    !LEVEL_ENTRY.exit.resetCheats && !LEVEL_ENTRY.death.resetCheats && LEVEL_ENTRY.newGame.resetCheats && LEVEL_ENTRY.idclev.resetCheats &&
    LEVEL_ENTRY.newGame.player === 'pistol' && LEVEL_ENTRY.idclev.player === 'pistol' && LEVEL_ENTRY.reload.player === 'keep');
  const session = new GameSession(maps);
  session.episode = 2; session.map = 4;
  check('g8 sessão: mapa atual (morrer reinicia este), vizinhos com volta, dificuldade padrão 3',
    session.current.name === 'E2M4' && session.neighbor(+1).name === 'E2M5' && session.skill === 3 &&
    (() => { session.episode = 4; session.map = 9; return session.neighbor(+1).name === 'E1M1'; })());
  const fakeWad = { lumps: [{ name: 'MAP07' }, ...['THINGS', 'LINEDEFS', 'SIDEDEFS', 'VERTEXES', 'SEGS', 'SSECTORS', 'NODES', 'SECTORS', 'REJECT', 'BLOCKMAP'].map((name) => ({ name }))] };
  const single = listMaps(fakeWad);
  check('g9 sem ExMy: o primeiro MAPxx como mapa único', single.length === 1 && single[0].name === 'MAP07' && single[0].single);
}

// --- h) Intermissão ---
console.log('\n--- h) intermissão ---');
{
  const wiAssets = loadIntermissionAssets(wad);
  const sounds = [];
  const wi = new Intermission({ episode: 1, last: 1, next: 2, sound: (n) => sounds.push([wi.bcnt, n]),
    stats: { kills: 50, totalKills: 100, items: 0, totalItems: 0, secrets: 0, totalSecrets: 0, tics: 65 * 35 } });
  const changes = [];
  let prev = JSON.stringify(wi.cnt);
  for (let t = 1; t <= 400; t++) {
    wi.tick();
    const now = JSON.stringify(wi.cnt);
    if (now !== prev) changes.push([t, { ...wi.cnt }]);
    prev = now;
  }
  const killTics = changes.filter(([, c]) => c.kills >= 0 && c.items < 0).map(([t]) => t);
  const killEnd = sounds.find(([, n]) => n === 'barexp')?.[0];
  // Contagem de -1 em passos de 2 (como o wi_stuff.c): 26 tics até 50 (51 limitado a 50).
  check('h1 50 de 100 mortes: 35 tics de pausa, contagem do tic 36 ao 61 (26 tics, de -1 em passos de 2), "barexp" no fim',
    killTics[0] === 36 && killTics.at(-1) === 61 && killTics.length === 26 && killEnd === 61 && wi.target.kills === 50,
    `tics ${killTics[0]}..${killTics.at(-1)} (${killTics.length})`);
  const pistolTics = sounds.filter(([t, n]) => n === 'pistol' && t <= 61).map(([t]) => t);
  check('h2 "pistol" só nos tics com bcnt & 3 == 0 durante a contagem', pistolTics.length > 0 && pistolTics.every((t) => (t & 3) === 0));
  const itemTic = changes.find(([, c]) => c.items >= 0)?.[0];
  const timeTics = changes.filter(([, c]) => c.time >= 0).map(([t, c]) => [t, c.time]);
  check('h3 itens com total 0: 0% depois de mais 35 tics de pausa', itemTic === 61 + 35 + 1 && percent(0, 0) === 0);
  check('h4 tempo sobe 3 por tic até 65 s', timeTics[0][1] === 2 && timeTics[1][1] === 5 && timeTics.at(-1)[1] === 65 && wi.spState === 10,
    `${timeTics.length} tics`);
  // Desenho: 65 s, elementos dentro de 320x200.
  const report = [];
  composeIntermission(wi, wiAssets, report);
  const inside = report.every((r) => r.x >= 0 && r.y >= 0 && r.x + r.w <= 320 && r.y + r.h <= 200);
  const timeDigits = report.filter((r) => r.y === 168 && /^WINUM|^WICOLON/.test(r.name ?? '')).sort((a, b) => a.x - b.x).map((r) => (r.name === 'WICOLON' ? ':' : r.name.slice(5))).join('');
  check('h5 nenhum elemento passa de 320x200', inside, `${report.length} patches`);
  check('h6 65 s desenhado como no WI_drawTime (minutos com 2 dígitos): 01:05', timeDigits === '01:05', timeDigits);
  const sucksAt = (t) => {
    const w = new Intermission({ episode: 1, last: 1, next: 2, stats: { kills: 0, totalKills: 0, items: 0, totalItems: 0, secrets: 0, totalSecrets: 0, tics: t * 35 } });
    w.press(); w.tick();
    const r = [];
    composeIntermission(w, wiAssets, r);
    return r.some((x) => x.name === 'WISUCKS');
  };
  check('h7 WISUCKS acima de 61:59 (3599 s ainda em dígitos, 3600 s "sucks")', !sucksAt(61 * 59) && sucksAt(61 * 59 + 1));
  // Aceleração e tela "entrando".
  const fast = [];
  const w2 = new Intermission({ episode: 2, last: 3, next: 9, sound: (n) => fast.push(n),
    stats: { kills: 3, totalKills: 4, items: 1, totalItems: 2, secrets: 1, totalSecrets: 1, tics: 700 } });
  for (let i = 0; i < 40; i++) w2.tick();
  w2.press(); w2.tick();
  check('h8 aceleração: valores finais de uma vez, "barexp", fim da contagem', JSON.stringify(w2.cnt) === JSON.stringify(w2.target) && w2.spState === 10 && fast.at(-1) === 'barexp');
  w2.press(); w2.tick();
  for (let i = 0; i < 1000; i++) w2.tick();
  const waited = !w2.done && w2.phase === 'entering' && fast.at(-1) === 'sgcock';
  w2.press(); w2.tick();
  check('h9 "entrando" espera a tecla ("sgcock" ao entrar) e conclui com ela', waited && w2.done);
  const r2 = [];
  composeIntermission(w2, wiAssets, r2);
  check('h10 "entrando" desenha WIENTER e o nome do próximo (WILV18) dentro da tela', r2.some((r) => r.name === 'WIENTER') && r2.some((r) => r.name === 'WILV18') &&
    r2.every((r) => r.x >= 0 && r.y >= 0 && r.x + r.w <= 320 && r.y + r.h <= 200));
}

// --- i) Menus ---
console.log('\n--- i) menus ---');
{
  const settingsStub = { get: () => 1, set() {}, toggle() {}, reset() {}, subscribe() {} };
  const calls = [];
  const mk = (episodes) => new Menu(settingsStub, { newGame: (e, s) => calls.push([e, s]), resume() {}, toggleFullscreen() {}, isFullscreen: () => false,
    openTuning() {}, statsAction() {}, episodes: () => episodes });
  const key = (menu, code) => menu.handleKey({ code, repeat: false });
  const menu = mk([1, 2, 3, 4]);
  key(menu, 'Enter');
  const atEpisode = menu.screen === 'episode';
  key(menu, 'ArrowDown'); key(menu, 'Enter');
  const atSkill = menu.screen === 'skill' && menu.selected.skill === 2 && menu.episode === 2;
  key(menu, 'ArrowDown'); key(menu, 'ArrowDown'); key(menu, 'Enter');
  const atConfirm = menu.screen === 'nightmare';
  key(menu, 'KeyN');
  const cancelled = menu.screen === 'skill' && calls.length === 0;
  key(menu, 'Enter'); key(menu, 'KeyQ'); // outra tecla: sem efeito
  const ignored = menu.screen === 'nightmare';
  key(menu, 'KeyY');
  check('i1 NEW GAME -> episódio -> dificuldade (cursor no 3º) -> confirmação do Nightmare (N volta, Y começa)',
    atEpisode && atSkill && atConfirm && cancelled && ignored && menu.started && JSON.stringify(calls) === '[[2,5]]' && menu.screen === 'main');
  const m2 = mk([1, 2, 3, 4]);
  key(m2, 'Enter'); key(m2, 'Enter'); key(m2, 'Escape');
  const back1 = m2.screen === 'episode';
  key(m2, 'Escape');
  check('i2 Esc volta (dificuldade -> episódio -> principal)', back1 && m2.screen === 'main');
  const m3 = mk([1]);
  key(m3, 'Enter');
  const skipped = m3.screen === 'skill';
  key(m3, 'Escape');
  key(m3, 'Enter'); key(m3, 'Enter');
  check('i3 com um só episódio a escolha é pulada (Esc volta ao principal)', skipped && JSON.stringify(calls.at(-1)) === '[1,3]');
  const m4 = mk([1, 2]);
  key(m4, 'Enter'); key(m4, 'ArrowDown'); key(m4, 'ArrowDown'); key(m4, 'Enter');
  check('i4 episódio que não existe no WAD é ignorado', m4.screen === 'episode');
  // Textos dentro de 320 pixels nos dois idiomas.
  const assets = loadMenuAssets(wad);
  const over = [];
  for (const lang of ['en', 'pt']) {
    for (const screen of ['episode', 'skill', 'nightmare', 'levelDebug', 'debug']) {
      const report = [];
      composeMenu({ screen, selected: 0, helpPage: 0, started: true, resumeFailed: false, values: {}, lang }, assets, 0, report);
      for (const r of report) if (r.right > 320 || r.x < 0 || r.bottom > 200) over.push(`${lang} ${screen}: ${r.text}`);
    }
    const T = MENU_TEXT[lang];
    for (const [ep, text] of Object.entries(T.finaleText)) {
      const lines = text.split('\n');
      const widest = Math.max(...lines.map((l) => FINALE_TEXT_POS.x + measureText(assets.font, l)));
      if (widest > 320 || FINALE_TEXT_POS.y + lines.length * FINALE_TEXT_POS.line > 180) over.push(`${lang} fim ${ep}`);
    }
    if (measureText(assets.font, T.finalePress) > 320) over.push(`${lang} finalePress`);
  }
  check('i5 nenhum texto novo passa de 320x200 (episódio, dificuldade, confirmação, LEVEL DEBUG, fim)', over.length === 0, over.join('; '));
  check('i6 itens novos do depurador (LEVEL DEBUG: NEXT MAP, PREV MAP, RELOAD LEVEL) e DEBUG com 9 itens', SCREENS.levelDebug.items.map((i) => i.id).join() === 'nextMap,prevMap,reloadLevel' &&
    SCREENS.debug.items.length === 9);
  const fin = new Finale(1, MENU_TEXT.en.finaleText[1]);
  for (let i = 0; i < 10 + 3 * 5; i++) fin.tick();
  const five = fin.visible;
  fin.press();
  const all = fin.typed && !fin.done;
  fin.press();
  check('i7 fim: 1 caractere a cada 3 tics, tecla mostra tudo, a seguinte termina', five === 5 && all && fin.done);
}

// --- j) IDCLEV ---
console.log('\n--- j) IDCLEV ---');
{
  const typeCheat = (r, text) => [...text].map((c) => r.push(`Key${c}`));
  const r = new CheatReader();
  const start = typeCheat(r, 'IDCLEV').at(-1);
  const d1 = r.push('Digit1');
  const d2 = r.push('Numpad3');
  check('j1 IDCLEV espera dois dígitos (linha de cima e teclado numérico), consumidos', start.cheat === 'idclevStart' && d1.consume && !d1.cheat &&
    d2.cheat === 'idclev' && d2.arg === '13' && d2.consume && !r.pending);
  typeCheat(r, 'IDCLEV');
  const esc = r.push('Escape');
  check('j2 Esc cancela', esc.cheat === 'idclevCancel' && !r.pending);
  typeCheat(r, 'IDCLEV');
  r.push('Digit2');
  let expired = 0;
  for (let i = 1; i <= CLEV_WAIT_TICS; i++) if (r.tick()) expired = i;
  check('j3 expira em 105 tics', expired === 105 && !r.pending && CLEV_WAIT_TICS === 105);
  typeCheat(r, 'IDCLEV');
  const weaponKey = r.push('Digit4');
  check('j4 durante a espera os dígitos são consumidos (não trocam de arma)', weaponKey.consume);
  r.clear();
  const session = new GameSession(maps);
  check('j5 mapa inexistente é rejeitado (E5M1, E1M0); existente aceito (E4M9)', !session.find(5, 1) && !session.find(1, 0) && session.find(4, 9)?.name === 'E4M9');
  check('j6 IDCLIP continua funcionando', typeCheat(new CheatReader(), 'IDCLIP').at(-1).cheat === 'idclip');
}

// --- k) Simulação sem cabeça ---
console.log('\n--- k) simulação sem cabeça (1500 tics, OPEN ALL DOORS, 500 tics) ---');
{
  const failed = [];
  const t0 = performance.now();
  for (const m of maps) {
    try {
      const data = buildLevelData(wad, m.name, { cache });
      const s = data.map.sectors[data.spawnSector];
      const player = { x: data.spawn.x, y: data.spawn.y, z: s.floorHeight, alive: true };
      const ctx = { keys: {}, dead: false, sound() {}, message() {}, textureExists: (n) => data.wallLayers.has(n), warn() {}, fits: () => true, onFloorMoved() {} };
      let rt = null;
      rt = createLevelRuntime(data, { ...depsFor(player), useDoor: (mm, li) => monsterUseDoor(rt.level, li, mm, ctx) });
      const step = () => {
        tickLevel(rt.level, ctx);
        rt.level.advanceClock();
        rt.monsters.tick();
        rt.missiles.update();
        rt.effects.tick();
        for (const ev of rt.monsters.takeEvents()) if (ev.type === 'died') rt.itemSystem.onMonsterDied(ev);
      };
      for (let i = 0; i < 1500; i++) step();
      openAllDoors(rt.level, ctx);
      for (let i = 0; i < 500; i++) step();
      const bad = rt.monsters.monsters.filter((mm) => !mm.removed && (![mm.x, mm.y, mm.floorZ].every(Number.isFinite) || findSector(data.map, mm.x, mm.y) < 0));
      const badMissiles = rt.missiles.list.filter((p) => ![p.x, p.y, p.z].every(Number.isFinite));
      if (bad.length || badMissiles.length) failed.push(`${m.name}: ${bad.length} monstros e ${badMissiles.length} projéteis inválidos`);
    } catch (err) {
      failed.push(`${m.name}: ${err.message}`);
    }
  }
  check('k1 36 mapas: sem exceção, sem NaN, nenhum monstro fora do mapa', failed.length === 0,
    `${failed.join('; ') || 'nenhum falhou'} (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
}

// --- l) Lumps ---
console.log('\n--- l) lumps ---');
{
  const range = (p, a, b) => Array.from({ length: b - a + 1 }, (_, i) => `${p}${a + i}`);
  const names = ['M_EPISOD', ...range('M_EPI', 1, 4), 'M_SKILL', 'M_JKILL', 'M_ROUGH', 'M_HURT', 'M_ULTRA', 'M_NMARE', ...range('WIMAP', 0, 2), 'INTERPIC',
    ...[0, 1, 2, 3].flatMap((e) => range(`WILV${e}`, 0, 8)), 'WIF', 'WIENTER', 'WIOSTK', 'WIOSTI', 'WISCRT2', 'WITIME', ...range('WINUM', 0, 9),
    'WIPCNT', 'WICOLON', 'WISUCKS', 'FLOOR4_8', ...'ABCDEFGHIJ'.split('').map((c) => `TFOG${c}0`), 'DSPISTOL', 'DSBAREXP', 'DSSGCOCK', 'DSTELEPT'];
  const missing = names.filter((n) => findLastLump(wad, n, (l) => l.size > 0) < 0);
  console.log(`     ${names.length} lumps procurados; ausentes: ${missing.join(', ') || 'nenhum'}`);
}

console.log(`\nAvisos: ${warnings.length}`);
console.log(failures ? `${failures} falha(s)` : 'Tudo certo');
process.exitCode = failures ? 1 : 0;
