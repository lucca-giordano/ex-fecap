// Verificação de portas, elevadores, uso, cruzamento, interruptores, saída e geometria dinâmica, sem
// navegador. Uso: node tools/check-specials.mjs. Sai com código diferente de zero se algo falhar.

import fs from 'node:fs';
import { staticGeometry, geometryDigest, loadWad, BASELINE_PATH } from './baseline-geometry.mjs';
import { loadMap } from '../src/wad/MapData.js';
import { readTextureDefs } from '../src/wad/Textures.js';
import { findSector } from '../src/map/bsp.js';
import { buildWalls } from '../src/map/buildWalls.js';
import { buildFlats } from '../src/map/buildFlats.js';
import { DynamicGeometry, dynamicSets } from '../src/map/dynamicGeometry.js';
import { WORDS_PER_VERTEX } from '../src/map/vertexLayout.js';
import { buildCollisionLines } from '../src/physics/collisionData.js';
import { createPlayerState, stepPlayer, PLAYER_HEIGHT } from '../src/physics/collision.js';
import { LevelState, targetsFit, INTERMISSION_DELAY } from '../src/game/LevelState.js';
import { SPECIALS, analyzeSpecials, switchCounterpartNames, switchTextureOf } from '../src/game/specials.js';
import { startDoor, doDoor, doorTop, VDOORWAIT } from '../src/game/Doors.js';
import { doPlat, PLATWAIT } from '../src/game/Platforms.js';
import { activateLine, useLines, crossLines, monsterUseDoor, tickLevel, openAllDoors, CrossTracker, BUTTONTIME } from '../src/game/UseLines.js';
import { buildSoundGraph, noiseAlert } from '../src/game/sound.js';
import { checkSight } from '../src/game/sight.js';
import { shoot } from '../src/game/hitscan.js';
import { Rng } from '../src/game/Rng.js';
import { findSpriteLumps } from '../src/wad/Sprites.js';
import { resolveMonsterTable } from '../src/game/monsterTable.js';
import { MonsterSystem } from '../src/game/MonsterSystem.js';
import { MonsterAI } from '../src/game/MonsterAI.js';
import { PlayerStats } from '../src/game/PlayerStats.js';

let failures = 0;
const check = (cond, label) => {
  if (!cond) { failures++; console.log(`FALHA: ${label}`); }
  return cond;
};

const wad = loadWad();
const textureDefs = readTextureDefs(wad);
// Mesma lista de paredes do jogo: as do mapa, o céu e as contrapartes dos interruptores (no fim).
const gameWallNames = (map, names) => { for (const n of switchCounterpartNames(map)) names.add(n); return names; };

// Contexto de teste das ações: grava sons, mensagens e avisos.
function makeCtx(extra = {}) {
  const log = { sounds: [], messages: [], warnings: [], moved: [] };
  const ctx = {
    keys: {}, dead: false,
    sound: (name, sector) => log.sounds.push([name, sector]),
    message: (key) => log.messages.push(key),
    textureExists: (n) => textureDefs.has(n),
    warn: (t) => log.warnings.push(t),
    fits: () => true,
    onFloorMoved: (s) => log.moved.push(s),
    ...extra,
  };
  return { ctx, log };
}
const runTics = (level, ctx, n) => { for (let i = 0; i < n; i++) tickLevel(level, ctx); };

// --- a) Geometria estática contra a linha de base ---
const base = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
const geo = staticGeometry(wad, 'E1M1', { wallNames: gameWallNames });
const digest = geometryDigest(geo.walls, geo.flats);
check(JSON.stringify(digest.walls) === JSON.stringify(base.walls), 'paredes: hash e contagens iguais à linha de base');
check(JSON.stringify(digest.flats) === JSON.stringify(base.flats), 'planos: hash e contagens iguais à linha de base');

// --- b) Consistência da geometria dinâmica ---
const sameWords = (a, ai, b, bi, n) => {
  for (let k = 0; k < n * WORDS_PER_VERTEX; k++) if (!Object.is(a[ai * WORDS_PER_VERTEX + k], b[bi * WORDS_PER_VERTEX + k])) return false;
  return true;
};
function compareDynamic(map, dyn, refMap, label) {
  const walls = buildWalls(refMap, geo.wallLayers);
  const flats = buildFlats(refMap, geo.flatLayers);
  const slotOf = (info, kind) => {
    const right = refMap.linedefs[info.linedef].rightSidedef === info.sidedef;
    return kind === 'middle' ? 2 : (right ? 0 : 3) + (kind === 'upper' ? 1 : 0);
  };
  let quads = 0, wallBad = 0;
  const seen = new Map(dyn.lines.map((li) => [li, new Set()]));
  walls.quadInfo.forEach((q, k) => {
    if (!seen.has(q.linedef)) return;
    const slot = slotOf(q, q.kind);
    seen.get(q.linedef).add(slot);
    const at = (dyn.lineSlot.get(q.linedef) * 5 + slot) * 4;
    quads++;
    if (!sameWords(walls.vertices, k * 4, dyn.vertices, at, 4) || !sameWords(walls.vertices, k * 4, dyn.sectorVertices, at, 4)) wallBad++;
  });
  // Quads que não existem no estático ficam zerados na dinâmica.
  let notZero = 0;
  for (const [li, slots] of seen) {
    for (let slot = 0; slot < 5; slot++) {
      if (slots.has(slot)) continue;
      const at = (dyn.lineSlot.get(li) * 5 + slot) * 4 * WORDS_PER_VERTEX;
      if (dyn.vertices.subarray(at, at + 4 * WORDS_PER_VERTEX).some((v) => v !== 0)) notZero++;
    }
  }
  // Planos: ordem do estático = subsectors em ordem, chão (n) e teto (n).
  let offset = 0, planes = 0, flatBad = 0;
  for (const info of flats.subsectorInfo) {
    if (!info) continue;
    const n = info.polygon.length;
    const p = dyn.planes.get(info.sector)?.find((pl) => pl.polygon === info.polygon || pl.polygon.every((v, i) => v[0] === info.polygon[i][0] && v[1] === info.polygon[i][1]));
    if (p) {
      planes++;
      if (!sameWords(flats.vertices, offset, dyn.vertices, p.floorAt, 2 * n) ||
          !sameWords(flats.sectorColorVertices, offset, dyn.sectorVertices, p.floorAt, 2 * n)) flatBad++;
    }
    offset += 2 * n;
  }
  console.log(`${label}: ${quads} quads de parede e ${planes} polígonos de plano comparados`);
  check(wallBad === 0 && notZero === 0 && flatBad === 0, `${label}: dinâmica = estática (paredes ${wallBad}, zerados ${notZero}, planos ${flatBad})`);
}
const e1 = loadMap(wad, 'E1M1');
const e1Level = new LevelState(e1);
const e1Analysis = analyzeSpecials(e1, e1Level.tagMap);
const e1Sets = dynamicSets(e1Level, e1Analysis.movableSectors, e1Analysis.switchLines);
const e1Flats = buildFlats(e1, geo.flatLayers);
const dyn = new DynamicGeometry(e1, e1Sets, e1Flats.subsectorInfo, geo.wallLayers, geo.flatLayers);
compareDynamic(e1, dyn, e1, 'E1M1 inicial');
// Alturas alteradas: portas em 25, 50 e 100% do curso e elevadores abaixados, numa CÓPIA de referência.
const doorSectors = [...e1Analysis.movableSectors].filter((s) => e1.sectors[s].ceilingHeight === e1.sectors[s].floorHeight);
const platSectors = [...e1Analysis.movableSectors].filter((s) => !doorSectors.includes(s));
for (const frac of [0.25, 0.5, 1]) {
  for (const s of doorSectors) {
    const top = doorTop(e1Level, s);
    e1.sectors[s].ceilingHeight = Math.round(e1Level.origHeights[s].floor + (top - e1Level.origHeights[s].floor) * frac);
    dyn.updateSector(s, e1Level.sectorLines[s]);
  }
  for (const s of platSectors) {
    e1.sectors[s].floorHeight = e1Level.origHeights[s].floor - Math.round(24 * frac);
    dyn.updateSector(s, e1Level.sectorLines[s]);
  }
  compareDynamic(e1, dyn, JSON.parse(JSON.stringify(e1)), `alturas a ${frac * 100}%`); // cópia de referência
}
e1Level.reset();
dyn.markAll();

// --- Mapa sintético: corredor no eixo x ---
// sectors: [{ floor, ceil, tag }]; lines: [{ a, b, front, back, special, tag, tex }].
function synthMap(sectors, lines) {
  const vertexes = [], sidedefs = [], linedefs = [];
  const vtx = (p) => { vertexes.push({ x: p[0], y: p[1] }); return vertexes.length - 1; };
  const side = (sector, tex = {}) => {
    sidedefs.push({ xOffset: 0, yOffset: 0, upperTexture: tex.upper ?? '-', middleTexture: tex.middle ?? '-', lowerTexture: tex.lower ?? '-', sector });
    return sidedefs.length - 1;
  };
  for (const l of lines) {
    const right = side(l.front, l.tex ?? (l.back === undefined ? { middle: 'STARTAN3' } : {}));
    const left = l.back === undefined ? 0xFFFF : side(l.back, {});
    linedefs.push({ v1: vtx(l.a), v2: vtx(l.b), flags: l.flags ?? 0, special: l.special ?? 0, tag: l.tag ?? 0, rightSidedef: right, leftSidedef: left,
      blocking: false, twoSided: l.back !== undefined, upperUnpegged: false, lowerUnpegged: false });
  }
  return { name: 'SYNTH', things: [], linedefs, sidedefs, vertexes, segs: [], ssectors: [], nodes: [],
    sectors: sectors.map((s) => ({ floorHeight: s.floor, ceilingHeight: s.ceil, floorTexture: 'FLOOR4_8', ceilingTexture: 'CEIL3_5', lightLevel: 160, special: 0, tag: s.tag ?? 0 })) };
}
// Linha vertical em x com a frente voltada para o oeste (x menor): v1 em cima, v2 embaixo.
const westFacing = (x, y0, y1, o) => ({ a: [x, y1], b: [x, y0], ...o });
// Corredor: sala 0 (0..100), janela 1 (100..110, aberta), sala 2 (110..120), porta 3 (120..136), sala 4 (136..300).
function corridor({ doorSpecial = 1, windowCeil = 128, doorTag = 0, extraSectors = [], extraLines = [] } = {}) {
  const sectors = [{ floor: 0, ceil: 128 }, { floor: 0, ceil: windowCeil }, { floor: 0, ceil: 128 }, { floor: 0, ceil: 0, tag: doorTag }, { floor: 0, ceil: 128 }, ...extraSectors];
  const lines = [
    westFacing(100, 0, 64, { front: 0, back: 1 }),
    westFacing(110, 0, 64, { front: 1, back: 2 }),
    westFacing(120, 0, 64, { front: 2, back: 3, special: doorSpecial, tex: { upper: 'BIGDOOR2' } }),
    { a: [136, 0], b: [136, 64], front: 4, back: 3, special: doorSpecial },
    { a: [0, 0], b: [300, 0], front: 0 }, { a: [300, 64], b: [0, 64], front: 0 },
    ...extraLines,
  ];
  const map = synthMap(sectors, lines);
  return { map, level: new LevelState(map), world: { map, lines: buildCollisionLines(map), sectors: map.sectors } };
}

// --- c) Portas ---
{
  // Porta normal do E1M1 (especial 1): sobe a 2 por tic, espera 150 e fecha.
  const level = new LevelState(loadMap(wad, 'E1M1'));
  const li = level.map.linedefs.findIndex((l) => l.special === 1);
  const s = level.map.sidedefs[level.map.linedefs[li].leftSidedef].sector;
  const { ctx, log } = makeCtx();
  const floor = level.sectors[s].floorHeight, top = doorTop(level, s);
  check(activateLine(level, li, ctx).ok && log.sounds[0][0] === 'doropn', 'porta normal: abre com "doropn"');
  const heights = [];
  let tics = 0;
  while (level.thinkers.has(s) && tics < 2000) { tickLevel(level, ctx); heights.push(level.sectors[s].ceilingHeight); tics++; }
  const rise = Math.ceil((top - floor) / 2);
  const steps = heights.slice(0, rise).every((h, i) => h === Math.min(top, floor + 2 * (i + 1)));
  console.log(`Porta ${li} (setor ${s}): chão ${floor}, topo ${top} (menor teto vizinho - 4); ${tics} tics no total`);
  check(steps && heights[rise - 1] === top, 'sobe 2 por tic até o topo');
  check(tics === 2 * rise + VDOORWAIT && level.sectors[s].ceilingHeight === floor, `espera 150 e fecha: ${tics} tics (esperado ${2 * rise + VDOORWAIT})`);
  check(log.sounds.some(([n]) => n === 'dorcls') && !level.thinkers.has(s), 'fecha com "dorcls" e o thinker termina');
  // Reversões pelo uso.
  activateLine(level, li, ctx);
  runTics(level, ctx, 5);
  activateLine(level, li, ctx);
  check(level.thinkers.get(s).direction === -1, 'subindo: o uso fecha na hora');
  runTics(level, ctx, 2);
  activateLine(level, li, ctx);
  check(level.thinkers.get(s).direction === 1, 'descendo: o uso reabre');
  runTics(level, ctx, 200);
  activateLine(level, li, ctx);
  check(level.thinkers.get(s).direction === -1, 'esperando: o uso fecha na hora');
  runTics(level, ctx, 500);
  // open, close e rápidas.
  startDoor(level, s, 'open', ctx);
  runTics(level, ctx, 500);
  check(level.sectors[s].ceilingHeight === top && !level.thinkers.has(s), '"open" fica aberta');
  startDoor(level, s, 'close', ctx);
  runTics(level, ctx, 500);
  check(level.sectors[s].ceilingHeight === floor && !level.thinkers.has(s), '"close" fecha');
  startDoor(level, s, 'blazeRaise', ctx);
  tickLevel(level, ctx);
  check(level.sectors[s].ceilingHeight === Math.min(top, floor + 8) && log.sounds.at(-1)[0] === 'bdopn', 'rápida: 8 por tic, "bdopn"');
  const tag = 77;
  level.map.sectors[s].tag = tag;
  level.tagMap.set(tag, [s]);
  check(!doDoor(level, tag, 'normal', ctx), 'setor com thinker ativo não aceita outro por tag');
  runTics(level, ctx, 500);
}

// --- d) Esmagamento ---
{
  const level = new LevelState(loadMap(wad, 'E1M1'));
  const li = level.map.linedefs.findIndex((l) => l.special === 1);
  const s = level.map.sidedefs[level.map.linedefs[li].leftSidedef].sector;
  const targets = [];
  const { ctx } = makeCtx({ fits: (sec, gap) => targetsFit(targets, sec, gap) });
  activateLine(level, li, ctx);
  let waitTics = 0;
  while (level.thinkers.get(s)?.direction !== -1 && waitTics < 1000) { tickLevel(level, ctx); waitTics++; }
  check(level.thinkers.get(s)?.direction === -1, `porta normal começou a fechar (tic ${waitTics})`);
  targets.push({ sector: s, height: 56 }); // monstro vivo no vão
  let minGap = Infinity, reopened = false;
  for (let i = 0; i < 200 && !reopened; i++) {
    tickLevel(level, ctx);
    minGap = Math.min(minGap, level.sectors[s].ceilingHeight - level.sectors[s].floorHeight);
    reopened = level.thinkers.get(s)?.direction === 1;
  }
  check(reopened && minGap >= 56, `normal: monstro no vão faz reabrir (menor vão ${minGap})`);
  runTics(level, ctx, 400);
  targets.length = 0;
  targets.push({ sector: s, height: PLAYER_HEIGHT });
  startDoor(level, s, 'close', ctx);
  const before = level.sectors[s].ceilingHeight;
  runTics(level, ctx, 100);
  const held = level.sectors[s].ceilingHeight;
  check(level.thinkers.get(s)?.direction === -1 && held >= level.sectors[s].floorHeight + PLAYER_HEIGHT && held < before, `close: para acima do jogador (teto ${held}) e não reabre`);
  targets.length = 0;
  runTics(level, ctx, 100);
  check(!level.thinkers.has(s) && level.sectors[s].ceilingHeight === level.sectors[s].floorHeight, 'close: continua quando o alvo sai');
  // Corpos e itens não entram na lista de alvos (o main só passa vivos): o fechamento não para.
  check(targetsFit([{ sector: 999, height: 56 }], s, 0), 'alvos de outros setores não impedem');
}

// --- e) Elevadores ---
{
  const level = new LevelState(loadMap(wad, 'E1M1'));
  const li = level.map.linedefs.findIndex((l) => l.special === 62);
  const tag = level.map.linedefs[li].tag;
  const s = level.tagMap.get(tag)[0];
  const high = level.sectors[s].floorHeight, low = Math.min(level.lowestNeighborFloor(s), high);
  const rider = { floorZ: high };
  const targets = [];
  const { ctx, log } = makeCtx({ fits: (sec, gap) => targetsFit(targets, sec, gap), onFloorMoved: (sec) => { if (sec === s) rider.floorZ = level.sectors[s].floorHeight; } });
  check(doPlat(level, tag, ctx) && log.sounds[0][0] === 'pstart', 'elevador: desce com "pstart"');
  let tics = 0;
  const floors = [];
  while (level.thinkers.has(s) && tics < 3000) { tickLevel(level, ctx); floors.push(level.sectors[s].floorHeight); tics++; }
  const down = Math.ceil((high - low) / 4);
  console.log(`Elevador (setor ${s}, tag ${tag}): de ${high} a ${low}; ${tics} tics no total`);
  check(floors[0] === Math.max(low, high - 4) && floors[down - 1] === low, 'desce 4 por tic até o menor chão vizinho');
  check(tics === 2 * down + PLATWAIT && level.sectors[s].floorHeight === high, `espera 105, sobe e termina: ${tics} tics (esperado ${2 * down + PLATWAIT})`);
  check(log.sounds.filter(([n]) => n === 'pstop').length === 2, '"pstop" embaixo e em cima');
  check(rider.floorZ === high, 'alvo sobre o elevador acompanha o chão');
  doPlat(level, tag, ctx);
  runTics(level, ctx, down + PLATWAIT + 2);
  check(level.thinkers.get(s).status === 'up', 'subindo');
  targets.push({ sector: s, height: level.sectors[s].ceilingHeight - level.sectors[s].floorHeight - 1 }); // não cabe se subir
  tickLevel(level, ctx);
  check(level.thinkers.get(s).status === 'down', 'subir contra um monstro vivo inverte para descer');
  targets.length = 0;
  runTics(level, ctx, 1000);
}

// --- f) Uso ---
{
  const at = (x, angle = 0) => ({ x, y: 32, angle });
  let c = corridor();
  let { ctx, log } = makeCtx();
  // Janela aberta em 100 e 110, porta em 120: de x = 57, a porta fica a 63.
  let r = useLines(c.level, c.world, at(57), ctx);
  check(r.kind === 'activated' && c.level.thinkers.has(3), `porta a 63, com a janela aberta antes: ativada (${r.kind})`);
  c = corridor();
  r = useLines(c.level, c.world, at(55), makeCtx().ctx);
  check(r.kind === 'none' && !c.level.thinkers.has(3), `porta a 65: nada (${r.kind})`);
  c = corridor();
  ({ ctx, log } = makeCtx());
  // Dentro do setor da porta (x = 130), olhando para o oeste: a linha de x = 120 é vista por trás.
  r = useLines(c.level, c.world, at(130, 180), ctx);
  check(r.kind === 'back' && !c.level.thinkers.has(3) && log.sounds.length === 0, `porta vista por trás: não ativa e para o raio (${r.kind})`);
  c = corridor();
  ({ ctx, log } = makeCtx());
  r = useLines(c.level, c.world, { x: 50, y: 32, angle: 270 }, ctx);
  check(r.kind === 'oof' && log.sounds[0][0] === 'oof', 'parede lisa a 32: "oof"');
  c = corridor({ windowCeil: 0 });
  ({ ctx, log } = makeCtx());
  r = useLines(c.level, c.world, at(60), ctx);
  check(r.kind === 'oof' && !c.level.thinkers.has(3), 'linha de dois lados sem abertura: "oof"');
  c = corridor({ doorSpecial: 88 });
  ({ ctx, log } = makeCtx());
  r = useLines(c.level, c.world, at(60), ctx);
  check(r.kind === 'notUse' && c.level.thinkers.size === 0, 'especial de cruzamento usado com E: nada e para o raio');
}

// --- g) Chaves ---
{
  const colors = { 26: 'blue', 32: 'blue', 27: 'yellow', 34: 'yellow', 28: 'red', 33: 'red' };
  for (const [sp, color] of Object.entries(colors)) {
    const c = corridor({ doorSpecial: Number(sp) });
    const { ctx, log } = makeCtx({ keys: {} });
    const r = activateLine(c.level, 2, ctx);
    check(!r.ok && log.sounds[0][0] === 'oof' && log.messages[0] === `need${color[0].toUpperCase()}${color.slice(1)}Key`, `especial ${sp}: nega sem a chave ${color}`);
    for (const kind of ['Card', 'Skull']) {
      const c2 = corridor({ doorSpecial: Number(sp) });
      check(activateLine(c2.level, 2, makeCtx({ keys: { [`${color}${kind}`]: true } }).ctx).ok, `especial ${sp}: abre com ${color}${kind}`);
    }
    check(SPECIALS[sp].key === color, `especial ${sp} = chave ${color}`);
  }
}

// --- h) Tags ---
{
  // Setores 5 e 6 com tag 7 (portas fechadas), além do corredor.
  const remote = Object.values(SPECIALS).filter((sp) => !sp.manual && sp.action !== 'exit');
  for (const sp of remote) {
    const c = corridor({ extraSectors: [{ floor: 0, ceil: 0, tag: 7 }, { floor: 0, ceil: 0, tag: 7 }],
      extraLines: [{ a: [0, 100], b: [10, 100], front: 0, special: sp.special, tag: 7, tex: { middle: 'SW1BRN1' } }] });
    const li = c.map.linedefs.length - 1;
    const { ctx } = makeCtx();
    const r = activateLine(c.level, li, ctx);
    const keys = [...c.level.thinkers.keys()].sort().join();
    check(r.ok && keys === '5,6', `especial ${sp.special} (${sp.desc}): aciona exatamente os setores da tag (${keys})`);
    check(sp.repeat ? c.level.lineSpecial[li] === sp.special : c.level.lineSpecial[li] === 0, `especial ${sp.special}: ${sp.repeat ? 'repete' : 'vira 0'}`);
  }
  const c = corridor({ extraSectors: [{ floor: 0, ceil: 0, tag: 7 }],
    extraLines: [{ a: [0, 100], b: [10, 100], front: 0, special: 29, tag: 7, tex: { middle: 'SW1BRN1' } }] });
  const li = c.map.linedefs.length - 1;
  const { ctx } = makeCtx();
  startDoor(c.level, 5, 'normal', ctx);
  const r = activateLine(c.level, li, ctx);
  check(!r.ok && c.level.lineSpecial[li] === 29 && c.map.sidedefs[c.map.linedefs[li].rightSidedef].middleTexture === 'SW1BRN1', 'S1 com o setor ocupado: não consome nem troca a textura');
}

// --- i) Cruzamento ---
{
  // WR 90 (porta normal) com tag 9 no setor da porta do corredor (3).
  const c = corridor({ doorSpecial: 0, doorTag: 9, extraLines: [westFacing(50, 0, 64, { front: 0, back: 0, special: 90, tag: 9 })] });
  const { ctx } = makeCtx();
  check(crossLines(c.level, c.world, { x: 20, y: 32 }, { x: 80, y: 32 }, ctx).length === 1 && c.level.thinkers.has(3), 'passo grande atravessa a WR e dispara uma vez');
  runTics(c.level, ctx, 1000);
  check(crossLines(c.level, c.world, { x: 80, y: 32 }, { x: 20, y: 32 }, ctx).length === 1, 'dispara também no sentido contrário');
  runTics(c.level, ctx, 1000);
  check(crossLines(c.level, c.world, { x: 20, y: 32 }, { x: 49, y: 32 }, ctx).length === 0, 'movimento que termina antes da linha: nada');
  const tracker = new CrossTracker();
  check(tracker.step({ x: 20, y: 32 }, true) === null, 'primeiro passo: sem segmento');
  tracker.invalidate(); // troca de modo, NEW GAME ou reinício
  check(tracker.step({ x: 80, y: 32 }, true) === null, 'posição discreta (invalidada): não dispara');
  check(tracker.step({ x: 20, y: 32 }, false) === null && tracker.step({ x: 80, y: 32 }, false) === null, 'modo voar: não dispara');
  const w1 = corridor({ doorSpecial: 0, doorTag: 9, extraLines: [westFacing(50, 0, 64, { front: 0, back: 0, special: 2, tag: 9 })] });
  crossLines(w1.level, w1.world, { x: 20, y: 32 }, { x: 80, y: 32 }, ctx);
  check(w1.level.lineSpecial[w1.map.linedefs.length - 1] === 0, 'W1 vira 0 depois de executar');
}

// --- j) Interruptores ---
{
  const mk = (special, tex) => corridor({ extraSectors: [{ floor: 0, ceil: 0, tag: 7 }],
    extraLines: [{ a: [0, 100], b: [10, 100], front: 0, special, tag: 7, tex: { middle: tex } }] });
  let c = mk(103, 'SW1BRN1');
  let li = c.map.linedefs.length - 1;
  let { ctx, log } = makeCtx();
  activateLine(c.level, li, ctx);
  const side = () => c.map.sidedefs[c.map.linedefs[li].rightSidedef];
  check(side().middleTexture === 'SW2BRN1' && c.level.lineSpecial[li] === 0 && log.sounds.some(([n]) => n === 'swtchn'), 'S1: SW1 vira SW2, fica e toca "swtchn"');
  runTics(c.level, ctx, 100);
  check(side().middleTexture === 'SW2BRN1', 'S1: continua apertado');
  c = mk(61, 'SW1GRAY');
  li = c.map.linedefs.length - 1;
  ({ ctx, log } = makeCtx());
  activateLine(c.level, li, ctx);
  check(side().middleTexture === 'SW2GRAY', 'SR: troca');
  runTics(c.level, ctx, BUTTONTIME - 1);
  check(side().middleTexture === 'SW2GRAY' && !activateLine(c.level, li, ctx).ok, 'SR: apertado durante 35 tics, outros usos ignorados');
  runTics(c.level, ctx, 1);
  check(side().middleTexture === 'SW1GRAY' && log.sounds.filter(([n]) => n === 'swtchn').length === 2, 'SR: volta em 35 tics com "swtchn"');
  c = mk(103, 'SW1FAKE');
  li = c.map.linedefs.length - 1;
  ({ ctx, log } = makeCtx());
  check(activateLine(c.level, li, ctx).ok && side().middleTexture === 'SW1FAKE' && log.warnings.length === 1, 'contraparte inexistente: age, avisa e não troca');
  const missing = [...switchCounterpartNames(e1)].filter((n) => !textureDefs.has(n));
  console.log(`Interruptores do E1M1: ${[...switchCounterpartNames(e1)].join(', ')}; contrapartes ausentes: ${missing.join(', ') || 'nenhuma'}`);
  check(missing.length === 0, 'todas as contrapartes do E1M1 existem');
}

// --- k) Saída e reinício ---
{
  const map = loadMap(wad, 'E1M1');
  const level = new LevelState(map);
  const initial = level.snapshot();
  const { ctx } = makeCtx();
  const exitLine = map.linedefs.findIndex((l) => l.special === 11);
  check(activateLine(level, exitLine, ctx).ok && level.finished, 'saída: marca o fim');
  for (let i = 0; i < INTERMISSION_DELAY - 1; i++) level.advanceClock();
  check(!level.intermission, 'antes de 35 tics: ainda sem estatísticas');
  level.advanceClock();
  check(level.intermission, '35 tics depois: tela de estatísticas (simulação congelada)');
  activateLine(level, map.linedefs.findIndex((l) => l.special === 1), ctx);
  doPlat(level, map.linedefs[map.linedefs.findIndex((l) => l.special === 62)].tag, ctx);
  runTics(level, ctx, 37);
  level.reset();
  check(level.snapshot() === initial, 'reinício restaura alturas, especiais, texturas, thinkers e contadores');
  const dead = new LevelState(loadMap(wad, 'E1M1'));
  check(!activateLine(dead, exitLine, makeCtx({ dead: true }).ctx).ok && !dead.finished, 'morto: a saída não tem efeito');
}

// --- l) Monstros e portas ---
const { lumps } = findSpriteLumps(wad);
const mtable = resolveMonsterTable(lumps, new Set([3002, 3004]));
function doorRun(seed, doorSpecial, tics = 1500) {
  // Sala 0 (0..400), porta 1 (400..416), sala 2 (416..800); altura 128; corredor de 0 a 200 em y.
  const map = synthMap([{ floor: 0, ceil: 128 }, { floor: 0, ceil: 0 }, { floor: 0, ceil: 128 }], [
    westFacing(400, 0, 200, { front: 0, back: 1, special: doorSpecial }),
    { a: [416, 0], b: [416, 200], front: 2, back: 1, special: doorSpecial },
    { a: [0, 0], b: [800, 0], front: 0 }, { a: [800, 200], b: [0, 200], front: 0 },
    { a: [0, 200], b: [0, 0], front: 0 }, { a: [800, 0], b: [800, 200], front: 2 },
  ]);
  const level = new LevelState(map);
  const world = { map, lines: buildCollisionLines(map), sectors: map.sectors, lineSpecial: level.lineSpecial,
    sectorAt: (x) => (x < 400 ? 0 : x < 416 ? 1 : 2) };
  const player = { x: 700, y: 100, z: 0, alive: true };
  const rng = new Rng(seed);
  const sys = new MonsterSystem([{ index: 0, x: 100, y: 100, angle: 0, flags: 0, base: [100, 0, -100] }], mtable.entries, () => 3002, rng, {});
  let closes = 0;
  const targets = () => [{ sector: world.sectorAt(player.x), height: 56 }, ...sys.monsters.filter((m) => m.shootable).map((m) => ({ sector: m.sector, height: m.entry.height }))];
  const { ctx } = makeCtx({ fits: (s, gap) => targetsFit(targets(), s, gap) });
  const ai = new MonsterAI({ world, rng, player: () => player, noTarget: () => false, staticSolids: [], onSound: () => {},
    useDoor: (m, li) => { const before = level.thinkers.get(1)?.direction; const r = monsterUseDoor(level, li, m, ctx); if (before === 1 && level.thinkers.get(1)?.direction === -1) closes++; return r; } }).attach(sys);
  const m = sys.monsters[0];
  m.target = 'player';
  sys.setState(m, 'chase');
  for (let t = 1; t <= tics; t++) {
    tickLevel(level, ctx);
    sys.tick();
    if (m.x > 416 + m.entry.radius) return { passed: t, closes, opened: level.sectors[1].ceilingHeight > 0 || level.thinkers.size > 0 };
  }
  void ai;
  return { passed: -1, closes, opened: level.sectors[1].ceilingHeight > 0 || level.thinkers.size > 0 };
}
{
  const times = [];
  let anyClose = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const r = doorRun(seed, 1);
    if (r.passed > 0) times.push(r.passed);
    anyClose += r.closes;
  }
  console.log(`Monstro e porta comum: ${times.length} de 20 sementes atravessaram; tics ${Math.min(...times)} a ${Math.max(...times)}`);
  check(times.length === 20, 'monstro abre a porta tipo 1 e atravessa (20 sementes, até 1500 tics)');
  check(anyClose === 0, 'monstro nunca fecha portas');
  for (const sp of [26, 31]) {
    const r = doorRun(1, sp, 600);
    check(r.passed < 0 && !r.opened, `monstro não abre a porta ${sp}`);
  }
}

// --- m) Som e portas ---
{
  const c = corridor();
  const graph = buildSoundGraph(c.world);
  const alertedFrom = () => { const a = new Array(c.map.sectors.length).fill(false); noiseAlert(graph, 0, a); return a; };
  const bfs = () => {
    const out = new Set([0]); const queue = [0];
    while (queue.length) {
      const s = queue.shift();
      for (const l of c.world.lines) {
        if (l.oneSided || (l.front !== s && l.back !== s)) continue;
        const f = c.map.sectors[l.front], b = c.map.sectors[l.back];
        if (Math.min(f.ceilingHeight, b.ceilingHeight) - Math.max(f.floorHeight, b.floorHeight) <= 0) continue;
        const to = l.front === s ? l.back : l.front;
        if (!out.has(to)) { out.add(to); queue.push(to); }
      }
    }
    return out;
  };
  const same = (a) => { const b = bfs(); return a.every((v, i) => v === b.has(i)); };
  let a = alertedFrom();
  check(!a[4] && same(a), 'porta fechada: o alerta não atravessa');
  c.map.sectors[3].ceilingHeight = 124;
  a = alertedFrom();
  check(a[4] && same(a), 'porta aberta: atravessa');
  c.map.sectors[3].ceilingHeight = 0;
  a = alertedFrom();
  check(!a[4] && same(a), 'fechada de novo: volta a bloquear');
}

// --- n) Física, visão e hitscan com uma porta do E1M1 ---
{
  const map = loadMap(wad, 'E1M1');
  const level = new LevelState(map);
  const world = { map, lines: buildCollisionLines(map), sectors: map.sectors, spawn: { x: 0, y: 0 } };
  const li = map.linedefs.findIndex((l, i) => l.special === 1 && i === 55) >= 0 ? 55 : map.linedefs.findIndex((l) => l.special === 1);
  const line = map.linedefs[li];
  const a = map.vertexes[line.v1], b = map.vertexes[line.v2];
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const n = { x: (b.y - a.y) / len, y: -(b.x - a.x) / len }; // normal para a frente (direita)
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const s = map.sidedefs[line.leftSidedef].sector;
  const front = { x: mid.x + n.x * 48, y: mid.y + n.y * 48 };
  // Ponto atrás da porta: do outro lado do setor da porta.
  let behind = null;
  for (let d = 24; d < 200; d += 4) {
    const p = { x: mid.x - n.x * d, y: mid.y - n.y * d };
    const sp = findSector(map, p.x, p.y);
    if (sp !== s) { behind = { x: mid.x - n.x * (d + 40), y: mid.y - n.y * (d + 40) }; break; }
  }
  const walk = (state, n0, steps) => { for (let i = 0; i < steps; i++) stepPlayer(state, { vx: -n0.x * 200, vy: -n0.y * 200 }, 1 / 35, world); return state; };
  let p = walk(createPlayerState(world, front.x, front.y), n, 60);
  check(findSector(map, p.x, p.y) !== s && Math.hypot(p.x - mid.x, p.y - mid.y) >= 15, 'porta fechada bloqueia o jogador');
  const eyeZ = map.sectors[findSector(map, front.x, front.y)].floorHeight + 41;
  const sightTo = () => checkSight(world, { x: front.x, y: front.y, z: eyeZ }, { x: behind.x, y: behind.y, z: map.sectors[findSector(map, behind.x, behind.y)].floorHeight, height: 56 });
  const yaw = Math.atan2(behind.y - front.y, behind.x - front.x) * 180 / Math.PI;
  const shotT = () => shoot(world, { x: front.x, y: front.y, z: eyeZ }, yaw, 0, 2048, []).t;
  const dist = Math.hypot(behind.x - front.x, behind.y - front.y);
  check(!sightTo() && shotT() < dist, 'porta fechada: sem visão e o tiro bate antes');
  map.sectors[s].ceilingHeight = doorTop(level, s);
  check(sightTo() && shotT() > dist, 'porta aberta: visão e tiro passam');
  p = walk(createPlayerState(world, front.x, front.y), n, 60);
  check(Math.hypot(p.x - mid.x, p.y - mid.y) > 30 || findSector(map, p.x, p.y) === s, 'porta aberta: o jogador passa');
  // Jogador parado no vão: a porta que fecha reabre.
  const inDoor = { x: mid.x - n.x * 4, y: mid.y - n.y * 4 };
  const targets = [{ sector: findSector(map, inDoor.x, inDoor.y), height: 56 }];
  const { ctx } = makeCtx({ fits: (sec, gap) => targetsFit(targets, sec, gap) });
  map.sectors[s].ceilingHeight = map.sectors[s].floorHeight;
  activateLine(level, li, ctx);
  runTics(level, ctx, 300);
  check(map.sectors[s].ceilingHeight - map.sectors[s].floorHeight >= 56, 'jogador no vão: a porta não fecha sobre ele (reabre)');
}

// --- o) Relatório do E1M1 ---
{
  const hist = new Map();
  e1.linedefs.forEach((l, i) => {
    if (!l.special) return;
    if (!hist.has(l.special)) hist.set(l.special, { n: 0, tags: new Set(), lines: [] });
    const h = hist.get(l.special);
    h.n++; h.tags.add(l.tag); h.lines.push(i);
  });
  console.log('Especiais do E1M1:');
  for (const [sp, h] of [...hist].sort((x, y) => x[0] - y[0])) {
    const targets = [...h.tags].filter((t) => t !== 0).map((t) => `${t}->[${(e1Level.tagMap.get(t) ?? []).join(',')}]`).join(' ');
    console.log(`  ${sp}: ${h.n}x ${SPECIALS[sp] ? SPECIALS[sp].desc : 'NÃO SUPORTADO'}${targets ? `; tags ${targets}` : ''}`);
  }
  console.log(`Setores móveis: ${e1Analysis.movableSectors.size}; linhas dinâmicas: ${e1Sets.lines.size}; ` +
    `buffers dinâmicos: ${dyn.byteLength} bytes por conjunto de vértices (x2), ${dyn.indices.byteLength} bytes de índices`);
  const narrow = [];
  for (const s of [...e1Analysis.movableSectors].sort((x, y) => x - y)) {
    const sec = e1.sectors[s];
    const top = doorTop(e1Level, s);
    console.log(`  setor ${s}: chão ${sec.floorHeight}, teto ${sec.ceilingHeight}, topo de porta ${top}, menor chão vizinho ${e1Level.lowestNeighborFloor(s)}`);
    if (doorSectors.includes(s) && top - sec.floorHeight < 56) narrow.push(s);
  }
  if (narrow.length) console.log(`AVISO: portas com abertura menor que 56: ${narrow.join(', ')}`);
  console.log(`Avisos: ${e1Analysis.warnings.join('; ') || 'nenhum'}; não suportados: ${[...e1Analysis.unsupported.keys()].join(', ') || 'nenhum'}`);
  check(dyn.vertexCount > 0 && dyn.indices.length > 0, 'geometria dinâmica não vazia');
  check(openAllDoors(new LevelState(loadMap(wad, 'E1M1')), makeCtx().ctx) === doorSectors.length, 'OPEN ALL DOORS aciona todas as portas');
}

// --- p) Lumps ---
{
  const sounds = ['doropn', 'dorcls', 'bdopn', 'bdcls', 'pstart', 'pstop', 'swtchn', 'swtchx', 'oof'];
  const missing = sounds.filter((n) => wad.findLump(`DS${n.toUpperCase()}`) < 0);
  console.log(`Sons ausentes: ${missing.join(', ') || 'nenhum'}; INTERPIC (opcional): ${wad.findLump('INTERPIC') >= 0 ? 'presente' : 'ausente'}`);
  check(missing.length === 0, 'todos os sons de portas, elevadores e interruptores existem');
  check(switchTextureOf(e1.sidedefs[e1.linedefs.find((l) => l.special === 11).rightSidedef]), 'a saída do E1M1 é um interruptor com textura SW');
}

void PlayerStats;
console.log(failures ? `${failures} falha(s)` : 'Tudo certo');
process.exit(failures ? 1 : 0);
