// Verificação dos itens, dos itens largados e dos objetos sólidos, sem navegador.
// Uso: node tools/check-items.mjs. Sai com código diferente de zero se algo falhar.

import fs from 'node:fs';
import { WadFile } from '../src/wad/WadFile.js';
import { loadMap } from '../src/wad/MapData.js';
import { findSector } from '../src/map/bsp.js';
import { findSpriteLumps, resolveThingType } from '../src/wad/Sprites.js';
import { buildCollisionLines } from '../src/physics/collisionData.js';
import { PLAYER_RADIUS, createPlayerState, stepPlayer } from '../src/physics/collision.js';
import { SOLID_DECORATION, staticSolids, getSolids, pushOutSolids, solidOverlap } from '../src/physics/solids.js';
import { buildSpriteScene } from '../src/sprites/spriteLogic.js';
import { THING_TABLE } from '../src/sprites/thingTable.js';
import { Rng } from '../src/game/Rng.js';
import { resolveMonsterTable, extraSpriteFrames } from '../src/game/monsterTable.js';
import { MonsterSystem } from '../src/game/MonsterSystem.js';
import { PlayerStats, AMMO_TYPES, MAX_AMMO, KEY_NAMES } from '../src/game/PlayerStats.js';
import { ITEM_TABLE, MONSTER_DROPS, DROP_SPRITES } from '../src/game/itemTable.js';
import { ITEM_TEXT } from '../src/game/itemText.js';
import { tryPickup } from '../src/game/pickups.js';
import { ItemSystem, MAX_DROPS, inReach } from '../src/game/ItemSystem.js';
import { loadHudAssets } from '../src/hud/HudAssets.js';
import { composeHud, keyLumpFor, wrapMessage } from '../src/hud/HudRenderer.js';
import { measureText } from '../src/menu/MenuRenderer.js';
import { BASE_FLY_SPEED, RUN_MULT } from '../src/camera.js';

let failures = 0;
const check = (cond, label) => {
  if (!cond) { failures++; console.log(`FALHA: ${label}`); }
  return cond;
};
const pick = (type, stats, dropped = false) => tryPickup(ITEM_TABLE[type], stats, { dropped }).pickedUp;
const fresh = (fn) => { const s = new PlayerStats(); fn?.(s); return s; };

const bytes = fs.readFileSync(new URL('../assets/freedoom1.wad', import.meta.url));
const wad = new WadFile(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const map = loadMap(wad, 'E1M1');

// --- a) Vida e armadura ---
let s = fresh();
check(!pick(2011, s) && s.health === 100, 'stimpack com vida 100: não pega');
s.health = 95;
check(pick(2011, s) && s.health === 100, 'stimpack: 95 -> 100 (limite 100)');
s.health = 90;
check(pick(2012, s) && s.health === 100, 'medikit: 90 -> 100');
s.health = 200;
check(pick(2014, s) && s.health === 200, 'bônus de vida com 200: pega e fica em 200');
s.health = 150;
check(pick(2013, s) && s.health === 200, 'soulsphere: 150 -> 200');
s = fresh();
check(pick(2015, s) && s.armor === 1 && s.armorType === 1, 'bônus de armadura: 0 -> 1, tipo verde');
s.armor = 50;
check(pick(2018, s) && s.armor === 100 && s.armorType === 1, 'armadura verde: 50 -> 100, tipo 1');
check(!pick(2018, s), 'armadura verde com 100: não pega');
check(pick(2019, s) && s.armor === 200 && s.armorType === 2, 'armadura azul: 200, tipo 2');
check(pick(2015, s) && s.armor === 200 && s.armorType === 2, 'bônus com 200: pega, fica em 200 e mantém o tipo');
s = fresh((x) => { x.health = 10; });
check(pick(83, s) && s.health === 200 && s.armor === 200 && s.armorType === 2, 'megasphere: 200/200, tipo azul');
s.addArmor(-500);
check(s.armor === 0 && s.armorType === 0, 'armadura em 0 zera o tipo');
s = fresh();
pick(2014, s);
check(s.bonusCount === 6, 'coleta soma 6 ao bonusCount');
for (let i = 0; i < 10; i++) s.tickBonus();
check(s.bonusCount === 0, 'bonusCount decai 1 por tic até 0');
check(!pick(2011, fresh()) && fresh().bonusCount === 0, 'item não pego não mexe no bonusCount');

// --- b) Munição ---
s = fresh();
check(pick(2007, s) && s.ammo.clip === 60, 'clip: 50 -> 60');
check(pick(2007, s, true) && s.ammo.clip === 65, 'clip largado: meio clip (+5)');
check(pick(2048, s) && s.ammo.clip === 115, 'caixa de balas: +50');
check(pick(2008, s) && s.ammo.shell === 4, 'cartuchos: +4');
check(pick(2049, s) && s.ammo.shell === 24, 'caixa de cartuchos: +20');
check(pick(2010, s) && s.ammo.rocket === 1 && pick(2046, s) && s.ammo.rocket === 6, 'foguete +1, caixa +5');
check(pick(2047, s) && s.ammo.cell === 20 && pick(17, s) && s.ammo.cell === 120, 'célula +20, pacote +100');
s.ammo.clip = 200;
check(!pick(2007, s) && s.ammo.clip === 200, 'balas no máximo: clip não pega');
s.ammo.clip = 195;
check(pick(2048, s) && s.ammo.clip === 200, 'caixa de balas corta no máximo');
s = fresh();
check(pick(8, s) && s.hasBackpack, 'mochila: pega');
check(AMMO_TYPES.every((t) => s.maxAmmoOf(t) === MAX_AMMO[t] * 2), 'mochila dobra os máximos');
check(s.ammo.clip === 60 && s.ammo.shell === 4 && s.ammo.rocket === 1 && s.ammo.cell === 20, 'mochila dá 1 clip de cada tipo');
check(pick(8, s) && s.maxAmmoOf('clip') === 400, 'segunda mochila: pega, máximos não dobram de novo');
s.reset();
check(!s.hasBackpack && s.maxAmmoOf('clip') === 200 && s.ammo.clip === 50 && s.armorType === 0, 'reset() restaura tudo');
check(AMMO_TYPES.every((t) => Number.isInteger(s.ammo[t])), 'munição inteira');

// --- c) Armas ---
s = fresh();
let r = tryPickup(ITEM_TABLE[2001], s);
check(r.pickedUp && s.weaponsOwned.has(3) && s.ammo.shell === 8 && r.sound === 'wpnup', 'espingarda: slot 3, 8 cartuchos, som wpnup');
check(pick(2001, s) && s.ammo.shell === 16, 'espingarda já possuída: pega pela munição');
s.ammo.shell = 50;
check(!pick(2001, s), 'espingarda possuída e cartuchos no máximo: não pega');
s = fresh();
check(pick(2001, s, true) && s.ammo.shell === 4, 'espingarda largada: 1 clip (4)');
check(pick(2002, s) && s.weaponsOwned.has(4) && s.ammo.clip === 70, 'metralhadora: slot 4, +20 balas');
check(pick(2005, s) && s.hasChainsaw && !pick(2005, s), 'motosserra: pega uma vez (campo próprio, slot 1 já é do soco)');
check(pick(2003, s) && pick(2004, s) && pick(2006, s) && [5, 6, 7].every((n) => s.weaponsOwned.has(n)), 'lança-foguetes, plasma e BFG');
check(tryPickup(ITEM_TABLE[2011], fresh((x) => { x.health = 50; })).sound === 'itemup', 'item comum: som itemup');

// --- d) Chaves, HUD e mensagens ---
s = fresh();
check(pick(5, s) && s.keys.blueCard && !pick(5, s), 'cartão azul: pega uma vez');
check(keyLumpFor(s.keys, 0) === 'STKEYS0' && keyLumpFor(s.keys, 1) === null, 'cartão azul -> STKEYS0; amarelo vazio');
pick(40, s);
check(keyLumpFor(s.keys, 0) === 'STKEYS3', 'cartão e caveira azuis: mostra a caveira (STKEYS3)');
pick(39, s); pick(13, s);
check(keyLumpFor(s.keys, 1) === 'STKEYS4' && keyLumpFor(s.keys, 2) === 'STKEYS2', 'caveira amarela STKEYS4, cartão vermelho STKEYS2');
const missingText = Object.values(ITEM_TABLE).flatMap((d) => ['en', 'pt'].filter((l) => !ITEM_TEXT[l][d.messageKey]).map((l) => `${l}:${d.messageKey}`));
check(missingText.length === 0, `mensagem em en e pt para todo item (faltando: ${missingText.join(', ')})`);
const hudAssets = loadHudAssets(wad);
check(hudAssets.font.filter(Boolean).length > 50, 'HUD: fonte STCFN carregada');
// Só as mensagens de coleta (etapa 20: as de chave negada, mais longas, são conferidas logo abaixo).
const pickupKeys = new Set(Object.values(ITEM_TABLE).map((d) => d.messageKey));
const longest = Object.values(ITEM_TEXT).flatMap((t) => Object.entries(t).filter(([k]) => pickupKeys.has(k)).map(([, v]) => v))
  .sort((a, b) => measureText(hudAssets.font, b) - measureText(hudAssets.font, a))[0];
const longMessage = `${longest} ${longest}`;
const wrapped = wrapMessage(hudAssets.font, longMessage).split('\n');
check(wrapped.length === 2 && wrapped.every((l) => measureText(hudAssets.font, l) <= 320), 'mensagem larga quebra em duas linhas de até 320');
// Etapa 20: mensagens de chave negada, sozinhas, em até duas linhas de até 320.
for (const key of ['needBlueKey', 'needYellowKey', 'needRedKey']) {
  for (const lang of ['en', 'pt']) {
    const lines = wrapMessage(hudAssets.font, ITEM_TEXT[lang][key]).split('\n');
    check(lines.length <= 2 && lines.every((l) => measureText(hudAssets.font, l) <= 320), `${lang} ${key}: até duas linhas de até 320`);
  }
}
const report = [];
composeHud({ stats: s, weapon: null, weaponLevel: 0, message: longMessage }, hudAssets, 0, report);
for (const name of ['STKEYS3', 'STKEYS4', 'STKEYS2', 'message']) check(report.some((e) => e.name === name), `HUD desenha ${name}`);
const keyRows = report.filter((e) => e.name.startsWith('STKEYS')).map((e) => `${e.x},${e.y}`).join(' ');
check(keyRows === '239,171 239,181 239,191', `chaves em (239, 171/181/191): ${keyRows}`);
check(report.every((e) => e.x >= 0 && e.y >= 0 && e.x + e.w <= 320 && e.y + e.h <= 200), 'HUD: tudo dentro de 320x200');
const ammoRows = report.filter((e) => e.name.startsWith('ammoTable')).length;
check(ammoRows === 8, `tabela de munição: 4 tipos x (atual, máximo) = ${ammoRows}`);

// --- e) Alcance ---
const P = { x: 0, y: 0, z: 0 };
check(inReach({ x: 35.9, y: 0, floorZ: 0 }, P, PLAYER_RADIUS) && !inReach({ x: 36, y: 0, floorZ: 0 }, P, PLAYER_RADIUS), 'alcance: 35.9 pega, 36 não');
check(inReach({ x: 35.9, y: -35.9, floorZ: 0 }, P, PLAYER_RADIUS), 'alcance em caixa: diagonal (35.9, 35.9) pega');
check(inReach({ x: 0, y: 0, floorZ: -8 }, P, PLAYER_RADIUS) && !inReach({ x: 0, y: 0, floorZ: -9 }, P, PLAYER_RADIUS), 'abaixo: 8 pega, 9 não');
check(inReach({ x: 0, y: 0, floorZ: 56 }, P, PLAYER_RADIUS) && !inReach({ x: 0, y: 0, floorZ: 57 }, P, PLAYER_RADIUS), 'acima: 56 pega, 57 não');
const deadSys = new ItemSystem([{ index: 0, x: 0, y: 0, base: [0, 0, 0] }], () => 2011, () => 0, PLAYER_RADIUS);
check(deadSys.update(P, fresh((x) => { x.health = 0; })).length === 0, 'jogador morto não pega nada');
check(deadSys.update(P, fresh((x) => { x.health = 100; })).length === 0 && !deadSys.isCollected(0), 'stimpack com vida cheia fica no mapa');
check(deadSys.update(P, fresh((x) => { x.health = 50; })).length === 1 && deadSys.isCollected(0), 'stimpack com vida 50: coletado');
check(deadSys.update(P, fresh((x) => { x.health = 50; })).length === 0, 'item coletado não é pego de novo');

// --- f) Itens largados ---
const drops = new ItemSystem([], () => 0, (x) => (x > 0 ? 24 : 0), PLAYER_RADIUS);
drops.onMonsterDied({ type: 'died', monsterType: 3004, x: 10, y: 0, thingIndex: 1 });
drops.onMonsterDied({ type: 'died', monsterType: 3004, x: 10, y: 0, thingIndex: 1 });
check(drops.drops.length === 1 && drops.drops[0].type === 2007 && drops.drops[0].floorZ === 24, 'zumbi larga um clip no chão do setor (sem duplicar)');
drops.onMonsterDied({ type: 'died', monsterType: 3001, x: 0, y: 0, thingIndex: 2 });
check(drops.drops.length === 1, 'imp não larga nada');
drops.onMonsterDied({ type: 'died', monsterType: 9, x: -500, y: 0, thingIndex: 3 });
drops.onMonsterDied({ type: 'died', monsterType: 65, x: -900, y: 0, thingIndex: 4 });
check(drops.drops.map((d) => d.type).join() === `${MONSTER_DROPS[3004]},2001,2002`, 'sargento larga espingarda; comando, metralhadora');
s = fresh();
const ev = drops.update({ x: 0, y: 0, z: 24 }, s);
check(ev.length === 1 && s.ammo.clip === 55 && drops.collectedCountable === 0 && drops.drops.length === 2, 'clip largado: +5, sai da lista, não conta');
for (let i = 0; i < 200; i++) drops.onMonsterDied({ type: 'died', monsterType: 3004, x: 5000 + i, y: 0, thingIndex: 100 + i });
check(drops.drops.length === MAX_DROPS && drops.drops[0].x === 5000 + 200 - MAX_DROPS, `limite de ${MAX_DROPS}: descarta os mais antigos`);
drops.reset();
check(drops.drops.length === 0 && drops.collectedCountable === 0, 'reset limpa os largados');

// --- g) Sólidos ---
const column = [{ x: 0, y: 0, radius: 32 }];
const walk = (st, vx, vy, n) => {
  for (let i = 0; i < n; i++) {
    const px = st.x, py = st.y;
    st.x += vx; st.y += vy;
    pushOutSolids(st, column, PLAYER_RADIUS, px, py);
  }
  return st;
};
let st = walk({ x: -100, y: 0 }, 4, 0, 40);
check(Math.abs(st.x + 48.01) < 1e-6 && st.y === 0, `coluna de raio 32: para em x = -48.01 (${st.x.toFixed(3)})`);
// Diagonal (4, 1): encosta na face em 13 passos; nos 7 seguintes x fica preso e y continua subindo.
// Na quina, o eixo de menor penetração vira y e o jogador é empurrado para fora (y passa um pouco de 70).
st = walk({ x: -100, y: 10 }, 4, 1, 20);
check(Math.abs(st.x + 48.01) < 1e-6 && st.y === 30, `desliza na face da coluna (x ${st.x.toFixed(2)}, y ${st.y})`);
st = walk(st, 4, 1, 40);
check(st.x > 0 && st.y >= 70, 'depois de deslizar, contorna a coluna');
st = walk({ x: -100, y: 48 }, 4, 0, 50);
check(st.x === 100 && st.y === 48, 'passa ao lado (|dy| = 48) sem tocar');
check(solidOverlap({ x: -40, y: 0 }, column, PLAYER_RADIUS) === 8 && solidOverlap({ x: -48, y: 0 }, column, PLAYER_RADIUS) === 0, 'solidOverlap');
const { lumps } = findSpriteLumps(wad);
const table = resolveMonsterTable(lumps, new Set([3004, 2035]));
const synthObjects = [{ index: 0, x: 0, y: 0, base: [0, 0, 0] }, { index: 1, x: 200, y: 0, base: [200, 0, 0] }];
const synthTypes = [3004, 2035];
const synth = new MonsterSystem(synthObjects, table.entries, (o) => synthTypes[o.index], new Rng(1));
const list = [];
getSolids(list, synth.monsters, []);
check(list.length === 2 && list[0].radius === 20 && list[1].radius === 10, 'zumbi (20) e barril (10) vivos são sólidos');
synth.damage(synth.monsters[0], 1000);
getSolids(list, synth.monsters, []);
check(list.length === 1 && list[0].x === 200, 'zumbi morto deixa de ser sólido');
synth.damage(synth.monsters[1], 100);
getSolids(list, synth.monsters, []);
check(list.length === 0, 'barril que explodiu deixa de ser sólido');
check(synth.takeEvents().filter((e) => e.type === 'died').length === 2 && synth.takeEvents().length === 0, 'eventos "died": um por morte, fila esvaziada');

// --- h) Varredura do E1M1 com os sólidos reais ---
const present = new Set(map.things.map((t) => t.type));
const e1 = resolveMonsterTable(lumps, present);
const scene = buildSpriteScene(wad, map, {
  extraFrames: [...extraSpriteFrames(e1.entries), ...DROP_SPRITES.map((f) => ({ ...f, category: 'drop' }))],
});
const typeOf = (obj) => map.things[obj.index].type;
const monsters = new MonsterSystem(scene.objects, e1.entries, typeOf, new Rng(1));
const fixed = staticSolids(scene.objects, typeOf);
const solids = getSolids([], monsters.monsters, fixed);
console.log(`E1M1: ${fixed.length} sólidos fixos, ${solids.length} no total (com monstros e barris vivos)`);
const world = { map, lines: buildCollisionLines(map), sectors: map.sectors };
const spawn = map.things.find((t) => t.type === 1);
world.spawn = { x: spawn.x, y: spawn.y };
const oneSided = world.lines.filter((l) => l.oneSided);
function segmentsCross(ax, ay, bx, by, l) {
  const d = (px, py, qx, qy, rx, ry) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
  const d1 = d(l.x1, l.y1, l.x2, l.y2, ax, ay), d2 = d(l.x1, l.y1, l.x2, l.y2, bx, by);
  const d3 = d(ax, ay, bx, by, l.x1, l.y1), d4 = d(ax, ay, bx, by, l.x2, l.y2);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
const runSpeed = BASE_FLY_SPEED * RUN_MULT;
for (const dt of [1 / 60, 0.1]) {
  let crossings = 0, nan = 0, overlaps = 0, worst = 0;
  for (let k = 0; k < 72; k++) {
    const ang = (k * 5) * Math.PI / 180;
    const wish = { vx: Math.cos(ang) * runSpeed, vy: Math.sin(ang) * runSpeed };
    const p = createPlayerState(world, spawn.x, spawn.y);
    for (let time = 0; time < 3; time += dt) {
      const ax = p.x, ay = p.y;
      stepPlayer(p, wish, dt, world, solids);
      if (![p.x, p.y, p.z, p.vz].every(Number.isFinite)) nan++;
      for (const l of oneSided) {
        if (Math.max(ax, p.x) < l.minX || Math.min(ax, p.x) > l.maxX || Math.max(ay, p.y) < l.minY || Math.min(ay, p.y) > l.maxY) continue;
        if (segmentsCross(ax, ay, p.x, p.y, l)) crossings++;
      }
      const o = solidOverlap(p, solids, PLAYER_RADIUS);
      if (o > 0) { overlaps++; worst = Math.max(worst, o); }
    }
  }
  console.log(`dt = ${dt.toFixed(4)}: cruzamentos ${crossings}, NaN ${nan}; passos sobrepostos a sólidos ${overlaps} (pior ${worst.toFixed(2)})`);
  check(crossings === 0 && nan === 0, `varredura com sólidos, dt = ${dt}`);
  if (overlaps) console.log(`AVISO: ${overlaps} passos terminaram sobrepostos a um sólido (paredes têm a última palavra)`);
}

// --- i) Lumps ---
for (const type of Object.keys(ITEM_TABLE).map(Number)) check(THING_TABLE[type], `item ${type} na tabela de sprites`);
for (const type of Object.keys(SOLID_DECORATION).map(Number)) check(THING_TABLE[type], `sólido ${type} na tabela de sprites`);
const unresolved = [...new Set([...Object.keys(ITEM_TABLE), ...Object.keys(SOLID_DECORATION)].map(Number))]
  .filter((type) => !resolveThingType(THING_TABLE[type], lumps));
console.log(`Tipos de item ou sólido sem sprite no freedoom1: ${unresolved.join(', ') || 'nenhum'}`);
check(unresolved.every((t) => [83, 85, 86].includes(t)), 'só MEGA (83), TLMP (85) e TLP2 (86) sem sprite');
for (const f of DROP_SPRITES) check(scene.frames.has(f.prefix + f.letter), `quadro ${f.prefix}${f.letter} (largado) na textura`);
for (const n of [0, 1, 2, 3, 4, 5]) check(hudAssets.patches[`STKEYS${n}`], `STKEYS${n} no WAD`);
for (const n of ['DSITEMUP', 'DSWPNUP']) check(wad.findLump(n) >= 0, `som ${n} no WAD`);
const absentInMap = [...present].filter((t) => ITEM_TABLE[t] && !scene.types.has(t));
check(absentInMap.length === 0, `todo item do E1M1 tem sprite (faltando: ${absentInMap.join(', ')})`);

// --- j) Itens contáveis do E1M1 ---
const items = new ItemSystem(scene.objects, typeOf, (x, y) => map.sectors[findSector(map, x, y)].floorHeight, PLAYER_RADIUS);
const byType = {};
for (const it of items.items) byType[it.type] = (byType[it.type] ?? 0) + 1;
console.log(`E1M1: ${items.items.length} itens (${JSON.stringify(byType)}), ${items.totalCountable} contáveis`);
check(items.totalCountable === 49, `contáveis do E1M1: 49 (${items.totalCountable})`);
for (const it of items.items) {
  if (!ITEM_TABLE[it.type].counts) continue;
  items.update({ x: it.x, y: it.y, z: it.floorZ }, new PlayerStats()); // estado novo: sempre pega
}
check(items.collectedCountable === 49, `visitando cada contável: ${items.collectedCountable}/49`);
items.reset();
check(items.collectedCountable === 0 && items.items.every((it) => !it.collected), 'reset restaura os itens');
check(KEY_NAMES.length === 6, 'seis chaves');

console.log(failures ? `${failures} falha(s)` : 'Tudo certo');
process.exit(failures ? 1 : 0);
