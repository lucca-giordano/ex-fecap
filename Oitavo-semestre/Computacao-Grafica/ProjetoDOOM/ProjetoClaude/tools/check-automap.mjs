// Verificação do automapa, dos códigos de trapaça, do noclip, dos créditos e do levantamento, sem
// navegador. Uso: node tools/check-automap.mjs. Sai com código diferente de zero se algo falhar.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadWad } from './baseline-geometry.mjs';
import { loadMap } from '../src/wad/MapData.js';
import { readPalette } from '../src/wad/Textures.js';
import { findSector } from '../src/map/bsp.js';
import { buildCollisionLines } from '../src/physics/collisionData.js';
import { createPlayerState, stepPlayer } from '../src/physics/collision.js';
import { AutomapState, AM_WIDTH, AM_HEIGHT, ZOOM_STEP, PAN_PIXELS } from '../src/automap/AutomapState.js';
import { markSeen, hfovDeg } from '../src/automap/seen.js';
import {
  lineColorKind, clipLine, bresenham, PLAYER_ARROW, figureSegments, automapColors, drawAutomap, AM_COLORS,
} from '../src/automap/AutomapRenderer.js';
import { CheatReader, giveAll, toggleGod, myPosText } from '../src/game/Cheats.js';
import { PlayerStats, AMMO_TYPES, KEY_NAMES } from '../src/game/PlayerStats.js';
import { ACTION_KEYS } from '../src/input/Controls.js';
import { loadMenuAssets } from '../src/menu/MenuAssets.js';
import { composeMenu, creditsPages, MENU_LAYOUT } from '../src/menu/MenuRenderer.js';
import { MENU_TEXT } from '../src/menu/menuText.js';

let failures = 0;
const check = (cond, label) => {
  if (!cond) { failures++; console.log(`FALHA: ${label}`); }
  return cond;
};
const wad = loadWad();

// --- Mapa sintético: sectors [{ floor, ceil }], lines [{ a, b, front, back, special, flags }] ---
function synthMap(sectors, lines) {
  const vertexes = [], sidedefs = [], linedefs = [];
  const vtx = (p) => { vertexes.push({ x: p[0], y: p[1] }); return vertexes.length - 1; };
  const side = (sector) => { sidedefs.push({ xOffset: 0, yOffset: 0, upperTexture: '-', middleTexture: '-', lowerTexture: '-', sector }); return sidedefs.length - 1; };
  for (const l of lines) {
    const right = side(l.front);
    const left = l.back === undefined ? 0xFFFF : side(l.back);
    linedefs.push({ v1: vtx(l.a), v2: vtx(l.b), flags: l.flags ?? 0, special: l.special ?? 0, tag: 0, rightSidedef: right, leftSidedef: left });
  }
  return { name: 'SYNTH', things: [], linedefs, sidedefs, vertexes, segs: [], ssectors: [], nodes: [],
    sectors: sectors.map((s) => ({ floorHeight: s.floor, ceilingHeight: s.ceil, floorTexture: 'F', ceilingTexture: 'C', lightLevel: 160, special: 0, tag: 0 })) };
}

// --- a) Cores ---
{
  const map = synthMap([{ floor: 0, ceil: 128 }, { floor: 0, ceil: 128 }, { floor: 24, ceil: 128 }, { floor: 0, ceil: 96 }, { floor: 0, ceil: 0 }], [
    { a: [0, 0], b: [0, 64], front: 0 },                       // 0: um lado só
    { a: [10, 0], b: [10, 64], front: 0, back: 1 },            // 1: dois lados sem mudança
    { a: [20, 0], b: [20, 64], front: 0, back: 2 },            // 2: chão diferente
    { a: [30, 0], b: [30, 64], front: 0, back: 3 },            // 3: teto diferente
    { a: [40, 0], b: [40, 64], front: 0, back: 1, special: 39 }, // 4: teleporte
    { a: [50, 0], b: [50, 64], front: 0, back: 2, flags: 0x0020 }, // 5: secreta
    { a: [60, 0], b: [60, 64], front: 0, back: 2, flags: 0x0080 }, // 6: não aparece
    { a: [70, 0], b: [70, 64], front: 0, back: 4 },            // 7: porta (teto 0)
  ]);
  const mapped = new Uint8Array(8).fill(1);
  const k = (li, cheat = 0, m = mapped, allmap = false) => lineColorKind(map, li, m, cheat, allmap);
  check(k(0) === 'wall', 'um lado só: parede');
  check(k(1) === null && k(1, 1) === 'twoSided', 'dois lados sem mudança: nada com cheat 0, cinza com cheat 1');
  check(k(2) === 'floor' && k(3) === 'ceiling', 'chão diferente: marrom; teto diferente: amarelo');
  check(k(4) === 'special39', 'especial 39: vermelho médio');
  check(k(5) === 'wall', 'flag 0x0020: parede');
  check(k(6) === null && k(6, 1) === 'floor', 'flag 0x0080: some com cheat 0, aparece com cheat >= 1');
  const none = new Uint8Array(8);
  check(k(2, 0, none) === null, 'não mapeada, sem cheat: não desenha');
  check(k(2, 2, none) === 'floor', 'não mapeada com cheat 2: desenha');
  check(k(2, 0, none, true) === 'allmap' && k(6, 0, none, true) === null, 'allmap: cinza, exceto 0x0080');
  check(k(7) === 'ceiling', 'porta fechada: teto diferente (amarelo)');
  map.sectors[4].ceilingHeight = 128;
  check(k(7) === null && k(7, 1) === 'twoSided', 'a porta aberta muda a cor da linha');
  const colors = automapColors(readPalette(wad));
  console.log(`Cores do automapa: ${Object.entries(colors).map(([n, c]) => `${n} ${c.index} (${c.rgb.join(',')})`).join('; ')}`);
  check(Object.keys(AM_COLORS).every((n) => Number.isInteger(colors[n].index)), 'índice da paleta para cada cor');
}

// --- b) Recorte e Bresenham ---
{
  check(clipLine(10, 10, 100, 100).join() === '10,10,100,100', 'dentro: igual');
  check(clipLine(-50, -50, -10, -20) === null && clipLine(400, 10, 500, 100) === null, 'fora: descartada');
  const c = clipLine(-100, 84, 500, 84);
  check(c && c[0] === 0 && c[2] === AM_WIDTH - 1 && c[1] === 84, `cruzando: recortada a [0, 319] (${c})`);
  const d = clipLine(160, -50, 160, 400);
  check(d && d[1] === 0 && d[3] === AM_HEIGHT - 1, 'vertical cruzando: recortada a [0, 167]');
  const pts = [];
  bresenham(3, 4, 40, 17, (x, y) => pts.push([x, y]));
  const contiguous = pts.every((p, i) => i === 0 || Math.max(Math.abs(p[0] - pts[i - 1][0]), Math.abs(p[1] - pts[i - 1][1])) === 1);
  check(contiguous && pts[0].join() === '3,4' && pts.at(-1).join() === '40,17', 'Bresenham: contíguo e com as extremidades certas');
  let outside = 0;
  bresenham(-100, -100, 600, 400, (x, y) => { if (x < 0 || x >= AM_WIDTH || y < 0 || y >= AM_HEIGHT) outside++; });
  check(outside === 0, 'Bresenham nunca escreve fora de 320x168');
  const buffer = { width: 320, height: 200, data: new Uint8ClampedArray(320 * 200 * 4) };
  buffer.data.fill(7);
  const map = loadMap(wad, 'E1M1');
  const am = new AutomapState(map);
  am.cheat = 2;
  drawAutomap(buffer, am, map, { x: 1056, y: -3616, angle: 90 }, [{ x: 1056, y: -3500, angle: 0 }], automapColors(readPalette(wad)));
  let barTouched = false;
  for (let i = 320 * 168 * 4; i < buffer.data.length; i++) if (buffer.data[i] !== 7) barTouched = true;
  check(!barTouched, 'o desenho fica nas linhas 0 a 167 (a barra não é tocada)');
}

// --- c) Projeção, zoom, mapa inteiro e pan ---
{
  const map = loadMap(wad, 'E1M1');
  const am = new AutomapState(map);
  am.tick({}, { x: 1000, y: -3000 });
  check(am.toScreen(1000, -3000).join() === '160,84', 'com follow, o jogador fica em (160, 84)');
  check(am.toScreen(1000, -2900)[1] < 84, 'norte para cima');
  const s0 = am.scale;
  am.tick({ zoomIn: true }, { x: 1000, y: -3000 });
  check(Math.abs(am.scale - Math.min(am.maxScale, s0 * ZOOM_STEP)) < 1e-12, 'zoom de 1.02 por tic');
  for (let i = 0; i < 2000; i++) am.tick({ zoomIn: true }, { x: 1000, y: -3000 });
  check(am.scale === am.maxScale, 'zoom limitado a maxScale');
  for (let i = 0; i < 2000; i++) am.tick({ zoomOut: true }, { x: 1000, y: -3000 });
  check(am.scale === am.minScale, 'zoom limitado a minScale');
  am.scale = 0.5;
  am.toggleBigMode();
  check(am.scale === am.minScale && !am.follow && am.bigMode, 'Digit0: mapa inteiro, sem follow');
  am.toggleBigMode();
  check(am.scale === 0.5 && am.follow && !am.bigMode, 'Digit0 de novo: volta ao estado anterior');
  am.follow = false;
  const cx = am.centerX;
  am.tick({ panX: 1 }, { x: 0, y: 0 });
  check(Math.abs(am.centerX - (cx + PAN_PIXELS / am.scale)) < 1e-9, 'pan de 4 pixels de tela por tic');
  for (let i = 0; i < 10000; i++) am.tick({ panX: 1, panY: 1 }, { x: 0, y: 0 });
  check(am.centerX === am.box.maxX && am.centerY === am.box.maxY, 'pan limitado à caixa do mapa');
}

// --- d) Seta do jogador ---
{
  check(PLAYER_ARROW.length === 7, 'seta com 7 segmentos');
  const am = new AutomapState(loadMap(wad, 'E1M1'));
  am.tick({}, { x: 0, y: 0 });
  const tipAt = (angle) => {
    const seg = figureSegments(PLAYER_ARROW, 0, 0, angle)[0]; // (-R+R/8, 0) -> (R, 0): termina na ponta
    return am.toScreen(seg[2], seg[3]);
  };
  const t0 = tipAt(0), t90 = tipAt(90);
  check(t0[0] > 160 && t0[1] === 84, `ângulo 0 aponta para a direita (${t0})`);
  check(t90[1] < 84 && t90[0] === 160, `ângulo 90 aponta para cima (${t90})`);
}

// --- e) Linhas vistas ---
{
  // Sala 0 (0..100) -> porta 1 (100..110) -> sala 2 (110..300); a linha 6 fecha a sala 2.
  const room = (doorCeil, windowFloor = 0, windowCeil = 128) => {
    const map = synthMap([{ floor: 0, ceil: 128 }, { floor: windowFloor, ceil: doorCeil === null ? windowCeil : doorCeil }, { floor: 0, ceil: 128 }], [
      { a: [100, 200], b: [100, 0], front: 0, back: 1 }, { a: [110, 200], b: [110, 0], front: 1, back: 2 },
      { a: [0, 0], b: [300, 0], front: 0 }, { a: [300, 200], b: [0, 200], front: 0 }, { a: [0, 200], b: [0, 0], front: 0 },
      { a: [300, 0], b: [300, 200], front: 2 },
    ]);
    return { map, lines: buildCollisionLines(map), sectors: map.sectors };
  };
  const look = (w) => {
    const mapped = new Uint8Array(w.map.linedefs.length);
    markSeen(w, mapped, { x: 50, y: 100, z: 0, angle: 0 }, hfovDeg(4 / 3), 0);
    return mapped;
  };
  let m = look(room(0));
  check(m[0] === 1 && m[1] === 0 && m[5] === 0, 'porta fechada: as linhas atrás não são marcadas');
  m = look(room(128));
  check(m[1] === 1 && m[5] === 1, 'porta aberta: as linhas atrás são marcadas');
  m = look(room(null, 0, 30));
  check(m[0] === 1 && m[5] === 0, 'janela baixa abaixo do olho (41): não atravessa');
  check(look(room(0))[4] === 1, 'linhas do setor atual marcadas (mesmo atrás do jogador)');
  check(Math.abs(hfovDeg(4 / 3) - 90) < 1e-9, 'campo de visão do modo retro: 90 graus');
  const map = loadMap(wad, 'E1M1');
  const world = { map, lines: buildCollisionLines(map), sectors: map.sectors };
  const start = map.things.find((t) => t.type === 1);
  const sec = findSector(map, start.x, start.y);
  const mapped = new Uint8Array(map.linedefs.length);
  const t0 = performance.now();
  const N = 20;
  for (let i = 0; i < N; i++) markSeen(world, mapped, { x: start.x, y: start.y, z: map.sectors[sec].floorHeight, angle: start.angle }, hfovDeg(4 / 3), sec);
  const ms = (performance.now() - t0) / N;
  const n = mapped.reduce((a, b) => a + b, 0);
  console.log(`E1M1, início do jogador 1: ${n} de ${map.linedefs.length} linhas marcadas; ${ms.toFixed(2)} ms por chamada`);
  if (ms > 2) console.log(`AVISO: markSeen levou ${ms.toFixed(2)} ms (acima de 2 ms)`);
  check(n > 0 && Number.isFinite(ms), 'E1M1: linhas marcadas, sem NaN');
}

// --- f) Códigos de trapaça ---
{
  const type = (reader, text) => [...text].map((ch) => reader.push(`Key${ch}`));
  for (const code of ['IDDQD', 'IDKFA', 'IDFA', 'IDCLIP', 'IDSPISPOPD', 'IDDT', 'IDMYPOS']) {
    const r = type(new CheatReader(), code);
    check(r.at(-1).cheat === code.toLowerCase(), `${code} reconhecido`);
  }
  check(type(new CheatReader(), 'IDDXQD').every((r) => r.cheat === null), 'letra errada no meio: não reconhece');
  check(type(new CheatReader(), 'XYZIDFA').at(-1).cheat === 'idfa', 'reconhece no fim do buffer');
  const rd = new CheatReader();
  type(rd, 'IDKF');
  rd.clear(); // blur, menu ou perda do pointer lock
  check(rd.push('KeyA').cheat === null, 'buffer limpo: precisa recomeçar');
  const rr = new CheatReader();
  type(rr, 'IDDQ');
  check(rr.push('KeyD', true).cheat === null && rr.push('KeyD').cheat === 'iddqd', 'e.repeat ignorado');
  // Consumo: depois de "ID", F, L, P, T, M (alternâncias) não disparam; W, A, S, D, C e Space são de segurar.
  for (const ch of ['F', 'L', 'P', 'T', 'M']) {
    const r = new CheatReader();
    type(r, 'ID');
    const action = Object.entries(ACTION_KEYS).find(([, k]) => k.code === `Key${ch}`);
    check(r.push(`Key${ch}`).consume && action[1].kind !== 'hold', `"ID" + ${ch}: consumida (${action[0]})`);
  }
  check(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyC', 'Space'].every((code) => Object.values(ACTION_KEYS).find((k) => k.code === code).kind === 'hold'),
    'W, A, S, D, C e Space são de segurar: o Controls não os bloqueia');
  check(!new CheatReader().push('KeyI').consume, '"I" sozinha não é consumida');
  check(!new CheatReader().push('KeyF').consume, 'F sem código em andamento: não consumida');
  const s = new PlayerStats();
  s.health = 40;
  let god = toggleGod(s, false);
  check(god && s.health === 100, 'IDDQD liga e sobe a vida a 100');
  god = toggleGod(s, god);
  check(!god && s.health === 100, 'IDDQD desliga');
  const k = new PlayerStats();
  giveAll(k, true);
  check([1, 2, 3, 4, 5, 6, 7].every((n) => k.weaponsOwned.has(n)) && k.hasBackpack && AMMO_TYPES.every((t) => k.ammo[t] === k.maxAmmoOf(t)) &&
    k.armor === 200 && k.armorType === 2 && KEY_NAMES.every((n) => k.keys[n]), 'IDKFA: armas, mochila, munição, armadura azul e chaves');
  const f = new PlayerStats();
  giveAll(f, false);
  check(f.armor === 200 && f.ammo.clip === 400 && KEY_NAMES.every((n) => !f.keys[n]), 'IDFA: tudo sem as chaves');
  const am = new AutomapState(loadMap(wad, 'E1M1'));
  check([am.cycleCheat(), am.cycleCheat(), am.cycleCheat()].join() === '1,2,0', 'IDDT cicla 0, 1, 2, 0');
  check(myPosText(90, 1056, -3616) === 'ANG=90 X=1056 Y=-3616' && myPosText(-90.4, 10.6, -3.2) === 'ANG=270 X=11 Y=-3', 'IDMYPOS formata a mensagem');
}

// --- g) Noclip ---
{
  const map = loadMap(wad, 'E1M1');
  const world = { map, lines: buildCollisionLines(map), sectors: map.sectors, spawn: { x: 0, y: 0 } };
  const quiet = console.warn;
  console.warn = () => {}; // a física avisa ao recuperar posições inválidas
  const walk = (x, y, dirX, dirY, dist, noclip, solids = []) => {
    const s = createPlayerState(world, x, y);
    const steps = 40;
    for (let i = 0; i < steps; i++) stepPlayer(s, { vx: dirX * dist * 35 / steps, vy: dirY * dist * 35 / steps }, 1 / 35, world, solids, { noclip });
    return s;
  };
  // Parede de um lado só: começa 40 à frente dela e anda 120 para dentro.
  const wallLine = world.lines.find((l) => l.oneSided && Math.hypot(l.x2 - l.x1, l.y2 - l.y1) > 200);
  const len = Math.hypot(wallLine.x2 - wallLine.x1, wallLine.y2 - wallLine.y1);
  const nx = (wallLine.y2 - wallLine.y1) / len, ny = -(wallLine.x2 - wallLine.x1) / len; // frente (direita)
  const mx = (wallLine.x1 + wallLine.x2) / 2 + nx * 40, my = (wallLine.y1 + wallLine.y2) / 2 + ny * 40;
  const side = (p) => (wallLine.x2 - wallLine.x1) * (p.y - wallLine.y1) - (wallLine.y2 - wallLine.y1) * (p.x - wallLine.x1);
  check(side(walk(mx, my, -nx, -ny, 120, true)) > 0, 'noclip: atravessa a parede de um lado só');
  check(side(walk(mx, my, -nx, -ny, 120, false)) < 0, 'sem noclip: a mesma parede bloqueia');
  // Sólido no caminho, no ponto de início do jogador 1.
  const start = map.things.find((t) => t.type === 1);
  const a = start.angle * Math.PI / 180;
  const solids = [{ x: start.x + Math.cos(a) * 60, y: start.y + Math.sin(a) * 60, radius: 16 }];
  const through = walk(start.x, start.y, Math.cos(a), Math.sin(a), 100, true, solids);
  const blocked = walk(start.x, start.y, Math.cos(a), Math.sin(a), 100, false, solids);
  check(Math.hypot(through.x - start.x, through.y - start.y) > 90 && Math.hypot(blocked.x - start.x, blocked.y - start.y) < 60, 'noclip atravessa um sólido; sem noclip ele bloqueia');
  // Degrau de mais de 100 unidades: uma linha de dois lados entre chãos que diferem mais de 100.
  const step = world.lines.find((l) => !l.oneSided && Math.abs(map.sectors[l.front].floorHeight - map.sectors[l.back].floorHeight) >= 100 &&
    Math.hypot(l.x2 - l.x1, l.y2 - l.y1) > 64);
  const low = map.sectors[step.front].floorHeight < map.sectors[step.back].floorHeight;
  const slen = Math.hypot(step.x2 - step.x1, step.y2 - step.y1);
  let snx = (step.y2 - step.y1) / slen, sny = -(step.x2 - step.x1) / slen; // aponta para a frente
  if (!low) { snx = -snx; sny = -sny; } // começa do lado baixo
  const sx = (step.x1 + step.x2) / 2 + snx * 30, sy = (step.y1 + step.y2) / 2 + sny * 30;
  const high = Math.max(map.sectors[step.front].floorHeight, map.sectors[step.back].floorHeight);
  const up = walk(sx, sy, -snx, -sny, 60, true);
  const no = walk(sx, sy, -snx, -sny, 60, false);
  console.log(`Degrau de ${Math.abs(map.sectors[step.front].floorHeight - map.sectors[step.back].floorHeight)} unidades (linha ${step.index}): noclip z ${up.z}, sem noclip z ${no.z}`);
  check(up.z === high && no.z < high, 'noclip sobe o degrau alto; sem noclip, bloqueado');
  console.warn = quiet;
}

// --- h) Créditos ---
{
  const assets = loadMenuAssets(wad);
  const { HELP } = MENU_LAYOUT;
  for (const lang of ['en', 'pt']) {
    creditsPages(MENU_TEXT[lang]).forEach((_, page) => {
      const report = [];
      composeMenu({ lang, screen: 'credits', helpPage: page, selected: 0, started: true, resumeFailed: false, values: {} }, assets, 0, report);
      check(report.every((r) => r.width <= 320 && r.right <= 320 && r.x >= 0), `${lang} créditos página ${page + 1}: linhas de até 320`);
      check(report.filter((r) => r.y < HELP.footerY).every((r) => r.bottom <= 180), `${lang} créditos página ${page + 1}: até y = 180`);
    });
  }
  const text = MENU_TEXT.en.creditsPages.flat().join(' ');
  check(['TIMOTHY LOTTES', 'BSD-3-CLAUSE', 'VER CREDITS.MD', 'FREEDOOM'].every((t) => text.includes(t)), 'créditos com as atribuições de CREDITS.md e SOURCE.txt');
}

// --- i) Levantamento ---
{
  const script = fileURLToPath(new URL('./survey-maps.mjs', import.meta.url));
  const r = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  check(r.status === 0 && r.stdout.includes('Ranking'), `survey-maps.mjs roda e imprime o ranking (código ${r.status})`);
}

console.log(failures ? `${failures} falha(s)` : 'Tudo certo');
process.exit(failures ? 1 : 0);
