// Partículas: parâmetros, validação, layout dos buffers e funções puras (sem WebGPU e sem DOM),
// verificáveis no Node por tools/check-particles.mjs.

import { FOVY } from '../camera.js';

export const MAX_PARTICLES = 8192;  // alocado uma vez
export const WORKGROUP_SIZE = 64;   // igual ao @workgroup_size do shader
export const PARAMS_VERSION = 1;
export const TAN_HALF_FOV = Math.tan(FOVY / 2); // 0.75: FOV vertical da cena = 2 * atan(0.75)

// Valores padrão (iguais a config/particles.json).
export const DEFAULT_PARTICLE_PARAMS = {
  version: 1,
  count: 1200,
  emberRatio: 0.25,
  boxHalfXZ: 512,
  boxHalfY: 128,
  dust: { size: 0.35, lifeMin: 6, lifeMax: 12, speed: 6, color: '#C0B8A8', lightnum: 7 },
  ember: { size: 0.6, lifeMin: 1.5, lifeMax: 3.5, riseMin: 24, riseMax: 48, drift: 8, colorHot: '#FFA030', colorCool: '#C84010', flickerHz: 8 },
  render: { sizeScale: 1.0, minPixels: 1, maxPixels: 6, pixelSnap: true, fadeFraction: 0.15 },
};

// Tabela única de campos: validação, limite de faixas e montagem do painel de calibragem.
// type: 'int' | 'float' | 'bool' | 'color'.
export const PARAM_FIELDS = [
  { path: 'count', type: 'int', min: 0, max: MAX_PARTICLES, step: 1, section: 'Quantidade', label: 'quantidade' },
  { path: 'emberRatio', type: 'float', min: 0, max: 1, step: 0.01, section: 'Quantidade', label: 'fração de brasas' },
  { path: 'boxHalfXZ', type: 'float', min: 128, max: 1500, step: 1, section: 'Quantidade', label: 'caixa XZ (meia)' },
  { path: 'boxHalfY', type: 'float', min: 32, max: 400, step: 1, section: 'Quantidade', label: 'caixa Y (meia)' },
  { path: 'dust.size', type: 'float', min: 0.05, max: 4, step: 0.01, section: 'Poeira', label: 'tamanho' },
  { path: 'dust.lifeMin', type: 'float', min: 0.2, max: 60, step: 0.1, section: 'Poeira', label: 'vida mín (s)' },
  { path: 'dust.lifeMax', type: 'float', min: 0.2, max: 60, step: 0.1, section: 'Poeira', label: 'vida máx (s)' },
  { path: 'dust.speed', type: 'float', min: 0, max: 40, step: 0.1, section: 'Poeira', label: 'velocidade' },
  { path: 'dust.lightnum', type: 'int', min: 0, max: 15, step: 1, section: 'Poeira', label: 'lightnum' },
  { path: 'ember.size', type: 'float', min: 0.05, max: 4, step: 0.01, section: 'Brasas', label: 'tamanho' },
  { path: 'ember.lifeMin', type: 'float', min: 0.2, max: 60, step: 0.1, section: 'Brasas', label: 'vida mín (s)' },
  { path: 'ember.lifeMax', type: 'float', min: 0.2, max: 60, step: 0.1, section: 'Brasas', label: 'vida máx (s)' },
  { path: 'ember.riseMin', type: 'float', min: 0, max: 120, step: 0.5, section: 'Brasas', label: 'subida mín' },
  { path: 'ember.riseMax', type: 'float', min: 0, max: 120, step: 0.5, section: 'Brasas', label: 'subida máx' },
  { path: 'ember.drift', type: 'float', min: 0, max: 40, step: 0.1, section: 'Brasas', label: 'deriva' },
  { path: 'ember.flickerHz', type: 'float', min: 0.5, max: 30, step: 0.1, section: 'Brasas', label: 'cintilação (Hz)' },
  { path: 'render.sizeScale', type: 'float', min: 0.25, max: 4, step: 0.05, section: 'Renderização', label: 'escala do tamanho' },
  { path: 'render.minPixels', type: 'int', min: 1, max: 4, step: 1, section: 'Renderização', label: 'mín pixels' },
  { path: 'render.maxPixels', type: 'int', min: 1, max: 16, step: 1, section: 'Renderização', label: 'máx pixels' },
  { path: 'render.pixelSnap', type: 'bool', section: 'Renderização', label: 'alinhar à grade' },
  { path: 'render.fadeFraction', type: 'float', min: 0, max: 0.5, step: 0.01, section: 'Renderização', label: 'fração de fade' },
  { path: 'dust.color', type: 'color', section: 'Cores', label: 'poeira' },
  { path: 'ember.colorHot', type: 'color', section: 'Cores', label: 'brasa quente' },
  { path: 'ember.colorCool', type: 'color', section: 'Cores', label: 'brasa fria' },
];

const COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

export const clone = (obj) => JSON.parse(JSON.stringify(obj));

export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => o[k], obj);
  target[last] = value;
}

// Valida `input` campo a campo sobre `base` (objeto completo e válido). Campos ausentes ficam com o
// valor de `base`; fora da faixa são limitados; tipo errado volta ao valor de `base`; desconhecidos
// são ignorados. version diferente de 1 faz o objeto inteiro ser ignorado. Avisos vão para `warn`.
export function sanitizeParams(input, base = DEFAULT_PARTICLE_PARAMS, warn = () => {}) {
  const out = clone(base);
  if (input == null || typeof input !== 'object' || Array.isArray(input)) {
    warn('parâmetros de partículas: não é um objeto; ignorado');
    return out;
  }
  if (input.version !== PARAMS_VERSION) {
    warn(`parâmetros de partículas: version ${JSON.stringify(input.version)} (esperado ${PARAMS_VERSION}); objeto ignorado`);
    return out;
  }
  for (const f of PARAM_FIELDS) {
    const v = getPath(input, f.path);
    if (v === undefined) continue;
    if (f.type === 'bool') {
      if (typeof v === 'boolean') setPath(out, f.path, v);
      else warn(`${f.path}: ${JSON.stringify(v)} não é booleano; mantido ${getPath(out, f.path)}`);
    } else if (f.type === 'color') {
      if (typeof v === 'string' && COLOR_RE.test(v)) setPath(out, f.path, v.toUpperCase());
      else warn(`${f.path}: ${JSON.stringify(v)} não é uma cor #RRGGBB; mantido ${getPath(out, f.path)}`);
    } else if (typeof v !== 'number' || !Number.isFinite(v)) {
      warn(`${f.path}: ${JSON.stringify(v)} não é número; mantido ${getPath(out, f.path)}`);
    } else {
      let n = f.type === 'int' ? Math.round(v) : v;
      if (n < f.min || n > f.max) {
        const c = Math.min(f.max, Math.max(f.min, n));
        warn(`${f.path}: ${v} fora da faixa [${f.min}, ${f.max}]; limitado a ${c}`);
        n = c;
      }
      setPath(out, f.path, n);
    }
  }
  // Restrições entre campos.
  const fix = (path, value, why) => { warn(`${path}: ${why}; ajustado para ${value}`); setPath(out, path, value); };
  for (const kind of ['dust', 'ember']) {
    if (out[kind].lifeMax < out[kind].lifeMin) fix(`${kind}.lifeMax`, out[kind].lifeMin, 'menor que lifeMin');
  }
  if (out.ember.riseMax < out.ember.riseMin) fix('ember.riseMax', out.ember.riseMin, 'menor que riseMin');
  if (out.render.maxPixels < out.render.minPixels) fix('render.maxPixels', out.render.minPixels, 'menor que minPixels');
  return out;
}

// Mescla camadas em ordem de prioridade crescente (ex.: arquivo, depois localStorage). Cada camada
// preenche o que falta com o resultado da camada anterior. Camadas null são puladas.
export function mergeParamLayers(layers, warn = () => {}) {
  let result = clone(DEFAULT_PARTICLE_PARAMS);
  for (const layer of layers) if (layer != null) result = sanitizeParams(layer, result, warn);
  return result;
}

export const serializeParams = (params) => `${JSON.stringify(params, null, 2)}\n`;

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Índice da paleta (256 x RGB) com a menor distância euclidiana ao quadrado de `rgb`.
// Em empate, fica o menor índice.
export function nearestPaletteIndex(palette, [r, g, b]) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < 256; i++) {
    const d = (palette[i * 3] - r) ** 2 + (palette[i * 3 + 1] - g) ** 2 + (palette[i * 3 + 2] - b) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

// Índices da paleta das três cores dos parâmetros.
export function paletteIndices(palette, params) {
  return {
    dust: nearestPaletteIndex(palette, hexToRgb(params.dust.color)),
    emberHot: nearestPaletteIndex(palette, hexToRgb(params.ember.colorHot)),
    emberCold: nearestPaletteIndex(palette, hexToRgb(params.ember.colorCool)),
  };
}

// Passos 1 a 3 do modelo de tamanho (igual ao vertex shader), em pixels da imagem interna:
// upp = w * 2 * tanHalfFov / altura; basePx = size * sizeScale / upp; clamp(round(basePx), min, max).
export function pixelSizeAt(worldSize, depth, params, internalHeight, tanHalfFov = TAN_HALF_FOV) {
  const upp = depth * 2 * tanHalfFov / internalHeight;
  const basePx = worldSize * params.render.sizeScale / upp;
  return Math.min(params.render.maxPixels, Math.max(params.render.minPixels, Math.round(basePx)));
}

export const workgroupCount = (count) => Math.ceil(count / WORKGROUP_SIZE);

// Envolvimento relativo à câmera, igual ao do shader (sem o % do WGSL, que trunca para zero):
// d = ((d + h) - 2h * floor((d + h) / (2h))) - h.
export function wrapRelative(d, h) {
  return (d + h) - 2 * h * Math.floor((d + h) / (2 * h)) - h;
}

// struct Particle (WGSL), 48 bytes, alinhamento 16:
//   position vec3<f32> @ 0, life f32 @ 12, velocity vec3<f32> @ 16, kind f32 @ 28,
//   params vec4<f32> @ 32 (lifeTotal, phase, worldSize, geração).
export const PARTICLE_STRIDE = 48;
export const PARTICLE_OFFSETS = { position: 0, life: 12, velocity: 16, kind: 28, params: 32 };

// struct SimulationParams (WGSL), 128 bytes:
//   deltaTime f32 @0, time f32 @4, count u32 @8, emberRatio f32 @12, generation f32 @16, 3 x pad,
//   seed vec4<u32> @32, cameraPos vec4<f32> @48, boxHalf vec4<f32> @64 (xz, y, xz, 0),
//   dust vec4<f32> @80 (lifeMin, lifeMax, speed, size),
//   emberLife vec4<f32> @96 (lifeMin, lifeMax, riseMin, riseMax), emberMove vec4<f32> @112 (drift, size, 0, 0).
export const SIM_UNIFORM_SIZE = 128;
export const SIM_OFFSETS = {
  deltaTime: 0, time: 4, count: 8, emberRatio: 12, generation: 16,
  seed: 32, cameraPos: 48, boxHalf: 64, dust: 80, emberLife: 96, emberMove: 112,
};

// struct RenderParams (WGSL), 144 bytes:
//   viewProj mat4x4<f32> @0, sizeParams vec4<f32> @64 (sizeScale, minPixels, maxPixels, fadeFraction),
//   view vec4<f32> @80 (tanHalfFov, larguraInterna, alturaInterna, time),
//   flags vec4<u32> @96 (pixelSnap, iluminação, sem fade, 0),
//   palette vec4<u32> @112 (poeira, brasa quente, brasa fria, lightnum da poeira),
//   ember vec4<f32> @128 (flickerHz, 0, 0, 0).
export const RENDER_UNIFORM_SIZE = 144;
export const RENDER_OFFSETS = { viewProj: 0, sizeParams: 64, view: 80, flags: 96, palette: 112, ember: 128 };

export function packSimUniforms(params, { deltaTime, time, generation, seed, cameraPos }) {
  const buffer = new ArrayBuffer(SIM_UNIFORM_SIZE);
  const f32 = new Float32Array(buffer);
  const u32 = new Uint32Array(buffer);
  const { dust, ember } = params;
  f32[SIM_OFFSETS.deltaTime / 4] = deltaTime;
  f32[SIM_OFFSETS.time / 4] = time;
  u32[SIM_OFFSETS.count / 4] = Math.min(params.count, MAX_PARTICLES);
  f32[SIM_OFFSETS.emberRatio / 4] = params.emberRatio;
  f32[SIM_OFFSETS.generation / 4] = generation;
  u32.set(seed, SIM_OFFSETS.seed / 4);
  f32.set([...cameraPos, 0], SIM_OFFSETS.cameraPos / 4);
  f32.set([params.boxHalfXZ, params.boxHalfY, params.boxHalfXZ, 0], SIM_OFFSETS.boxHalf / 4);
  f32.set([dust.lifeMin, dust.lifeMax, dust.speed, dust.size], SIM_OFFSETS.dust / 4);
  f32.set([ember.lifeMin, ember.lifeMax, ember.riseMin, ember.riseMax], SIM_OFFSETS.emberLife / 4);
  f32.set([ember.drift, ember.size, 0, 0], SIM_OFFSETS.emberMove / 4);
  return buffer;
}

// palette: resultado de paletteIndices; internalWidth/Height: tamanho atual da textura interna.
export function packRenderUniforms(params, { viewProj, internalWidth, internalHeight, time, palette, lighting, noFade }) {
  const buffer = new ArrayBuffer(RENDER_UNIFORM_SIZE);
  const f32 = new Float32Array(buffer);
  const u32 = new Uint32Array(buffer);
  const r = params.render;
  f32.set(viewProj, RENDER_OFFSETS.viewProj / 4);
  f32.set([r.sizeScale, r.minPixels, r.maxPixels, r.fadeFraction], RENDER_OFFSETS.sizeParams / 4);
  f32.set([TAN_HALF_FOV, internalWidth, internalHeight, time], RENDER_OFFSETS.view / 4);
  u32.set([r.pixelSnap ? 1 : 0, lighting ? 1 : 0, noFade ? 1 : 0, 0], RENDER_OFFSETS.flags / 4);
  u32.set([palette.dust, palette.emberHot, palette.emberCold, params.dust.lightnum], RENDER_OFFSETS.palette / 4);
  f32.set([params.ember.flickerHz, 0, 0, 0], RENDER_OFFSETS.ember / 4);
  return buffer;
}
