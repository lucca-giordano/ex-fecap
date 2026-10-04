// Verificação do som sem navegador (sem Web Audio). Uso: node tools/check-audio.mjs
// Sai com código diferente de zero se algo falhar.

import fs from 'node:fs';
import { WadFile } from '../src/wad/WadFile.js';
import { loadMap } from '../src/wad/MapData.js';
import { findSector } from '../src/map/bsp.js';
import { decodeDmx, loadSounds } from '../src/audio/dmx.js';
import { aproxDist, distanceVolume, panFor, masterGain, adjustSoundParams } from '../src/audio/soundMath.js';
import { ChannelManager, MAX_CHANNELS } from '../src/audio/channels.js';
import { buildCollisionLines } from '../src/physics/collisionData.js';
import { createPlayerState, stepPlayer, STEP_HEIGHT, PLAYER_HEIGHT } from '../src/physics/collision.js';
import { createPistol, tickPistol } from '../src/game/pistol.js';
import { PlayerStats } from '../src/game/PlayerStats.js';

let failures = 0;
const check = (cond, label) => {
  if (!cond) { failures++; console.log(`FALHA: ${label}`); }
  return cond;
};
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const OOF_IMPACT_SPEED = 8 * 35; // o mesmo limite do main.js (P_ZMovement do Doom)

// --- a) Parser DMX com lumps sintéticos ---
function dmx({ format = 3, rate = 11025, n, body, extra = 0, cut = 0 }) {
  const size = 8 + n + extra - cut;
  const bytes = new Uint8Array(Math.max(0, size));
  const v = new DataView(bytes.buffer);
  if (size >= 8) { v.setUint16(0, format, true); v.setUint16(2, rate, true); v.setUint32(4, n, true); }
  for (let i = 8; i < size; i++) bytes[i] = 99; // preenchimento
  body?.forEach((b, i) => { if (8 + 16 + i < size) bytes[8 + 16 + i] = b; });
  return bytes;
}
const real = [128, 0, 255, 64];
let r = decodeDmx(dmx({ n: 32 + real.length, body: real }));
check(r.ok && r.samples.length === real.length, 'N - 32 amostras reais (preenchimento removido)');
check(r.ok && r.samples[0] === 0 && r.samples[1] === -1 && r.samples[2] === 0.9921875 && r.samples[3] === -0.5, 'conversão 8 bits -> [-1, 1)');
check(r.ok && near(r.duration, real.length / 11025) && r.rate === 11025, 'duração = (N - 32) / taxa');
r = decodeDmx(dmx({ n: 32 + real.length, body: real, extra: 10 }));
check(r.ok && r.samples.length === real.length, 'bytes extras no fim aceitos');
const bad = [
  ['formato 2', dmx({ format: 2, n: 40 })],
  ['N = 32', dmx({ n: 32 })],
  ['N = 10', dmx({ n: 10 })],
  ['taxa 7000', dmx({ rate: 7000, n: 40 })],
  // A taxa é uint16 (máximo 65535), então o limite de 96000 nunca é atingido pelo cabeçalho.
  ['taxa 4000', dmx({ rate: 4000, n: 40 })],
  ['lump curto', dmx({ n: 40, cut: 1 })],
  ['menos de 8 bytes', new Uint8Array(5)],
];
for (const [label, bytes] of bad) check(!decodeDmx(bytes).ok, `inválido rejeitado: ${label}`);

// --- b) Todos os DS* do freedoom1.wad ---
const bytes = fs.readFileSync(new URL('../assets/freedoom1.wad', import.meta.url));
const wad = new WadFile(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const { sounds, invalid } = loadSounds(wad, () => {});
console.log(`Sons DS*: ${sounds.size} válidos, ${invalid.length} inválidos` +
  (invalid.length ? ` (${invalid.map((i) => `${i.lump}: ${i.reason}`).join('; ')})` : ''));
for (const name of ['pistol', 'swtchn', 'swtchx', 'pstop', 'stnmov', 'oof']) {
  const s = sounds.get(name);
  if (check(Boolean(s), `som usado na etapa ausente: ${name}`)) {
    console.log(`  ${name}: ${s.rate} Hz, ${s.samples.length} amostras, ${s.duration.toFixed(3)} s`);
  }
}
check([...sounds.values()].every((s) => s.samples.every((x) => x >= -1 && x < 1)), 'todas as amostras em [-1, 1)');

// --- c) Volume por distância ---
check(distanceVolume(1201) === 0 && distanceVolume(5000) === 0, 'acima de 1200: não toca');
check(distanceVolume(0) === 1 && distanceVolume(200) === 1, 'até 200: volume 1');
check(near(distanceVolume(700), 0.5) && near(distanceVolume(950), 0.25), '700 -> 0.5, 950 -> 0.25');
check(aproxDist(300, 400) === 550 && aproxDist(-300, 400) === 550, 'aproxDist(300, 400) = 550');

// --- d) Pan ---
const east = { x: 0, y: 0, angleDeg: 0 };
const at = (deg, d = 100) => ({ x: Math.cos(deg * Math.PI / 180) * d, y: Math.sin(deg * Math.PI / 180) * d });
check(near(panFor(east, at(90)), -0.75), 'fonte à esquerda (ang +90): -0.75');
check(near(panFor(east, at(-90)), 0.75), 'fonte à direita (ang -90): +0.75');
check(near(panFor(east, at(0)), 0) && near(panFor(east, at(180)), 0), 'na frente e atrás: 0');
check(panFor(east, { x: 0, y: 0 }) === 0, 'mesma posição: 0');
const north = { x: 0, y: 0, angleDeg: 90 };
check(panFor(north, { x: -100, y: 0 }) < 0 && panFor(north, { x: 100, y: 0 }) > 0, 'olhando para o norte: oeste à esquerda, leste à direita');
const noPos = adjustSoundParams(east, null);
check(noPos.volume === 1 && noPos.pan === 0 && noPos.audible, 'som sem posição: volume 1, pan 0');

// --- e) Volume mestre ---
check(masterGain(0, false) === 0 && near(masterGain(15, false), 120 / 127) && masterGain(15, true) === 0, 'gainMestre');

// --- f) Canais ---
const ch = new ChannelManager(MAX_CHANNELS);
const a = ch.alloc('player');
const b = ch.alloc('player');
check(a.stop === -1 && b.index === a.index && b.stop === a.index, 'mesma origem substitui o canal anterior');
const m1 = ch.alloc(''), m2 = ch.alloc(null);
check(m1.stop === -1 && m2.stop === -1 && m1.index !== m2.index && m1.index !== a.index, 'origem vazia nunca substitui');
for (let i = 0; i < 5; i++) ch.alloc(`monstro${i}`);
check(ch.active === 8, '8 canais ocupados');
const ninth = ch.alloc('outro');
check(ninth.stop === a.index && ninth.index === a.index, 'o 9º rouba o mais antigo');
ch.release(m1.index);
check(ch.active === 7 && ch.alloc('novo').index === m1.index, 'liberar devolve o canal');

// --- g) Eventos da física e da pistola ---
const map = loadMap(wad, 'E1M1');
const spawn = map.things.find((t) => t.type === 1);
const world = { map, lines: buildCollisionLines(map), sectors: map.sectors, spawn: { x: spawn.x, y: spawn.y } };
function dropFrom(height) {
  const s = createPlayerState(world, spawn.x, spawn.y);
  s.z = s.floorz + height;
  const events = [];
  for (let t = 0; t < 2; t += 1 / 60) events.push(...stepPlayer(s, { vx: 0, vy: 0 }, 1 / 60, world));
  return events.filter((e) => e.type === 'landed');
}
const d30 = dropFrom(30), d40 = dropFrom(40);
console.log(`Queda de 30: impacto ${d30[0]?.impactSpeed.toFixed(1)} u/s; queda de 40: ${d40[0]?.impactSpeed.toFixed(1)} u/s (limite ${OOF_IMPACT_SPEED})`);
check(d30.length === 1 && d30[0].impactSpeed <= OOF_IMPACT_SPEED, 'queda de 30: sem "oof"');
check(d40.length === 1 && d40[0].impactSpeed > OOF_IMPACT_SPEED, 'queda de 40: com "oof"');

// Degrau real de até 24: subir não gera evento; descer gera "landed" abaixo do limite.
function stepCase() {
  for (const l of world.lines) {
    if (l.oneSided || (l.flags & 1)) continue;
    const f = map.sectors[l.front], bk = map.sectors[l.back];
    const diff = Math.abs(f.floorHeight - bk.floorHeight);
    if (diff < 1 || diff > STEP_HEIGHT) continue;
    if (Math.min(f.ceilingHeight, bk.ceilingHeight) - Math.max(f.floorHeight, bk.floorHeight) < PLAYER_HEIGHT) continue;
    const len = Math.hypot(l.x2 - l.x1, l.y2 - l.y1);
    if (len < 64) continue;
    const lowIdx = f.floorHeight < bk.floorHeight ? l.front : l.back;
    const highIdx = lowIdx === l.front ? l.back : l.front;
    const nx = (l.y2 - l.y1) / len, ny = -(l.x2 - l.x1) / len, sign = lowIdx === l.front ? 1 : -1;
    const mx = (l.x1 + l.x2) / 2, my = (l.y1 + l.y2) / 2;
    const low = { x: mx + nx * 40 * sign, y: my + ny * 40 * sign }, high = { x: mx - nx * 40 * sign, y: my - ny * 40 * sign };
    if (findSector(map, low.x, low.y) === lowIdx && findSector(map, high.x, high.y) === highIdx) {
      return { diff, low, high, dir: { x: -nx * sign, y: -ny * sign } };
    }
  }
  return null;
}
const sc = stepCase();
if (!sc) console.log('Aviso: caso de degrau não encontrado');
else {
  // Anda 80 unidades (de 40 antes da linha até 40 depois) e para até pousar: só aquele degrau.
  const walk = (from, dir) => {
    const s = createPlayerState(world, from.x, from.y);
    const events = [];
    for (let t = 0; t < 80 / 300; t += 1 / 60) events.push(...stepPlayer(s, { vx: dir.x * 300, vy: dir.y * 300 }, 1 / 60, world));
    for (let t = 0; t < 1; t += 1 / 60) events.push(...stepPlayer(s, { vx: 0, vy: 0 }, 1 / 60, world));
    return events.filter((e) => e.type === 'landed');
  };
  const up = walk(sc.low, sc.dir);
  const down = walk(sc.high, { x: -sc.dir.x, y: -sc.dir.y });
  console.log(`Degrau de ${sc.diff}: subindo ${up.length} evento(s); descendo ${down.length} evento(s)` +
    (down.length ? `, impacto ${down[0].impactSpeed.toFixed(1)} u/s` : ''));
  check(up.length === 0, 'subir degrau não gera evento');
  check(down.every((e) => e.impactSpeed <= OOF_IMPACT_SPEED), 'descer degrau de até 24: sem "oof"');
}

// Pistola: um evento "fire" por tiro.
let tic = 0;
const fires = (p, st, fire, n) => {
  let count = 0;
  for (let i = 0; i < n; i++) count += tickPistol(p, { fire }, st, ++tic).filter((e) => e.type === 'fire').length;
  return count;
};
const p = createPistol('ABCD');
const st = new PlayerStats();
fires(p, st, false, 20); // levantar
check(fires(p, st, true, 1) + fires(p, st, false, 25) === 1 && st.ammoClip === 49, 'disparo completo: exatamente um "fire"');
check(fires(p, st, true, 19) + fires(p, st, true, 1) === 2 && st.ammoClip === 47, 'disparo contínuo de 2 tiros: dois "fire"');
// Etapa 15: o evento traz refire (0 no primeiro disparo, 1, 2... nos contínuos).
fires(p, st, false, 25);
const refires = [];
// 40 tics segurando: disparos nos tics 1, 20 e 39 (19 tics por disparo).
for (let i = 0; i < 40; i++) for (const e of tickPistol(p, { fire: true }, st, ++tic)) if (e.type === 'fire') refires.push(e.refire);
check(refires.join() === '0,1,2', `refire em 3 disparos contínuos: ${refires.join()}`);
fires(p, st, false, 25);
st.ammoClip = 0;
check(fires(p, st, true, 30) === 0, 'sem munição: nenhum "fire"');

console.log(failures ? `${failures} falha(s)` : 'Tudo certo');
process.exit(failures ? 1 : 0);
