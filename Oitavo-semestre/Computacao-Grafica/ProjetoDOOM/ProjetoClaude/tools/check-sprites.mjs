// Verificação dos sprites sem navegador. Uso: node tools/check-sprites.mjs
// Sai com código diferente de zero se algo falhar.

import fs from 'node:fs';
import { WadFile } from '../src/wad/WadFile.js';
import { loadMap } from '../src/wad/MapData.js';
import { parseSpriteName, findSpriteLumps, buildFrames, resolveThingType } from '../src/wad/Sprites.js';
import { THING_TABLE, IGNORED_TYPES, skillFilter, skillBit } from '../src/sprites/thingTable.js';
import {
  mod, chooseRotation, angleToThing, frameAt, animOffset, gameTics, buildSpriteScene, writeInstances,
  INSTANCE_STRIDE, INSTANCE_OFFSETS, FLAG_MIRRORED,
} from '../src/sprites/spriteLogic.js';

let failures = 0;
const check = (cond, label) => {
  if (!cond) { failures++; console.log(`FALHA: ${label}`); }
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// --- Interpretação de nomes ---
check(same(parseSpriteName('TROOA1'), { prefix: 'TROO', entries: [{ frame: 'A', rot: 1, mirrored: false }] }), 'TROOA1');
check(same(parseSpriteName('TROOA0'), { prefix: 'TROO', entries: [{ frame: 'A', rot: 0, mirrored: false }] }), 'TROOA0 (vista única)');
check(same(parseSpriteName('TROOA2A8'), { prefix: 'TROO', entries: [
  { frame: 'A', rot: 2, mirrored: false }, { frame: 'A', rot: 8, mirrored: true }] }), 'TROOA2A8 (8 espelhada)');
check(same(parseSpriteName('BON1A0').prefix, 'BON1'), 'prefixo com dígito');
for (const bad of ['TROOA9', 'TROO', 'TROOA', 'TROOA12', 'TROOA0A8', 'TROOA2A', 'troa1', 'S_START', 'TITLEPIC', 'TROOA1B']) {
  check(parseSpriteName(bad) === null, `nome inválido aceito: ${bad}`);
}

// --- Lumps entre S_START e S_END ---
const bytes = fs.readFileSync(new URL('../assets/freedoom1.wad', import.meta.url));
const wad = new WadFile(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const { lumps, source } = findSpriteLumps(wad);
const s = wad.findLump('S_START'), e = wad.findLump('S_END');
check(source === 'S_START..S_END' && s >= 0 && e > s, `marcadores (${source})`);
check(lumps.size > 0 && [...lumps.values()].every((i) => i > s && i < e), `${lumps.size} lumps, todos entre os marcadores`);
check(lumps.has('TROOA1') && lumps.has('TROOA2A8'), 'TROOA1 e TROOA2A8 encontrados');
const troo = buildFrames('TROO', lumps).get('A');
check(troo[1].lump === 'TROOA2A8' && !troo[1].mirrored && troo[7].lump === 'TROOA2A8' && troo[7].mirrored, 'TROO A: vistas 2 e 8 do mesmo lump');
const bar = buildFrames('BAR1', lumps).get('A');
check(bar.every((v) => v.lump === 'BAR1A0' && !v.mirrored), 'BAR1 A: vista única nas 8 posições');
const skul = buildFrames('SKUL', lumps).get('A');
check(skul && skul[7].lump === 'SKULA8A2' && !skul[7].mirrored && skul[1].mirrored, 'SKULA8A2: 8 normal, 2 espelhada');

// --- Escolha da vista ---
check(chooseRotation(180, 0) === 1, 'leste visto de leste (a = 180) -> vista 1');
check(chooseRotation(0, 0) === 5, 'leste visto de oeste (a = 0) -> vista 5');
check(chooseRotation(270, 90) === 1, 'norte visto do norte (a = 270) -> vista 1');
check(chooseRotation(45, 270) === 8, 'virado a 270 visto com a = 45 -> vista 8 (dá a volta)');
check(mod(-90, 360) === 270 && mod(-720, 360) === 0, 'mod com negativos');
check(Math.round(angleToThing(0, 0, 100, 0)) === 180, 'ângulo do jogador a leste até o objeto: 180');
for (let a = -720; a <= 720; a += 7.5) {
  const r = chooseRotation(a, 33);
  check(r >= 1 && r <= 8, `vista fora de 1..8 (a = ${a})`);
}

// --- Animação ---
check(gameTics(1) === 35 && gameTics(0.5) === 17, 'relógio em tics');
const seq = 'ABCDCB';
check(frameAt(seq, 6, 0, 0) === 'A' && frameAt(seq, 6, 6, 0) === 'B' && frameAt(seq, 6, 35, 0) === 'B', 'sequência sem deslocamento');
// Com deslocamento 13: (0+13)/6 = 2 -> C; (30+13)/6 = 7 -> 7 % 6 = 1 -> B; (36+13)/6 = 8 -> 2 -> C.
check(frameAt(seq, 6, 0, 13) === 'C' && frameAt(seq, 6, 30, 13) === 'B' && frameAt(seq, 6, 36, 13) === 'C', 'sequência com deslocamento 13');
const allOffsetsValid = Array.from({ length: 5000 }, (_, i) => animOffset(i)).every((o) => Number.isInteger(o) && o >= 0 && o < 1000);
check(allOffsetsValid, 'deslocamentos sempre inteiros em [0, 1000)');
check(frameAt('A', 10, 999, 5) === 'A', 'quadro único');
const offsets = new Set([0, 1, 2, 3, 4, 5, 6, 7].map(animOffset));
check(offsets.size > 4, 'deslocamentos variam entre objetos');

// --- Filtro de dificuldade ---
check(skillBit(1) === 1 && skillBit(2) === 1 && skillBit(3) === 2 && skillBit(4) === 4 && skillBit(5) === 4, 'bits de dificuldade');
check(skillFilter(7, 3) === 'ok', 'flags 7 em SKILL 3');
check(skillFilter(1, 3) === 'skill' && skillFilter(4, 3) === 'skill', 'só fácil / só difícil fora do SKILL 3');
check(skillFilter(2, 3) === 'ok' && skillFilter(4, 4) === 'ok' && skillFilter(1, 2) === 'ok', 'bit certo por dificuldade');
check(skillFilter(23, 3) === 'multiplayer' && skillFilter(0x10 | 2, 3) === 'multiplayer', 'flag multiplayer');

// --- E1M1: cada tipo da tabela presente no mapa encontra lumps ---
const map = loadMap(wad, 'E1M1');
const present = [...new Set(map.things.map((t) => t.type))].filter((t) => !IGNORED_TYPES.has(t));
for (const type of present) {
  const entry = THING_TABLE[type];
  if (!entry) { check(false, `tipo ${type} do E1M1 fora da tabela`); continue; }
  const r = resolveThingType(entry, lumps);
  check(r !== null, `tipo ${type} (${entry.prefix}) sem lumps`);
  if (r && r.frames !== entry.frames) console.log(`Aviso: tipo ${type} ${entry.prefix}: "${entry.frames}" -> "${r.frames}"`);
}
const scene = buildSpriteScene(wad, map);
const st = scene.stats;
console.log(`E1M1: ${present.length} tipos com sprite, ${scene.objects.length} objetos, ${scene.layers.length} camadas; ` +
  `descartados: dificuldade ${st.discarded.skill}, multiplayer ${st.discarded.multiplayer}, setor ${st.discarded.sector}`);
check(st.unknown.length === 0 && st.unresolved.length === 0, `desconhecidos ${st.unknown}, não resolvidos ${st.unresolved}`);
check(scene.objects.every((o) => Number.isFinite(o.base[1]) && o.lightnum >= 0 && o.lightnum <= 15), 'bases e luz válidas');

// --- Instâncias (32 bytes) ---
check(INSTANCE_STRIDE === 32 && INSTANCE_OFFSETS.layer === 12 && INSTANCE_OFFSETS.lightnum === 16 && INSTANCE_OFFSETS.flags === 20,
  'layout da instância');
const buf = new ArrayBuffer(scene.objects.length * INSTANCE_STRIDE);
const imp = scene.objects.find((o) => o.type.prefix === 'TROO' && o.type.frames.length > 1);
const n = writeInstances(buf, scene.objects, { x: imp.x + 100 * Math.cos((imp.angle + 135) * Math.PI / 180),
  y: imp.y + 100 * Math.sin((imp.angle + 135) * Math.PI / 180) }, 0);
check(n === scene.objects.length, 'uma instância por objeto');
const u32 = new Uint32Array(buf), f32 = new Float32Array(buf);
const k = scene.objects.indexOf(imp) * 8;
check(f32[k] === imp.base[0] && f32[k + 2] === imp.base[2], 'base na instância');
check(u32[k + 3] < scene.layers.length && u32[k + 4] === imp.lightnum, 'layer e lightnum na instância');
// Jogador a 135 graus do ângulo do imp: a = imp.angle + 135 + 180 -> vista 4 (lump TROOA4A6, normal)
console.log(`Imp visto a 135°: camada ${scene.layers[u32[k + 3]].name}, espelhado ${Boolean(u32[k + 5] & FLAG_MIRRORED)}`);

console.log(failures ? `${failures} falha(s)` : 'Tudo certo');
process.exit(failures ? 1 : 0);
