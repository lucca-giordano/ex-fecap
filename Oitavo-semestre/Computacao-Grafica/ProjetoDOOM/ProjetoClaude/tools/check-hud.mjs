// Verificação da camada de interface e da pistola, sem navegador. Uso: node tools/check-hud.mjs
// Sai com código diferente de zero se algo falhar.

import fs from 'node:fs';
import { WadFile } from '../src/wad/WadFile.js';
import { PlayerStats, MAX_HEALTH, MAX_ARMOR, MAX_CLIP, INITIAL_CLIP } from '../src/game/PlayerStats.js';
import {
  createPistol, startRaise, tickPistol, updateSwayAmplitude, readyPose, weaponTopLeft, weaponLightLevel,
  WEAPONTOP, WEAPONBOTTOM, RAISESPEED, READY_SX, SWAY_MAX, SWAY_PERIOD, WEAPON_Y_ADJUST,
} from '../src/game/pistol.js';
import { requestWeapon } from '../src/game/weapons.js';
import { loadHudAssets } from '../src/hud/HudAssets.js';
import { composeHud, painLevel, faceLumpName, faceLookAt, BAR_Y, HUD_WIDTH, HUD_HEIGHT } from '../src/hud/HudRenderer.js';

let failures = 0;
const check = (cond, label) => {
  if (!cond) { failures++; console.log(`FALHA: ${label}`); }
  return cond;
};
const isInt = (v) => Number.isInteger(v);

// --- PlayerStats: limites e inteiros ---
const s = new PlayerStats();
check(s.health === 100 && s.armor === 0 && s.ammoClip === INITIAL_CLIP && s.weaponsOwned.has(2) && Object.values(s.keys).every((v) => !v), 'estado inicial');
s.addHealth(500); check(s.health === MAX_HEALTH, 'vida limitada a 200');
s.addHealth(-1000); check(s.health === 0 && s.isDead, 'vida limitada a 0 (morto)');
s.addArmor(37.9); check(s.armor === 37 && isInt(s.armor), 'armadura inteira');
s.addArmor(1000); check(s.armor === MAX_ARMOR, 'armadura limitada a 200');
s.addAmmo(10000); check(s.ammoClip === MAX_CLIP, 'munição limitada a 200');
s.ammoClip = 0; check(s.spendAmmo(1) === false && s.ammoClip === 0, 'sem munição não gasta');
s.addAmmo(2.5); check(s.ammoClip === 2 && isInt(s.ammoClip), 'munição inteira');
s.reset(); check(s.health === 100 && s.armor === 0 && s.ammoClip === 50, 'reset');

// --- Máquina de estados ---
let tic = 0;
const run = (p, stats, fire, n) => { for (let i = 0; i < n; i++) tickPistol(p, { fire }, stats, ++tic); };
const p = createPistol('ABCD');
const st = new PlayerStats();
let raiseTics = 0;
while (p.state === 'raise' && raiseTics < 100) { run(p, st, true, 1); raiseTics++; }
const expectedRaise = Math.ceil((WEAPONBOTTOM - WEAPONTOP) / RAISESPEED);
check(raiseTics === expectedRaise && p.sy === WEAPONTOP, `levantar: ${raiseTics} tics (esperado ${expectedRaise}), sem disparar`);
check(st.ammoClip === 50, 'não dispara enquanto levanta');

// Um disparo completo: aperta por 1 tic e solta.
let fireTics = 0;
run(p, st, true, 1);
fireTics++;
while (p.state === 'fire' && fireTics < 100) { run(p, st, false, 1); fireTics++; }
check(fireTics === 20 && p.state === 'ready', `disparo completo: ${fireTics - 1} tics em disparo (esperado 19)`);
check(st.ammoClip === 49, 'um disparo gasta 1 bala');

// Segurando: reinicia no fim e gasta mais 1; solta e volta para pronta.
run(p, st, true, 19);
check(p.state === 'fire' && st.ammoClip === 48 && p.refire === 0, 'primeiro tiro segurando (refire 0)');
run(p, st, true, 1);
check(p.state === 'fire' && p.fireIndex === 0 && st.ammoClip === 47 && p.refire === 1, 'segurando: reinicia, gasta mais 1, refire 1');
run(p, st, false, 19);
check(p.state === 'ready' && st.ammoClip === 47 && p.refire === 0, 'soltou: volta para pronta (refire 0)');

// Sem munição: não dispara e (etapa 17) troca para o soco: 16 tics descendo e 16 subindo.
st.ammoClip = 0;
run(p, st, true, 1);
check(p.state === 'lower' && p.pending === 1 && st.ammoClip === 0, 'sem munição não dispara e desce para trocar');
run(p, st, false, 32); // o tic da detecção não conta: 16 descendo + 16 subindo
check(p.state === 'ready' && p.current === 1 && st.ammoClip === 0, 'sem munição: soco na mão depois de 32 tics');

// Clarão: 7 tics a partir do início do disparo (volta para a pistola antes).
st.ammoClip = 10;
check(requestWeapon(p, 2, st), 'pedido de volta à pistola aceito');
run(p, st, false, 32);
check(p.state === 'ready' && p.current === 2, 'pistola de volta');
run(p, st, true, 1);
let flashTics = 0;
while (p.flashTics > 0) { flashTics++; run(p, st, false, 1); }
check(flashTics === 7, `clarão de ${flashTics} tics (esperado 7)`);
run(p, st, false, 40);

// sx e sy congelados durante o disparo.
p.amplitude = SWAY_MAX;
run(p, st, false, 5);
const frozen = { sx: p.sx, sy: p.sy };
run(p, st, true, 1);
run(p, st, false, 10);
check(p.state === 'fire' && p.sx === frozen.sx && p.sy === frozen.sy, 'pose congelada durante o disparo');

// NEW GAME: volta a levantar.
startRaise(p);
check(p.state === 'raise' && p.sy === WEAPONBOTTOM, 'startRaise');

// --- Balanço ---
const q = createPistol();
updateSwayAmplitude(q, 0, 300, true, 1);
check(q.amplitude === 0 && readyPose(0, 17).sx === READY_SX && readyPose(0, 17).sy === WEAPONTOP, 'parado: amplitude zero');
for (let i = 0; i < 120; i++) updateSwayAmplitude(q, 600, 300, true, 1 / 60);
check(Math.abs(q.amplitude - SWAY_MAX) < 0.01, `correndo: amplitude ${q.amplitude.toFixed(3)} ~ ${SWAY_MAX}`);
updateSwayAmplitude(q, 600, 300, true, 1 / 60);
const before = q.amplitude;
updateSwayAmplitude(q, 0, 300, true, 1 / 60);
check(q.amplitude < before && q.amplitude > before * 0.8, 'parar: decai suavemente');
for (let i = 0; i < 300; i++) updateSwayAmplitude(q, 600, 300, false, 1 / 60);
check(q.amplitude < 0.01, 'no ar ou voando: amplitude vai a zero');
let periodic = true, nonNegative = true;
for (let t = 0; t < 200; t++) {
  const a = readyPose(SWAY_MAX, t), b = readyPose(SWAY_MAX, t + SWAY_PERIOD);
  if (Math.abs(a.sx - b.sx) > 1e-9 || Math.abs(a.sy - b.sy) > 1e-9) periodic = false;
  if (a.sy - WEAPONTOP < 0) nonNegative = false;
}
check(periodic, 'balanço com período de 64 tics');
check(nonNegative, 'sy - 32 nunca negativo');
check(weaponLightLevel(15, true) === 0 && weaponLightLevel(0, true) === 31 && weaponLightLevel(8, true) === 5 &&
  weaponLightLevel(0, false) === 0, 'nível de luz da arma');

// --- Rosto ---
const painCases = [[100, 0], [80, 0], [79, 1], [60, 1], [59, 2], [40, 2], [39, 3], [20, 3], [19, 4], [1, 4], [150, 0]];
for (const [h, expected] of painCases) check(painLevel(h) === expected, `dor com vida ${h}: ${painLevel(h)} (esperado ${expected})`);
let front = 0;
const looks = new Set();
for (let t = 0; t < 20000; t++) { const l = faceLookAt(t); looks.add(l); if (l === 1) front++; }
check(front / 20000 > 0.75 && looks.has(0) && looks.has(2), `olhar: ${(100 * front / 20000).toFixed(1)}% de frente, vê 0 e 2`);
check(faceLookAt(5000) === faceLookAt(5000), 'olhar determinístico');

// --- Assets e composição ---
const bytes = fs.readFileSync(new URL('../assets/freedoom1.wad', import.meta.url));
const wad = new WadFile(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const assets = loadHudAssets(wad);
check(assets.ok, `lumps obrigatórios: faltam ${assets.fatal.join(', ')}`);
console.log(`Lumps ausentes: ${assets.missing.join(', ') || 'nenhum'}; quadros da pistola: ${assets.pistolFrames}`);
check(faceLumpName(0, 1, assets.patches) === 'STFDEAD0' && faceLumpName(100, 1, assets.patches) === 'STFST01' &&
  faceLumpName(10, 2, assets.patches) === 'STFST42', 'lumps do rosto por vida');

const digitW = assets.patches.STTNUM0.width;
const cases = [[100, 50, 0], [50, 5, 100], [20, 0, 0], [0, 200, 200]];
for (const [health, ammo, armor] of cases) {
  const stats = new PlayerStats();
  stats.health = health; stats.ammoClip = ammo; stats.armor = armor;
  const report = [];
  const rgba = composeHud({ stats, weapon: { frame: 'A', sx: READY_SX, sy: WEAPONTOP, flash: false }, weaponLevel: 0 }, assets, 0, report);
  check(rgba.length === HUD_WIDTH * HUD_HEIGHT * 4, 'tamanho da camada');
  let opaque = 0, barOpaque = true, aboveBar = 0;
  for (let y = 0; y < HUD_HEIGHT; y++) {
    for (let x = 0; x < HUD_WIDTH; x++) {
      const a = rgba[(y * HUD_WIDTH + x) * 4 + 3];
      if (a) { opaque++; if (y < BAR_Y) aboveBar++; }
      if (y >= BAR_Y && !a) barOpaque = false;
    }
  }
  check(opaque > 0 && barOpaque, `vida ${health}: barra opaca nas linhas 168 a 199`);
  check(aboveBar > 0, `vida ${health}: pistola visível acima da barra`);
  for (const r of report) {
    check(r.x >= 0 && r.y >= 0 && r.x + r.w <= HUD_WIDTH && (r.y + r.h <= HUD_HEIGHT || r.name.startsWith('PIS')),
      `${r.name} dentro da camada (${r.x}, ${r.y}, ${r.w}x${r.h})`);
    if (r.field) {
      const w = r.name.startsWith('ammoTable') ? assets.patches.STYSNUM0.width : digitW;
      check(r.x + r.w === r.field.right && r.x >= r.field.right - r.field.digits * w, `${r.name}: alinhado à direita no campo`);
    }
  }
  const zero = report.find((r) => r.name === 'armor');
  if (armor === 0) check(zero.w === digitW, 'valor 0 mostra um único "0"');
  const hp = report.find((r) => r.name === 'health');
  check(hp.w === String(health).length * digitW, `vida ${health}: ${String(health).length} dígitos, sem zeros à esquerda`);
}

// --- Posição da pistola em repouso ---
const gun = assets.sprites.PISGA0;
const pos = weaponTopLeft(gun, READY_SX, WEAPONTOP);
const expected = { x: Math.round(READY_SX - gun.leftOffset), y: Math.floor(WEAPONTOP - gun.topOffset - WEAPON_Y_ADJUST) };
check(pos.x === expected.x && pos.y === expected.y, `PISGA0 em repouso: (${pos.x}, ${pos.y}) pela regra`);
check(pos.y + gun.height >= BAR_Y, `base da pistola em y = ${pos.y + gun.height} alcança a barra (168)`);
console.log(`PISGA0 em repouso: coluna ${pos.x}, linha ${pos.y}, base em ${pos.y + gun.height} (barra em ${BAR_Y})`);

console.log(failures ? `${failures} falha(s)` : 'Tudo certo');
process.exit(failures ? 1 : 0);
