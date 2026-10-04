// Verificação das partes puras das partículas, sem navegador. Uso: node tools/check-particles.mjs
// Sai com código diferente de zero se algo falhar.

import fs from 'node:fs';
import { WadFile } from '../src/wad/WadFile.js';
import { readPalette } from '../src/wad/Textures.js';
import {
  MAX_PARTICLES, PARTICLE_STRIDE, PARTICLE_OFFSETS, SIM_UNIFORM_SIZE, SIM_OFFSETS, RENDER_UNIFORM_SIZE,
  RENDER_OFFSETS, DEFAULT_PARTICLE_PARAMS, TAN_HALF_FOV, clone, sanitizeParams, mergeParamLayers, serializeParams,
  hexToRgb, nearestPaletteIndex, paletteIndices, pixelSizeAt, workgroupCount, wrapRelative,
  packSimUniforms, packRenderUniforms,
} from '../src/particles/particleConfig.js';

let failures = 0;
const check = (cond, label) => {
  if (!cond) { failures++; console.log(`FALHA: ${label}`); }
};
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const H = 400; // altura interna

// --- Layout das structs pelas regras do WGSL (tamanho e alinhamento de cada tipo) ---
const WGSL_TYPES = {
  f32: { size: 4, align: 4 }, u32: { size: 4, align: 4 },
  vec3f: { size: 12, align: 16 }, vec4f: { size: 16, align: 16 }, vec4u: { size: 16, align: 16 },
  mat4x4f: { size: 64, align: 16 },
};
function layout(members) {
  let offset = 0, structAlign = 0;
  const offsets = {};
  for (const [name, type] of members) {
    const t = WGSL_TYPES[type];
    offset = Math.ceil(offset / t.align) * t.align;
    offsets[name] = offset;
    offset += t.size;
    structAlign = Math.max(structAlign, t.align);
  }
  return { offsets, size: Math.ceil(offset / structAlign) * structAlign };
}
const sameOffsets = (computed, declared) => Object.entries(declared).every(([k, v]) => computed[k] === v);

const particle = layout([['position', 'vec3f'], ['life', 'f32'], ['velocity', 'vec3f'], ['kind', 'f32'], ['params', 'vec4f']]);
check(particle.size === PARTICLE_STRIDE && particle.size === 48, `Particle: ${particle.size} bytes`);
check(sameOffsets(particle.offsets, PARTICLE_OFFSETS), `offsets de Particle: ${JSON.stringify(particle.offsets)}`);
const sim = layout([['deltaTime', 'f32'], ['time', 'f32'], ['count', 'u32'], ['emberRatio', 'f32'],
  ['generation', 'f32'], ['_pad0', 'f32'], ['_pad1', 'f32'], ['_pad2', 'f32'], ['seed', 'vec4u'],
  ['cameraPos', 'vec4f'], ['boxHalf', 'vec4f'], ['dust', 'vec4f'], ['emberLife', 'vec4f'], ['emberMove', 'vec4f']]);
check(sim.size === SIM_UNIFORM_SIZE && sim.size === 128, `SimulationParams: ${sim.size} bytes`);
check(sameOffsets(sim.offsets, SIM_OFFSETS), `offsets de SimulationParams: ${JSON.stringify(sim.offsets)}`);
const render = layout([['viewProj', 'mat4x4f'], ['sizeParams', 'vec4f'], ['view', 'vec4f'], ['flags', 'vec4u'],
  ['palette', 'vec4u'], ['ember', 'vec4f']]);
check(render.size === RENDER_UNIFORM_SIZE && render.size === 144, `RenderParams: ${render.size} bytes`);
check(sameOffsets(render.offsets, RENDER_OFFSETS), `offsets de RenderParams: ${JSON.stringify(render.offsets)}`);
console.log(`Particle ${particle.size} B, SimulationParams ${sim.size} B, RenderParams ${render.size} B, ` +
  `buffer ${MAX_PARTICLES * PARTICLE_STRIDE} B`);

// --- Padrões: iguais a config/particles.json ---
const fileJson = JSON.parse(fs.readFileSync(new URL('../config/particles.json', import.meta.url), 'utf8'));
check(JSON.stringify(fileJson) === JSON.stringify(DEFAULT_PARTICLE_PARAMS), 'config/particles.json igual aos padrões do código');
check(near(TAN_HALF_FOV, 0.75), `tanHalfFov ${TAN_HALF_FOV}`);

// --- Validação, limite de faixas e mesclagem ---
const warnings = [];
const warn = (m) => warnings.push(m);
const D = DEFAULT_PARTICLE_PARAMS;

// JSON válido e completo: igual ao de entrada, sem avisos.
let r = sanitizeParams(clone(D), D, warn);
check(JSON.stringify(r) === JSON.stringify(D) && warnings.length === 0, 'objeto válido passa sem avisos');

// Campos ausentes: recebem o valor da base; desconhecidos são ignorados.
warnings.length = 0;
r = sanitizeParams({ version: 1, count: 500, dust: { size: 1 }, extra: 42, render: { foo: 1 } }, D, warn);
check(r.count === 500 && r.dust.size === 1 && r.dust.lifeMin === D.dust.lifeMin && r.render.maxPixels === D.render.maxPixels,
  'campos ausentes recebem o padrão');
check(!('extra' in r) && !('foo' in r.render) && warnings.length === 0, 'campos desconhecidos ignorados sem aviso');

// Fora da faixa: limitados, com aviso.
warnings.length = 0;
r = sanitizeParams({ version: 1, count: 99999, emberRatio: -1, boxHalfXZ: 10, render: { minPixels: 2.6, maxPixels: 99 },
  dust: { lightnum: 20 }, ember: { flickerHz: 0 } }, D, warn);
check(r.count === 8192 && r.emberRatio === 0 && r.boxHalfXZ === 128, 'faixas numéricas limitadas');
check(r.render.minPixels === 3 && r.render.maxPixels === 16 && r.dust.lightnum === 15 && r.ember.flickerHz === 0.5,
  'inteiros arredondados e limitados');
check(warnings.length >= 6, `avisos de faixa (${warnings.length})`);

// Restrições entre campos e tipos errados.
warnings.length = 0;
r = sanitizeParams({ version: 1, dust: { lifeMin: 10, lifeMax: 5, color: 'red' }, ember: { riseMin: 50, riseMax: 10 },
  render: { minPixels: 4, maxPixels: 2, pixelSnap: 'sim' }, count: '12' }, D, warn);
check(r.dust.lifeMax === 10 && r.ember.riseMax === 50 && r.render.maxPixels === 4, 'restrições entre campos');
check(r.dust.color === D.dust.color && r.render.pixelSnap === D.render.pixelSnap && r.count === D.count, 'tipos errados ignorados');
check(sanitizeParams({ version: 1, dust: { color: '#a0b0c0' } }, D).dust.color === '#A0B0C0', 'cor normalizada em maiúsculas');

// version diferente de 1 ou objeto inválido: ignorado inteiro.
warnings.length = 0;
check(JSON.stringify(sanitizeParams({ version: 2, count: 5 }, D, warn)) === JSON.stringify(D) && warnings.length === 1, 'version 2 ignorada');
check(JSON.stringify(sanitizeParams(null, D, warn)) === JSON.stringify(D), 'null ignorado');
check(JSON.stringify(sanitizeParams([1, 2], D, warn)) === JSON.stringify(D), 'array ignorado');
let invalidJson = null;
try { invalidJson = JSON.parse('{ "version": 1, count: }'); } catch { invalidJson = undefined; }
check(invalidJson === undefined && JSON.stringify(mergeParamLayers([invalidJson ?? null])) === JSON.stringify(D), 'JSON inválido cai nos padrões');

// Mesclagem: padrões < arquivo < localStorage.
r = mergeParamLayers([{ version: 1, count: 300, dust: { size: 0.5 } }, { version: 1, count: 700 }]);
check(r.count === 700 && r.dust.size === 0.5 && r.emberRatio === D.emberRatio, 'mesclagem por camadas');
r = mergeParamLayers([{ version: 1, count: 300 }, { version: 9, count: 700 }]);
check(r.count === 300, 'camada com version errada é pulada');
check(JSON.stringify(JSON.parse(serializeParams(D))) === JSON.stringify(D), 'serialização ida e volta');

// --- Cores e índice mais próximo da paleta ---
check(hexToRgb('#C0B8A8').join() === '192,184,168' && hexToRgb('#FFA030').join() === '255,160,48', 'hexToRgb');
const synthetic = new Uint8Array(256 * 3);
for (let i = 0; i < 256; i++) synthetic[i * 3] = i;
synthetic.set([7, 0, 0], 200 * 3);
check(nearestPaletteIndex(synthetic, [10, 0, 0]) === 10, 'cor exata');
check(nearestPaletteIndex(synthetic, [7, 0, 0]) === 7, 'empate: menor índice');
check(nearestPaletteIndex(synthetic, [255, 255, 255]) === 255, 'mais próximo por distância');
const bytes = fs.readFileSync(new URL('../assets/freedoom1.wad', import.meta.url));
const palette = readPalette(new WadFile(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)));
check(nearestPaletteIndex(palette, [0, 0, 0]) === 0, 'PLAYPAL: preto é o índice 0');
const idx = paletteIndices(palette, D);
const rgb = (i) => Array.from(palette.subarray(i * 3, i * 3 + 3)).join(', ');
console.log(`Cores padrão: poeira ${idx.dust} (${rgb(idx.dust)}), brasa quente ${idx.emberHot} (${rgb(idx.emberHot)}), ` +
  `brasa fria ${idx.emberCold} (${rgb(idx.emberCold)})`);

// --- Modelo de tamanho (pixelSizeAt) ---
const cases = [
  ['poeira', D.dust.size, 20, 5], ['poeira', D.dust.size, 100, 1], ['poeira', D.dust.size, 10, 6],
  ['brasa', D.ember.size, 20, 6], ['brasa', D.ember.size, 100, 2],
];
for (const [name, size, depth, expected] of cases) {
  const got = pixelSizeAt(size, depth, D, H);
  check(got === expected, `${name} em profundidade ${depth}: ${got} px (esperado ${expected})`);
}
for (const size of [D.dust.size, D.ember.size, 0.05, 4]) {
  let prev = Infinity;
  for (let depth = 8; depth <= 1000; depth++) {
    const px = pixelSizeAt(size, depth, D, H);
    check(px <= prev, `tamanho ${size} cresce de ${prev} para ${px} na profundidade ${depth}`);
    check(px >= D.render.minPixels && px <= D.render.maxPixels, `tamanho ${size} fora de [min, max] em ${depth}`);
    prev = px;
  }
}
console.log(`Tamanho (px) poeira/brasa nas profundidades 16..512: ${[16, 32, 64, 128, 256, 512]
  .map((d) => `${d}:${pixelSizeAt(D.dust.size, d, D, H)}/${pixelSizeAt(D.ember.size, d, D, H)}`).join(' ')}`);

// --- Contagem, envolvimento e empacotamento ---
check(workgroupCount(1200) === 19 && workgroupCount(8192) === 128 && workgroupCount(0) === 0, 'workgroups');
const h = D.boxHalfXZ;
check(wrapRelative(0, h) === 0 && wrapRelative(-(h + 1), h) === h - 1 && wrapRelative(h + 1, h) === -(h - 1), 'wrap');
for (let d = -3000; d <= 3000; d += 37.3) {
  const w = wrapRelative(d, h);
  check(w >= -h && w < h, `wrap ${d} fora de [-h, h)`);
}

const sbuf = packSimUniforms(D, { deltaTime: 0.016, time: 12.5, generation: 3, seed: [1, 2, 3, 0xffffffff], cameraPos: [10, 20, 30] });
const sf = new Float32Array(sbuf), su = new Uint32Array(sbuf);
check(sbuf.byteLength === 128, 'tamanho do uniform da simulação');
check(near(sf[0], 0.016) && sf[1] === 12.5 && su[2] === 1200 && near(sf[3], 0.25) && sf[4] === 3, 'cabeçalho da simulação');
check(su[8] === 1 && su[11] === 0xffffffff, 'seed @ 32');
check(sf[12] === 10 && sf[14] === 30 && sf[16] === 512 && sf[17] === 128, 'cameraPos @ 48, boxHalf @ 64');
check(sf[20] === 6 && sf[21] === 12 && sf[22] === 6 && near(sf[23], 0.35), 'dust @ 80');
check(sf[24] === 1.5 && sf[25] === 3.5 && sf[26] === 24 && sf[27] === 48 && sf[28] === 8 && near(sf[29], 0.6), 'ember @ 96 e @ 112');

const vp = Float32Array.from({ length: 16 }, (_, i) => i + 1);
const rbuf = packRenderUniforms(D, { viewProj: vp, internalWidth: 640, internalHeight: 400, time: 3,
  palette: { dust: 11, emberHot: 22, emberCold: 33 }, lighting: true, noFade: false });
const rf = new Float32Array(rbuf), ru = new Uint32Array(rbuf);
check(rbuf.byteLength === 144, 'tamanho do uniform do desenho');
check(rf[0] === 1 && rf[15] === 16, 'viewProj @ 0');
check(rf[16] === 1 && rf[17] === 1 && rf[18] === 6 && near(rf[19], 0.15), 'sizeParams @ 64');
check(near(rf[20], 0.75) && rf[21] === 640 && rf[22] === 400 && rf[23] === 3, 'view @ 80');
check(ru[24] === 1 && ru[25] === 1 && ru[26] === 0, 'flags @ 96');
check(ru[28] === 11 && ru[29] === 22 && ru[30] === 33 && ru[31] === 7 && rf[32] === 8, 'palette @ 112, ember @ 128');

console.log(failures ? `${failures} falha(s)` : 'Tudo certo');
process.exit(failures ? 1 : 0);
