// Verificação da física do modo "andar", sem navegador. Uso: node tools/check-collision.mjs
// Sai com código diferente de zero se algo falhar.

import fs from 'node:fs';
import { WadFile } from '../src/wad/WadFile.js';
import { loadMap } from '../src/wad/MapData.js';
import { findSector } from '../src/map/bsp.js';
import { buildCollisionLines } from '../src/physics/collisionData.js';
import {
  PLAYER_RADIUS, PLAYER_HEIGHT, STEP_HEIGHT, GRAVITY, closestPointOnSegment, lineBlocks, pushOut,
  createPlayerState, stepPlayer, updateSector, isInsideMap, enterWalk,
} from '../src/physics/collision.js';
import { buildFlats } from '../src/map/buildFlats.js';
import { BASE_FLY_SPEED, RUN_MULT } from '../src/camera.js';

let failures = 0;
const check = (cond, label) => {
  if (!cond) { failures++; console.log(`FALHA: ${label}`); }
  return cond;
};
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const line = (x1, y1, x2, y2, extra = {}) => ({
  x1, y1, x2, y2, minX: Math.min(x1, x2), maxX: Math.max(x1, x2), minY: Math.min(y1, y2), maxY: Math.max(y1, y2),
  front: 0, back: -1, oneSided: true, flags: 0, ...extra,
});

// --- a) Ponto mais próximo no segmento ---
const seg = line(0, 0, 100, 0);
let p = closestPointOnSegment(-30, 40, seg);
check(near(p.x, 0) && near(p.y, 0) && near(p.d, 50), 'antes do início: ponto = início, d = 50');
p = closestPointOnSegment(40, -7, seg);
check(near(p.x, 40) && near(p.y, 0) && near(p.d, 7), 'no meio: projeção, d = 7');
p = closestPointOnSegment(130, 40, seg);
check(near(p.x, 100) && near(p.y, 0) && near(p.d, 50), 'depois do fim: ponto = fim, d = 50');

// --- b) Empurrão e deslizamento numa parede horizontal (mundo sintético, sala grande) ---
const synthSectors = [{ floorHeight: 0, ceilingHeight: 128 }, { floorHeight: 0, ceilingHeight: 128 }];
const wall = line(-1000, 0, 1000, 0);
const synthWorld = { lines: [wall], sectors: synthSectors };
const st = { x: 0, y: 5, z: 0 };
pushOut(st, synthWorld, 0, 20);
check(closestPointOnSegment(st.x, st.y, wall).d >= PLAYER_RADIUS, `empurrão: distância ${closestPointOnSegment(st.x, st.y, wall).d.toFixed(3)} >= raio`);
const onLine = { x: 10, y: 0, z: 0 };
pushOut(onLine, synthWorld, 10, 3);
check(onLine.y >= PLAYER_RADIUS && near(onLine.x, 10), 'sobre a linha: sai pela normal, do lado anterior');
// Andar na diagonal contra a parede (centro em y = 16.01, vindo de cima): x avança, y fica no raio.
const slide = { x: 0, y: PLAYER_RADIUS + 0.5, z: 0 };
for (let i = 0; i < 20; i++) {
  const px = slide.x, py = slide.y;
  slide.x += 4; slide.y -= 4; // diagonal 45° rumo à parede
  pushOut(slide, synthWorld, px, py);
}
check(near(slide.x, 80, 1e-6), `desliza: componente paralelo mantido (x = ${slide.x})`);
check(slide.y >= PLAYER_RADIUS && slide.y < PLAYER_RADIUS + 0.02, `componente perpendicular anulado (y = ${slide.y.toFixed(3)})`);

// --- c) Tabela de bloqueio com dados sintéticos ---
const two = (front, back, extra = {}) => ({ ...line(0, 0, 100, 0), oneSided: false, back: 1, ...extra, _s: [front, back] });
const blocks = (l, feet) => lineBlocks(l, l._s ?? synthSectors, feet);
const S = (floorHeight, ceilingHeight) => ({ floorHeight, ceilingHeight });
check(blocks(line(0, 0, 1, 0), 0) === true, 'um lado só bloqueia');
check(blocks(two(S(0, 128), S(0, 128), { flags: 1 }), 0) === true, 'flag 0x0001 bloqueia');
check(blocks(two(S(0, 128), S(0, 128)), 0) === false, 'abertura livre passa');
check(blocks(two(S(0, 200), S(24, 200)), 0) === false, 'degrau de 24 passa');
check(blocks(two(S(0, 200), S(25, 200)), 0) === true, 'degrau de 25 bloqueia');
check(blocks(two(S(0, 55), S(0, 128)), 0) === true, 'abertura de 55 bloqueia');
check(blocks(two(S(0, 56), S(0, 128)), 0) === false, 'abertura de 56 passa');
check(blocks(two(S(0, 128), S(40, 128)), 30) === false, 'degrau de 10 acima dos pés passa');
check(blocks(two(S(0, 70), S(0, 128)), 20) === true, 'teto a 50 acima dos pés bloqueia');
check(blocks(two(S(100, 200), S(0, 200)), 100) === false, 'descida de 100 não bloqueia');
check(blocks(two(S(0, 0), S(0, 128)), 0) === true, 'porta fechada (teto = chão) bloqueia');
const ledge = two(S(0, 200), S(40, 200));
check(blocks(ledge, 0) === true && blocks(ledge, 16) === false && blocks(ledge, 40) === false, 'mesma linha, feetZ diferentes: coerente');

// --- Mapa real ---
const bytes = fs.readFileSync(new URL('../assets/freedoom1.wad', import.meta.url));
const wad = new WadFile(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const map = loadMap(wad, 'E1M1');
const spawn = map.things.find((t) => t.type === 1);
const world = { map, lines: buildCollisionLines(map), sectors: map.sectors, spawn: { x: spawn.x, y: spawn.y } };
const oneSided = world.lines.filter((l) => l.oneSided);
console.log(`E1M1: ${world.lines.length} linhas de colisão (${oneSided.length} de um lado só)`);

// --- Dentro / fora do mapa (usado ao trocar de voar para andar) ---
const flats = buildFlats(map);
let centroidsOutside = 0;
for (const info of flats.subsectorInfo) {
  if (!info) continue;
  const n = info.polygon.length;
  const cx = info.polygon.reduce((a, q) => a + q[0], 0) / n, cy = info.polygon.reduce((a, q) => a + q[1], 0) / n;
  if (!isInsideMap(map, cx, cy)) centroidsOutside++;
}
check(centroidsOutside === 0, `${centroidsOutside} centróides de subsector considerados fora do mapa`);
check(isInsideMap(map, spawn.x, spawn.y), 'ponto de início dentro do mapa');
check(!isInsideMap(map, 100000, 100000), 'ponto distante fora do mapa');
const far = enterWalk(world, 100000, 100000, 50);
check(far.x === spawn.x && far.y === spawn.y && far.z === far.floorz, 'entrar no modo andar fora do mapa: vai ao início');
const high = enterWalk(world, spawn.x, spawn.y, 300);
check(high.z === 300 - 41 && high.vz === 0, 'entrar no modo andar no alto: pés = olho - 41, cai depois');

// --- d) Gravidade: de floorz + 100 até pousar ---
const fall = createPlayerState(world, spawn.x, spawn.y);
const floor0 = fall.floorz;
fall.z = floor0 + 100;
let t = 0;
const dtFall = 1 / 60;
while (fall.z > floor0 && t < 2) { stepPlayer(fall, { vx: 0, vy: 0 }, dtFall, world); t += dtFall; }
console.log(`Queda de 100 unidades: ${t.toFixed(3)} s (analítico ${Math.sqrt(200 / GRAVITY).toFixed(3)} s)`);
check(t >= 0.38 && t <= 0.43, `tempo de queda ${t.toFixed(3)} s fora de [0.38, 0.43]`);
check(fall.z === floor0 && fall.vz === 0, 'pousou: z = floorz, vz = 0');

// --- e) 72 direções a partir do início, correndo, com dt = 1/60 e dt = 0.1 ---
function segmentsCross(ax, ay, bx, by, l) {
  const d = (px, py, qx, qy, rx, ry) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
  const d1 = d(l.x1, l.y1, l.x2, l.y2, ax, ay), d2 = d(l.x1, l.y1, l.x2, l.y2, bx, by);
  const d3 = d(ax, ay, bx, by, l.x1, l.y1), d4 = d(ax, ay, bx, by, l.x2, l.y2);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
const runSpeed = BASE_FLY_SPEED * RUN_MULT;
for (const dt of [1 / 60, 0.1]) {
  const visited = new Set();
  let crossings = 0, nan = 0, squeezed = 0, notGrounded = 0, outside = 0;
  for (let k = 0; k < 72; k++) {
    const ang = (k * 5) * Math.PI / 180;
    const wish = { vx: Math.cos(ang) * runSpeed, vy: Math.sin(ang) * runSpeed };
    const s = createPlayerState(world, spawn.x, spawn.y);
    for (let time = 0; time < 3; time += dt) {
      const ax = s.x, ay = s.y;
      stepPlayer(s, wish, dt, world);
      if (![s.x, s.y, s.z, s.vz].every(Number.isFinite)) nan++;
      for (const l of oneSided) {
        if (Math.max(ax, s.x) < l.minX || Math.min(ax, s.x) > l.maxX || Math.max(ay, s.y) < l.minY || Math.min(ay, s.y) > l.maxY) continue;
        if (segmentsCross(ax, ay, s.x, s.y, l)) crossings++;
      }
      const si = findSector(map, s.x, s.y);
      visited.add(si);
      const sec = map.sectors[si];
      if (!sec || sec.ceilingHeight - sec.floorHeight < PLAYER_HEIGHT) squeezed++;
      if (!isInsideMap(map, s.x, s.y)) outside++;
    }
    if (!(s.z === s.floorz || s.vz < 0)) notGrounded++;
  }
  console.log(`dt = ${dt.toFixed(4)}: ${visited.size} setores visitados; cruzamentos ${crossings}, NaN ${nan}, ` +
    `setor espremido ${squeezed}, fim fora do chão ${notGrounded}, fora do mapa ${outside}`);
  check(crossings === 0 && nan === 0 && squeezed === 0 && notGrounded === 0 && outside === 0, `varredura com dt = ${dt}`);
}

// --- f) Degraus reais: atravessar um de até 24 e ser bloqueado por um de 25 a 127 ---
// Escolha do caso só pela geometria (não pelo resultado): linha de dois lados com 64+ de comprimento,
// sem flag de bloqueio, abertura >= 56, e pontos a 40 unidades de cada lado dentro dos setores certos.
function findStepCase(minDiff, maxDiff) {
  for (const l of world.lines) {
    if (l.oneSided || (l.flags & 1)) continue;
    const f = map.sectors[l.front], b = map.sectors[l.back];
    const diff = Math.abs(f.floorHeight - b.floorHeight);
    if (diff < minDiff || diff > maxDiff) continue;
    if (Math.min(f.ceilingHeight, b.ceilingHeight) - Math.max(f.floorHeight, b.floorHeight) < PLAYER_HEIGHT) continue;
    const len = Math.hypot(l.x2 - l.x1, l.y2 - l.y1);
    if (len < 64) continue;
    const [lowIdx, highIdx] = f.floorHeight < b.floorHeight ? [l.front, l.back] : [l.back, l.front];
    // Normal do lado direito (frente): (dy, -dx).
    const nx = (l.y2 - l.y1) / len, ny = -(l.x2 - l.x1) / len;
    const mx = (l.x1 + l.x2) / 2, my = (l.y1 + l.y2) / 2;
    const lowSign = lowIdx === l.front ? 1 : -1;
    const start = { x: mx + nx * 40 * lowSign, y: my + ny * 40 * lowSign };
    const end = { x: mx - nx * 40 * lowSign, y: my - ny * 40 * lowSign };
    if (findSector(map, start.x, start.y) !== lowIdx || findSector(map, end.x, end.y) !== highIdx) continue;
    const s = createPlayerState(world, start.x, start.y);
    if (pushOut({ ...s }, world, s.x, s.y)) continue; // o ponto de partida precisa estar livre
    return { line: l, diff, start, end, lowIdx, highIdx, dir: { x: -nx * lowSign, y: -ny * lowSign } };
  }
  return null;
}
function walkAcross(c) {
  const s = createPlayerState(world, c.start.x, c.start.y);
  const wish = { vx: c.dir.x * BASE_FLY_SPEED, vy: c.dir.y * BASE_FLY_SPEED };
  for (let time = 0; time < 0.5; time += 1 / 60) stepPlayer(s, wish, 1 / 60, world);
  updateSector(s, world);
  return { s, sector: findSector(map, s.x, s.y) };
}
const up = findStepCase(1, STEP_HEIGHT);
if (!up) console.log('Aviso: caso não encontrado (degrau de 1 a 24)');
else {
  const { s, sector } = walkAcross(up);
  const high = map.sectors[up.highIdx].floorHeight;
  console.log(`Degrau de ${up.diff} (linha ${up.line.index}): terminou no setor ${sector}, z = ${s.z}, chão alto ${high}`);
  check(sector === up.highIdx && s.z === high, 'degrau baixo: atravessa e sobe para o novo chão');
}
const tall = findStepCase(STEP_HEIGHT + 1, 127);
if (!tall) console.log('Aviso: caso não encontrado (degrau de 25 a 127)');
else {
  const { s, sector } = walkAcross(tall);
  console.log(`Degrau de ${tall.diff} (linha ${tall.line.index}): terminou no setor ${sector}, z = ${s.z}`);
  check(sector === tall.lowIdx && s.z === map.sectors[tall.lowIdx].floorHeight, 'degrau alto: bloqueia');
}

console.log(failures ? `${failures} falha(s)` : 'Tudo certo');
process.exit(failures ? 1 : 0);
