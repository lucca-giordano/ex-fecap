// Verificação das armas, da troca de arma, das teclas e da tela de ajuda, sem navegador.
// Uso: node tools/check-weapons.mjs. Sai com código diferente de zero se algo falhar.

import fs from 'node:fs';
import { WadFile } from '../src/wad/WadFile.js';
import { findSpriteLumps } from '../src/wad/Sprites.js';
import { PlayerStats } from '../src/game/PlayerStats.js';
import {
  WEAPONS, WEAPONTOP, WEAPONBOTTOM, SPREAD_DEG, USABLE_SLOTS, createWeapons, tickWeapons, requestWeapon,
  cycleTarget, autoSwitchOnPickup, shotsFor, attackTics, availableSlots, weaponLumps, weaponView,
} from '../src/game/weapons.js';
import { fireWeapon } from '../src/game/fireWeapon.js';
import { EffectList } from '../src/game/effects.js';
import { Rng } from '../src/game/Rng.js';
import { resolveMonsterTable } from '../src/game/monsterTable.js';
import { MonsterSystem } from '../src/game/MonsterSystem.js';
import { ItemSystem } from '../src/game/ItemSystem.js';
import { ACTION_KEYS, WheelStepper } from '../src/input/Controls.js';
import { SCREENS } from '../src/menu/Menu.js';
import { loadMenuAssets } from '../src/menu/MenuAssets.js';
import { composeMenu, helpPages, MENU_LAYOUT } from '../src/menu/MenuRenderer.js';
import { MENU_TEXT } from '../src/menu/menuText.js';
import { loadHudAssets } from '../src/hud/HudAssets.js';
import { composeHud } from '../src/hud/HudRenderer.js';

let failures = 0;
const check = (cond, label) => {
  if (!cond) { failures++; console.log(`FALHA: ${label}`); }
  return cond;
};

const bytes = fs.readFileSync(new URL('../assets/freedoom1.wad', import.meta.url));
const wad = new WadFile(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));

// Jogador com todas as armas utilizáveis e munição à vontade.
function armed(extra) {
  const s = new PlayerStats();
  for (const slot of [3, 4]) s.weaponsOwned.add(slot);
  s.hasBackpack = true;
  Object.assign(s.ammo, { clip: 300, shell: 90 });
  extra?.(s);
  return s;
}
// Arma já parada na mão (sem os 16 tics de subida).
function ready(slot) {
  const w = createWeapons({ current: slot });
  w.state = 'ready';
  w.sy = WEAPONTOP;
  return w;
}
let tic = 0;
// n tics com o disparo `fire`; devolve os eventos.
const run = (w, stats, fire, n = 1) => {
  const events = [];
  for (let i = 0; i < n; i++) tickWeapons(w, { fire }, stats, ++tic, events);
  return events;
};
const fires = (events) => events.filter((e) => e.type === 'fire');

// --- a) Durações ---
const expected = { 1: 22, 2: 19, 3: 44, 4: 8 };
for (const slot of [1, 2, 3, 4]) {
  check(attackTics(slot) === expected[slot], `tabela: ataque da arma ${slot} soma ${attackTics(slot)} tics (esperado ${expected[slot]})`);
  const s = armed();
  const w = ready(slot);
  let ev = run(w, s, true);
  let n = 0;
  while (w.state === 'fire' && n < 200) { ev = ev.concat(run(w, s, false)); n++; }
  check(n === expected[slot] && w.state === 'ready', `arma ${slot}: ciclo de ${n} tics (esperado ${expected[slot]})`);
  if (slot === 4) check(fires(ev).length === 2, `metralhadora: ${fires(ev).length} tiros em 8 tics (esperado 2)`);
}
{
  const s = armed();
  const w = ready(2);
  check(requestWeapon(w, 3, s) && w.state === 'lower', 'pedido com a arma parada: desce na hora');
  let down = 0, up = 0;
  while (w.state === 'lower' && down < 100) { run(w, s, false); down++; }
  while (w.state === 'raise' && up < 100) { run(w, s, false); up++; }
  check(down === 16 && up === 16, `descida ${down} tics e subida ${up} tics (esperado 16 e 16)`);
}

// --- b) Máquina de estados ---
{
  // Tic certo do gasto: pistola no 1º tic, espingarda no 4º, metralhadora no 1º e no 5º, soco no 5º.
  const when = { 1: [5], 2: [1], 3: [4], 4: [1, 5] };
  const spend = { 1: null, 2: 'clip', 3: 'shell', 4: 'clip' };
  for (const slot of [1, 2, 3, 4]) {
    const s = armed();
    const before = { ...s.ammo };
    const w = ready(slot);
    const ticks = [];
    for (let i = 1; i <= expected[slot]; i++) if (fires(run(w, s, i === 1)).length) ticks.push(i);
    check(ticks.join() === when[slot].join(), `arma ${slot}: disparo nos tics ${ticks.join()} (esperado ${when[slot].join()})`);
    const spent = Object.keys(s.ammo).filter((t) => s.ammo[t] !== before[t]);
    if (spend[slot]) check(spent.join() === spend[slot] && before[spend[slot]] - s.ammo[spend[slot]] === when[slot].length, `arma ${slot}: gasta ${when[slot].length} de ${spend[slot]}`);
    else check(spent.length === 0, 'soco não gasta munição');
  }
  // Segurando: reinicia com refire 0, 1, 2; soltando: volta a parada.
  const s = armed();
  const w = ready(3);
  const refires = fires(run(w, s, true, 44 * 3)).map((e) => e.refire);
  check(refires.join() === '0,1,2', `espingarda segurando: refire ${refires.join()}`);
  run(w, s, false, 44);
  check(w.state === 'ready' && w.refire === 0, 'soltou: parada, refire 0');
  // Pedido durante o ataque só depois do ataque.
  run(w, s, true);
  check(requestWeapon(w, 4, s) && w.state === 'fire' && w.pending === 4, 'pedido durante o ataque fica pendente');
  run(w, s, false, 43); // o ataque dura 44 tics depois do tic em que começou
  check(w.state === 'fire', 'ainda atacando 43 tics depois do início');
  run(w, s, false);
  check(w.state === 'lower', 'desce ao fim do ataque (44 tics depois do início)');
  // Pedidos ignorados.
  const s2 = new PlayerStats();
  const w2 = ready(2);
  s2.weaponsOwned.add(6); // etapa 21: o 5 passou a ser utilizável; o 6 (plasma) continua não utilizável
  check(!requestWeapon(w2, 2, s2) && !requestWeapon(w2, 3, s2) && !requestWeapon(w2, 6, s2) && w2.pending === null && w2.state === 'ready',
    'pedido para a arma atual, não possuída ou não utilizável é ignorado');
  // Troca completa: 32 tics, sy de 32 a 128 e de volta a 32.
  const s3 = armed();
  const w3 = ready(2);
  requestWeapon(w3, 1, s3);
  const sys = [];
  let changedAt = -1;
  for (let i = 1; i <= 32; i++) {
    if (run(w3, s3, false).some((e) => e.type === 'weaponChanged' && e.slot === 1)) changedAt = i;
    sys.push(w3.sy);
  }
  check(w3.state === 'ready' && w3.current === 1 && changedAt === 16, `troca em 32 tics (arma trocada no tic ${changedAt})`);
  check(Math.max(...sys) === WEAPONBOTTOM && sys[15] === WEAPONBOTTOM && sys[31] === WEAPONTOP && sys[0] === 38, `sy: ${sys[0]} ... ${sys[15]} ... ${sys[31]}`);
}

// --- c) Munição ---
{
  // Ordem: metralhadora com balas, espingarda com cartuchos, pistola com balas, soco.
  const order = (clip, shell, current) => {
    const s = armed((x) => Object.assign(x.ammo, { clip, shell }));
    const w = ready(current);
    const ev = run(w, s, true);
    return { pending: w.pending, fired: fires(ev).length };
  };
  let r = order(0, 5, 2);
  check(r.fired === 0 && r.pending === 3, `pistola sem balas: troca para a espingarda (${r.pending})`);
  r = order(0, 0, 4);
  check(r.fired === 0 && r.pending === 1, `metralhadora sem balas e sem cartuchos: soco (${r.pending})`);
  r = order(50, 0, 3);
  check(r.fired === 0 && r.pending === 4, `espingarda sem cartuchos: metralhadora (${r.pending})`);
  const sP = new PlayerStats();
  sP.ammo.shell = 0;
  const wP = ready(3);
  sP.weaponsOwned.add(3);
  run(wP, sP, true);
  check(wP.pending === 2, 'espingarda sem cartuchos, sem metralhadora: pistola');
  // Metralhadora com 1 bala: um tiro, o segundo quadro não dispara, troca no fim.
  const s = armed((x) => Object.assign(x.ammo, { clip: 1, shell: 0 }));
  const w = ready(4);
  const ev = run(w, s, true, 12);
  check(fires(ev).length === 1 && s.ammo.clip === 0 && w.pending === 1 && w.state === 'lower', 'metralhadora para ao zerar as balas e troca');
  // Espingarda com 1 cartucho: dispara uma vez e troca.
  const s4 = armed((x) => Object.assign(x.ammo, { clip: 0, shell: 1 }));
  const w4 = ready(3);
  const ev4 = run(w4, s4, true, 50);
  check(fires(ev4).length === 1 && s4.ammo.shell === 0 && w4.state !== 'fire' && (w4.pending === 1 || w4.current === 1), 'espingarda com 1 cartucho: um tiro e troca');
}

// --- d) Troca automática ao pegar itens (eventos reais do ItemSystem) ---
function pickup(type, stats, w) {
  const items = new ItemSystem([{ index: 0, x: 0, y: 0, base: [0, 0, 0] }], () => type, () => 0, 16);
  for (const ev of items.update({ x: 0, y: 0, z: 0 }, stats)) autoSwitchOnPickup(w, ev, stats);
  return w;
}
{
  let w = pickup(2001, new PlayerStats(), ready(2));
  check(w.pending === 3 && w.state === 'lower', 'pegar a espingarda (nova): vira pendente');
  const sClip = new PlayerStats();
  sClip.ammo.clip = 0;
  w = pickup(2007, sClip, ready(1));
  check(w.pending === 2, 'balas com 0 balas e soco na mão: pistola');
  const sClip4 = new PlayerStats();
  sClip4.ammo.clip = 0;
  sClip4.weaponsOwned.add(4);
  w = pickup(2007, sClip4, ready(1));
  check(w.pending === 4, 'balas com 0 balas, soco na mão e metralhadora possuída: metralhadora');
  const sShell = new PlayerStats();
  sShell.weaponsOwned.add(3);
  w = pickup(2008, sShell, ready(2));
  check(w.pending === 3, 'cartuchos com 0 cartuchos, pistola na mão e espingarda possuída: espingarda');
  const sNo = new PlayerStats();
  w = pickup(2008, sNo, ready(2));
  check(w.pending === null, 'cartuchos sem a espingarda: não troca');
  const sClipFull = new PlayerStats();
  w = pickup(2007, sClipFull, ready(1));
  check(w.pending === null, 'balas com balas sobrando: não troca');
  for (const type of [2004, 2006]) {
    w = pickup(type, new PlayerStats(), ready(2));
    check(w.pending === null && w.state === 'ready', `pegar ${type} (não utilizável): não troca`);
  }
  // Etapa 21: o lança-foguetes é utilizável; pegar pela primeira vez troca para ele.
  w = pickup(2003, new PlayerStats(), ready(2));
  check(w.pending === 5, 'pegar o lança-foguetes (novo): vira pendente');
  const sRock = new PlayerStats();
  sRock.weaponsOwned.add(5);
  w = pickup(2010, sRock, ready(5));
  check(w.pending === null, 'foguetes com 0 foguetes e o lança-foguetes na mão: não troca');
}

// --- e) Tiros com semente fixa ---
{
  const rng = new Rng(20261005);
  const devMax = 255 * SPREAD_DEG; // 5.602 graus
  let pelletsOk = true, damageOk = true, ints = true;
  for (let k = 0; k < 200; k++) {
    const shots = shotsFor(3, 0, 90, rng);
    if (shots.length !== 7) pelletsOk = false;
    for (const s of shots) {
      if (Math.abs(s.yaw - 90) > devMax + 1e-9) pelletsOk = false;
      if (![5, 10, 15].includes(s.damage)) damageOk = false;
      if (!Number.isInteger(s.damage)) ints = false;
    }
  }
  check(pelletsOk, `espingarda: 7 projéteis com desvio de até ${devMax.toFixed(3)} graus`);
  check(damageOk, 'espingarda: danos em {5, 10, 15}');
  for (const slot of [2, 4]) {
    const first = shotsFor(slot, 0, 45, rng);
    let anySpread = false;
    for (let k = 0; k < 50; k++) {
      const s = shotsFor(slot, 1, 45, rng)[0];
      if (s.yaw !== 45) anySpread = true;
      if (Math.abs(s.yaw - 45) > devMax + 1e-9 || ![5, 10, 15].includes(s.damage)) damageOk = false;
    }
    check(first.length === 1 && first[0].yaw === 45 && anySpread, `arma ${slot}: primeiro tiro sem desvio, seguintes com desvio`);
  }
  const fistDamage = new Set();
  for (let k = 0; k < 500; k++) {
    const s = shotsFor(1, 0, 0, rng)[0];
    fistDamage.add(s.damage);
    if (!Number.isInteger(s.damage) || s.range !== 64) ints = false;
  }
  check(Math.min(...fistDamage) >= 2 && Math.max(...fistDamage) <= 20 && [...fistDamage].every((d) => d % 2 === 0), `soco: dano entre 2 e 20 (vistos ${[...fistDamage].sort((a, b) => a - b).join(',')})`);
  check(ints, 'danos sempre inteiros; soco com alcance 64');
}

// Mundo sintético (sala quadrada, um setor), como no check-combat.
const L = (x1, y1, x2, y2) => ({ x1, y1, x2, y2, minX: Math.min(x1, x2), maxX: Math.max(x1, x2),
  minY: Math.min(y1, y2), maxY: Math.max(y1, y2), front: 0, back: -1, oneSided: true, flags: 0 });
const synthMap = { nodes: [], ssectors: [{ segCount: 1, firstSeg: 0 }], segs: [{ linedef: 0, direction: 0 }],
  linedefs: [{ rightSidedef: 0, leftSidedef: 0xFFFF }], sidedefs: [{ sector: 0 }] };
const room = (sizeX, sizeY = 512) => ({ map: synthMap, sectors: [{ floorHeight: 0, ceilingHeight: 128, ceilingTexture: 'CEIL' }],
  lines: [L(0, 0, sizeX, 0), L(sizeX, 0, sizeX, sizeY), L(sizeX, sizeY, 0, sizeY), L(0, sizeY, 0, 0)] });
const { lumps } = findSpriteLumps(wad);
const table = resolveMonsterTable(lumps, new Set([3004]));
const zombies = (...xs) => new MonsterSystem(xs.map((x, index) => ({ index, x, y: 256, base: [x, 0, -256] })), table.entries, () => 3004, new Rng(1));
const fixedRng = (v) => ({ next255: () => v, nextRange: (a, b) => (a + b) / 2 }); // desvio sempre zero
const fireAt = (slot, world, monsters, rng = fixedRng(255), refire = 0) => {
  const effects = new EffectList();
  const r = fireWeapon({ weapon: slot, refire }, { world, origin: { x: 100, y: 256, z: 41 }, yaw: 0, pitch: 0,
    monsters: monsters.monsters, rng, effects, lightAt: () => 15, damage: (m, a) => monsters.damage(m, a) });
  return { ...r, effects };
};

// Espingarda: exatamente 7 hitscans por tiro.
check(fireAt(3, room(512), zombies()).results.length === 7, 'espingarda: 7 chamadas de hitscan');
check(fireAt(2, room(512), zombies()).results.length === 1 && fireAt(4, room(512), zombies()).results.length === 1, 'pistola e metralhadora: 1 hitscan');

// --- f) Alcance do soco ---
{
  let z = zombies(100 + 60 + 20); // raio 20: superfície a 60
  let r = fireAt(1, room(512), z);
  check(r.hit && z.monsters[0].health < 20, 'soco: monstro com a superfície a 60 é atingido');
  z = zombies(100 + 70 + 20);
  r = fireAt(1, room(512), z);
  check(!r.hit && z.monsters[0].health === 20 && r.effects.items.length === 0, 'soco: a 70 não atinge nada');
  r = fireAt(1, room(150), zombies());
  const puff = r.effects.items[0];
  check(r.results[0].kind === 'wall' && puff?.type === 'puff' && puff.frames[0][0] === 'C', 'soco: parede a 50 dá fumaça a partir do quadro C');
  r = fireAt(1, room(170), zombies());
  check(r.results[0].kind === 'none' && r.effects.items.length === 0, 'soco: parede a 70 não produz fumaça');
  r = fireAt(2, room(150), zombies());
  check(r.effects.items[0]?.frames[0][0] === 'A', 'pistola: fumaça começa no quadro A');
}

// --- g) Abate ---
{
  const z = zombies(200);
  const r = fireAt(3, room(512), z); // fixedRng(255): dano 5 por projétil, 7 projéteis = 35
  const m = z.monsters[0];
  check(r.hit && !m.shootable && m.died === 'die', `espingarda a curta distância mata o zumbi numa salva (${m.died})`);
  const z2 = zombies(200);
  z2.damage(z2.monsters[0], 41);
  check(z2.monsters[0].died === 'xdie', 'dano de 41 no zumbi: morte esfacelada');
}

// --- h) Mapa de teclas ---
{
  const entries = Object.entries(ACTION_KEYS);
  const codes = entries.map(([, k]) => k.code);
  check(new Set(codes).size === codes.length, 'códigos de ACTION_KEYS distintos');
  check(codes.every((c) => !/Shift|Control|Alt|Meta/.test(c)), 'nenhum código de modificador');
  const byCode = Object.fromEntries(entries.map(([a, k]) => [k.code, [a, k]]));
  for (let n = 1; n <= 7; n++) check(byCode[`Digit${n}`]?.[1].slot === n, `Digit${n} escolhe o slot ${n}`);
  const s = armed((x) => { for (const slot of [5, 6, 7]) x.weaponsOwned.add(slot); });
  check(byCode.Digit5?.[1].slot === 5 && requestWeapon(ready(2), 5, s), 'Digit5 escolhe o lança-foguetes possuído (etapa 21)');
  const w = ready(2);
  check([6, 7].every((slot) => !requestWeapon(w, slot, s)) && w.pending === null, 'Digit6 e Digit7: aceitos, mas não trocam');
  check([1, 3, 4].every((slot) => { const ww = ready(2); return requestWeapon(ww, slot, s) && ww.pending === slot; }), 'Digit1, 3 e 4 trocam (2 é a atual)');
  check(['textured', 'sectorColors', 'culling', 'skyTest'].every((a) => !ACTION_KEYS[a]), 'atalhos de texturas, cor por setor, culling e céu removidos');
  check(['textured', 'sectorColors', 'culling', 'skyTest'].every((id) => SCREENS.debug.items.some((i) => i.id === id)), 'os quatro continuam no submenu DEBUG');
  check(byCode.KeyL?.[0] === 'lighting' && byCode.KeyX?.[0] === 'crt' && byCode.KeyV?.[0] === 'visualMode' && byCode.Digit0?.[0] === 'hud', 'KeyL, KeyX, KeyV e Digit0');
  check(ACTION_KEYS.weaponNext.label === 'Roda do mouse' && ACTION_KEYS.weaponPrev.label === 'Roda do mouse', 'rótulo "Roda do mouse"');
  check(SCREENS.gameDebug.items.some((i) => i.id === 'giveAmmo') && SCREENS.gameDebug.items.some((i) => i.id === 'giveWeapons'), 'GAME DEBUG com GIVE AMMO e GIVE ALL WEAPONS');
}

// --- i) Roda do mouse ---
{
  const wh = new WheelStepper();
  check(wh.push(-50, 0, 0) === 0 && wh.push(-60, 0, 10) === 1, 'acumula até 100 (para cima: +1)');
  check(wh.push(-500, 0, 60) === 0, 'dentro de 120 ms: ignorado');
  check(wh.push(-30, 0, 129) === 0 && wh.push(-100, 0, 131) === 1, 'depois de 120 ms: volta a trocar (acumulação reiniciada)');
  check(wh.push(100, 0, 400) === -1, 'para baixo: -1');
  check(wh.push(-3, 1, 1000) === 1, 'deltaMode de linhas (3 linhas = 120)');
  const s = armed((x) => { x.weaponsOwned.add(5); x.weaponsOwned.add(6); });
  check(cycleTarget(ready(5), s, 1) === 1 && cycleTarget(ready(1), s, -1) === 5 && cycleTarget(ready(4), s, 1) === 5, 'ciclo 1-2-3-4-5 com volta, sem o 6');
  const s2 = new PlayerStats();
  check(cycleTarget(ready(2), s2, 1) === 1 && cycleTarget(ready(1), s2, 1) === 2, 'ciclo só entre as possuídas (1 e 2)');
  const w = ready(1);
  requestWeapon(w, 2, s);
  check(cycleTarget(w, s, 1) === 3, 'ciclo parte da arma pendente');
}

// --- j) HUD: campo de munição ---
const hudAssets = loadHudAssets(wad);
{
  const s = armed((x) => Object.assign(x.ammo, { clip: 150, shell: 7 }));
  const digitW = hudAssets.patches.STTNUM0.width;
  const ammoW = (slot) => {
    const report = [];
    composeHud({ stats: s, weapon: weaponView(ready(slot)), weaponLevel: 0 }, hudAssets, 0, report);
    return report.find((r) => r.name === 'ammo')?.w ?? null;
  };
  check(ammoW(2) === 3 * digitW && ammoW(4) === 3 * digitW, 'pistola e metralhadora: campo com as balas (150)');
  check(ammoW(3) === digitW, 'espingarda: campo com os cartuchos (7)');
  check(ammoW(1) === null, 'soco: campo em branco');
  const report = [];
  const w = ready(3);
  run(w, s, true, 4);
  composeHud({ stats: s, weapon: weaponView(w), weaponLevel: 0 }, hudAssets, 0, report);
  check(report.some((r) => r.name === 'SHTGA0') && report.some((r) => r.name === 'SHTFA0'), 'espingarda no tiro: SHTGA0 com clarão SHTFA0');
}

// --- k) Páginas de READ THIS! ---
{
  const assets = loadMenuAssets(wad);
  const { HELP } = MENU_LAYOUT;
  for (const lang of ['en', 'pt']) {
    const pages = helpPages(MENU_TEXT[lang]);
    pages.forEach((_, page) => {
      const report = [];
      composeMenu({ lang, screen: 'help', helpPage: page, selected: 0, started: true, resumeFailed: false, values: {} }, assets, 0, report);
      const list = report.filter((r) => r.y < HELP.footerY);
      const footer = report.find((r) => r.y === HELP.footerY);
      check(list.every((r) => r.bottom <= 180), `${lang} página ${page + 1}: nenhuma linha passa de y = 180`);
      check(report.every((r) => r.width <= 320 && r.right <= 320 && r.x >= 0), `${lang} página ${page + 1}: textos de até 320 pixels`);
      if (pages.length > 1) check(footer?.text.includes(`${page + 1}/${pages.length}`), `${lang} página ${page + 1}: rodapé "${footer?.text}"`);
    });
    console.log(`${lang}: ${pages.length} página(s) de ajuda`);
  }
  check(MENU_TEXT.en.helpFooterPaged.startsWith('PAGE {page}'), 'rodapé em inglês: "PAGE n/N"');
}

// --- l) Lumps ---
{
  const required = ['PUNGA0', 'PUNGB0', 'PUNGC0', 'PUNGD0', 'PISGA0', 'PISGB0', 'PISGC0', 'SHTGA0', 'SHTGB0', 'SHTGC0', 'SHTGD0',
    'CHGGA0', 'CHGGB0', 'SHTFA0', 'SHTFB0', 'CHGFA0', 'CHGFB0', 'PISFA0',
    'MISGA0', 'MISGB0', 'MISFA0', 'MISFB0', 'MISFC0', 'MISFD0']; // etapa 21: lança-foguetes
  const missing = required.filter((n) => !hudAssets.sprites[n]);
  console.log(`Lumps de arma ausentes: ${missing.join(', ') || 'nenhum'}; armas disponíveis: ${hudAssets.weaponSlots.join(', ')}`);
  check(missing.length === 0, 'todos os lumps de arma existem');
  check(USABLE_SLOTS.every((slot) => weaponLumps(slot).every((n) => required.includes(n))), 'tabela usa só os lumps conferidos');
  check(hudAssets.weaponSlots.join() === '1,2,3,4,5', 'armas 1 a 5 disponíveis');
  check(availableSlots((n) => n !== 'SHTGD0').join() === '1,2,4,5', 'lump ausente: só aquela arma fica indisponível');
  check(Object.values(WEAPONS).filter((w) => !w.usable).map((w) => w.slot).join() === '6,7', 'slots 6 e 7 não utilizáveis');
  for (const name of ['DSSHOTGN', 'DSPUNCH', 'DSPISTOL']) check(wad.findLump(name) >= 0, `som ${name} no WAD`);
}

console.log(failures ? `${failures} falha(s)` : 'Tudo certo');
process.exit(failures ? 1 : 0);
