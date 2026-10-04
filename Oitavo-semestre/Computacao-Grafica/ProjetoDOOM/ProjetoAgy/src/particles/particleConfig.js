/**
 * Configurações, validações, constantes e funções matemáticas puras para o sistema de partículas.
 * Desacoplado do DOM e de WebGPU para testes isolados e determinísticos em Node.js.
 */

export const MAX_PARTICLES = 8192;
export const TAN_HALF_FOV = 0.75;
export const INTERNAL_HEIGHT = 400.0;

// Tamanhos de structs e UBOs alinhados às regras do WGSL (múltiplos de 16 bytes)
export const PARTICLE_STRUCT_SIZE = 48; // 12 floats
export const SIMULATION_UBO_SIZE = 112;  // 28 floats/uints (7 x vec4)
export const DRAW_UBO_SIZE = 144;        // 36 floats/uints (9 x vec4)

export const DEFAULT_PARTICLE_PARAMS = Object.freeze({
    version: 1,
    count: 1200,
    emberRatio: 0.25,
    boxHalfXZ: 512,
    boxHalfY: 128,
    dust: Object.freeze({
        size: 0.35,
        lifeMin: 6,
        lifeMax: 12,
        speed: 6,
        color: '#C0B8A8',
        lightnum: 7,
    }),
    ember: Object.freeze({
        size: 0.6,
        lifeMin: 1.5,
        lifeMax: 3.5,
        riseMin: 24,
        riseMax: 48,
        drift: 8,
        colorHot: '#FFA030',
        colorCool: '#C84010',
        flickerHz: 8,
    }),
    render: Object.freeze({
        sizeScale: 1.0,
        minPixels: 1,
        maxPixels: 6,
        pixelSnap: true,
        fadeFraction: 0.15,
    }),
});

/**
 * Clampa um número dentro de um intervalo [min, max].
 * @param {number} val 
 * @param {number} min 
 * @param {number} max 
 * @returns {number}
 */
export function clamp(val, min, max) {
    if (Number.isNaN(val) || val === undefined || val === null) return min;
    return Math.max(min, Math.min(max, val));
}

/**
 * Converte cor hexadecimal '#RRGGBB' em array [R, G, B] inteiro de 0 a 255.
 * @param {string} hex 
 * @returns {[number, number, number]}
 */
export function hexToRgb(hex) {
    if (typeof hex !== 'string') return [255, 255, 255];
    const clean = hex.trim().replace(/^#/, '');
    if (clean.length !== 6) return [255, 255, 255];
    const num = parseInt(clean, 16);
    if (Number.isNaN(num)) return [255, 255, 255];
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/**
 * Converte componentes RGB inteiros em string '#RRGGBB'.
 * @param {number} r 
 * @param {number} g 
 * @param {number} b 
 * @returns {string}
 */
export function rgbToHex(r, g, b) {
    const toHex = (c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0').toUpperCase();
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Encontra o índice da paleta PLAYPAL mais próximo de uma cor alvo RGB (menor distância euclidiana ao quadrado).
 * @param {Uint8Array} paletteRGB Array de 768 bytes com 256 cores RGB
 * @param {number} targetR 
 * @param {number} targetG 
 * @param {number} targetB 
 * @returns {number} Índice de 0 a 255
 */
export function findNearestPaletteIndex(paletteRGB, targetR, targetG, targetB) {
    let bestIdx = 0;
    let minDistanceSq = Infinity;

    for (let i = 0; i < 256; i++) {
        const r = paletteRGB[i * 3 + 0];
        const g = paletteRGB[i * 3 + 1];
        const b = paletteRGB[i * 3 + 2];

        const dr = r - targetR;
        const dg = g - targetG;
        const db = b - targetB;
        const distSq = dr * dr + dg * dg + db * db;

        if (distSq < minDistanceSq) {
            minDistanceSq = distSq;
            bestIdx = i;
        }
    }

    return bestIdx;
}

/**
 * Clona profundamente um objeto de parâmetros.
 * @param {Object} obj 
 * @returns {Object}
 */
export function cloneParams(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Valida, limita faixas e mescla um objeto de parâmetros com os padrões.
 * Valores fora das faixas válidas são limitados com aviso no console.
 * Se version !== 1, ignora o objeto inteiro com aviso no console.
 * 
 * @param {Object} rawParams 
 * @returns {Object} Parâmetros higienizados prontos para uso
 */
export function validateAndSanitizeParams(rawParams) {
    if (!rawParams || typeof rawParams !== 'object') {
        console.warn('[Partículas] Parâmetros ausentes ou inválidos. Utilizando padrões do código.');
        return cloneParams(DEFAULT_PARTICLE_PARAMS);
    }

    if (rawParams.version !== 1) {
        console.warn(`[Partículas] Versão incompatível (${rawParams.version}, esperada: 1). Utilizando padrões do código.`);
        return cloneParams(DEFAULT_PARTICLE_PARAMS);
    }

    const d = DEFAULT_PARTICLE_PARAMS;
    const out = {
        version: 1,
        dust: {},
        ember: {},
        render: {},
    };

    function checkClamped(name, val, min, max, defaultVal, isInt = false) {
        if (typeof val !== 'number' || Number.isNaN(val)) {
            return defaultVal;
        }
        let clamped = clamp(val, min, max);
        if (isInt) clamped = Math.round(clamped);
        if (clamped !== val) {
            console.warn(`[Partículas] Valor fora da faixa em "${name}": ${val} (limitado para ${clamped} na faixa [${min}, ${max}]).`);
        }
        return clamped;
    }

    function checkHex(name, val, defaultHex) {
        if (typeof val !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(val)) {
            console.warn(`[Partículas] Cor inválida em "${name}": ${val}. Utilizando padrão ${defaultHex}.`);
            return defaultHex;
        }
        return val.toUpperCase();
    }

    out.count = checkClamped('count', rawParams.count, 0, 8192, d.count, true);
    out.emberRatio = checkClamped('emberRatio', rawParams.emberRatio, 0, 1, d.emberRatio);
    out.boxHalfXZ = checkClamped('boxHalfXZ', rawParams.boxHalfXZ, 128, 1500, d.boxHalfXZ);
    out.boxHalfY = checkClamped('boxHalfY', rawParams.boxHalfY, 32, 400, d.boxHalfY);

    const rDust = rawParams.dust || {};
    out.dust.size = checkClamped('dust.size', rDust.size, 0.05, 4, d.dust.size);
    out.dust.lifeMin = checkClamped('dust.lifeMin', rDust.lifeMin, 0.2, 60, d.dust.lifeMin);
    const dustLifeMaxMin = out.dust.lifeMin;
    out.dust.lifeMax = checkClamped('dust.lifeMax', rDust.lifeMax, dustLifeMaxMin, 60, Math.max(dustLifeMaxMin, d.dust.lifeMax));
    out.dust.speed = checkClamped('dust.speed', rDust.speed, 0, 40, d.dust.speed);
    out.dust.color = checkHex('dust.color', rDust.color, d.dust.color);
    out.dust.lightnum = checkClamped('dust.lightnum', rDust.lightnum, 0, 15, d.dust.lightnum, true);

    const rEmber = rawParams.ember || {};
    out.ember.size = checkClamped('ember.size', rEmber.size, 0.05, 4, d.ember.size);
    out.ember.lifeMin = checkClamped('ember.lifeMin', rEmber.lifeMin, 0.2, 60, d.ember.lifeMin);
    const emberLifeMaxMin = out.ember.lifeMin;
    out.ember.lifeMax = checkClamped('ember.lifeMax', rEmber.lifeMax, emberLifeMaxMin, 60, Math.max(emberLifeMaxMin, d.ember.lifeMax));
    out.ember.riseMin = checkClamped('ember.riseMin', rEmber.riseMin, 0, 120, d.ember.riseMin);
    const emberRiseMaxMin = out.ember.riseMin;
    out.ember.riseMax = checkClamped('ember.riseMax', rEmber.riseMax, emberRiseMaxMin, 120, Math.max(emberRiseMaxMin, d.ember.riseMax));
    out.ember.drift = checkClamped('ember.drift', rEmber.drift, 0, 40, d.ember.drift);
    out.ember.colorHot = checkHex('ember.colorHot', rEmber.colorHot, d.ember.colorHot);
    out.ember.colorCool = checkHex('ember.colorCool', rEmber.colorCool, d.ember.colorCool);
    out.ember.flickerHz = checkClamped('ember.flickerHz', rEmber.flickerHz, 0.5, 30, d.ember.flickerHz);

    const rRender = rawParams.render || {};
    out.render.sizeScale = checkClamped('render.sizeScale', rRender.sizeScale, 0.25, 4, d.render.sizeScale);
    out.render.minPixels = checkClamped('render.minPixels', rRender.minPixels, 1, 4, d.render.minPixels, true);
    const maxPixelsMin = out.render.minPixels;
    out.render.maxPixels = checkClamped('render.maxPixels', rRender.maxPixels, maxPixelsMin, 16, Math.max(maxPixelsMin, d.render.maxPixels), true);
    out.render.pixelSnap = typeof rRender.pixelSnap === 'boolean' ? rRender.pixelSnap : d.render.pixelSnap;
    out.render.fadeFraction = checkClamped('render.fadeFraction', rRender.fadeFraction, 0, 0.5, d.render.fadeFraction);

    return out;
}

/**
 * Calcula o tamanho final em pixels de uma partícula conforme os passos 1 a 3 do modelo de tamanho:
 * 1. upp = profundidade * 2 * tanHalfFov / alturaInterna
 * 2. basePx = tamanhoDeMundo * sizeScale / upp
 * 3. sizePx = clamp(round(basePx), minPixels, maxPixels)
 * 
 * @param {number} tamanhoDeMundo 
 * @param {number} profundidade Profundidade de visão z = clip.w
 * @param {Object} params Objeto de parâmetros completos
 * @param {number} [alturaInterna=INTERNAL_HEIGHT]
 * @returns {number} Tamanho inteiro em pixels [minPixels, maxPixels]
 */
export function pixelSizeAt(tamanhoDeMundo, profundidade, params, alturaInterna = INTERNAL_HEIGHT) {
    const depth = Math.max(0.001, profundidade);
    const upp = (depth * 2.0 * TAN_HALF_FOV) / alturaInterna;
    const sizeScale = params.render?.sizeScale ?? 1.0;
    const minPixels = params.render?.minPixels ?? 1;
    const maxPixels = params.render?.maxPixels ?? 6;

    const basePx = (tamanhoDeMundo * sizeScale) / upp;
    const rounded = Math.round(basePx);
    return clamp(rounded, minPixels, maxPixels);
}

/**
 * Empacota os dados para o buffer uniforme de simulação (112 bytes).
 * 
 * @param {Object} p
 * @param {Array<number>} p.cameraPos [x, y, z]
 * @param {Array<number>} p.seed [s0, s1, s2, s3]
 * @param {number} p.deltaTime
 * @param {number} p.time
 * @param {Object} p.params Objeto de parâmetros sanitizados
 * @param {ArrayBuffer} [targetBuffer]
 * @returns {{ f32: Float32Array, u32: Uint32Array, buffer: ArrayBuffer }}
 */
export function packSimulationUniforms(p, targetBuffer = null) {
    const buffer = targetBuffer || new ArrayBuffer(SIMULATION_UBO_SIZE);
    const f32 = new Float32Array(buffer);
    const u32 = new Uint32Array(buffer);

    const cam = p.cameraPos || [0, 0, 0];
    f32[0] = cam[0];
    f32[1] = cam[1];
    f32[2] = cam[2];
    f32[3] = 1.0;

    const seed = p.seed || [12345, 67890, 54321, 98765];
    u32[4] = seed[0] >>> 0;
    u32[5] = seed[1] >>> 0;
    u32[6] = seed[2] >>> 0;
    u32[7] = seed[3] >>> 0;

    const params = p.params || DEFAULT_PARTICLE_PARAMS;

    // timeParams (vec4): deltaTime, time, boxHalfXZ, boxHalfY
    f32[8] = p.deltaTime;
    f32[9] = p.time;
    f32[10] = params.boxHalfXZ;
    f32[11] = params.boxHalfY;

    // spawnParams1 (vec4): activeCount, emberRatio, dustSpeed, dustSize
    f32[12] = params.count;
    f32[13] = params.emberRatio;
    f32[14] = params.dust.speed;
    f32[15] = params.dust.size;

    // dustLife (vec4): dustLifeMin, dustLifeMax, unused, unused
    f32[16] = params.dust.lifeMin;
    f32[17] = params.dust.lifeMax;
    f32[18] = 0.0;
    f32[19] = 0.0;

    // emberMotion (vec4): emberRiseMin, emberRiseMax, emberDrift, emberSize
    f32[20] = params.ember.riseMin;
    f32[21] = params.ember.riseMax;
    f32[22] = params.ember.drift;
    f32[23] = params.ember.size;

    // emberLife (vec4): emberLifeMin, emberLifeMax, unused, unused
    f32[24] = params.ember.lifeMin;
    f32[25] = params.ember.lifeMax;
    f32[26] = 0.0;
    f32[27] = 0.0;

    return { f32, u32, buffer };
}

/**
 * Empacota os dados para o buffer uniforme de renderização das partículas (144 bytes).
 * 
 * @param {Object} p
 * @param {Float32Array} p.viewProj
 * @param {Array<number>} p.cameraPos
 * @param {number} p.internalWidth
 * @param {number} p.internalHeight
 * @param {number} p.time
 * @param {number} p.dustIdx
 * @param {number} p.warmEmberIdx
 * @param {number} p.coldEmberIdx
 * @param {boolean} p.lightingEnabled
 * @param {Object} p.params Objeto de parâmetros
 * @param {boolean} [p.disableFade=false] Flag de diagnóstico para desligar fade
 * @param {ArrayBuffer} [targetBuffer]
 * @returns {{ f32: Float32Array, u32: Uint32Array, buffer: ArrayBuffer }}
 */
export function packDrawUniforms(p, targetBuffer = null) {
    const buffer = targetBuffer || new ArrayBuffer(DRAW_UBO_SIZE);
    const f32 = new Float32Array(buffer);
    const u32 = new Uint32Array(buffer);

    // viewProj: floats 0..15 (64B)
    if (p.viewProj) {
        f32.set(p.viewProj, 0);
    }

    // cameraPos: floats 16..19 (16B)
    const cam = p.cameraPos || [0, 0, 0];
    f32[16] = cam[0];
    f32[17] = cam[1];
    f32[18] = cam[2];
    f32[19] = 1.0;

    const params = p.params || DEFAULT_PARTICLE_PARAMS;

    // screenParams (vec4): internalWidth, internalHeight, tanHalfFov, time
    f32[20] = p.internalWidth || 640.0;
    f32[21] = p.internalHeight || 400.0;
    f32[22] = TAN_HALF_FOV;
    f32[23] = p.time;

    // renderParams (vec4): sizeScale, minPixels, maxPixels, fadeFraction
    f32[24] = params.render.sizeScale;
    f32[25] = params.render.minPixels;
    f32[26] = params.render.maxPixels;
    f32[27] = p.disableFade ? 0.0 : params.render.fadeFraction;

    // paletteIndices (vec4<u32>): dustIdx, warmEmberIdx, coldEmberIdx, lightingEnabled
    u32[28] = p.dustIdx >>> 0;
    u32[29] = p.warmEmberIdx >>> 0;
    u32[30] = p.coldEmberIdx >>> 0;
    u32[31] = p.lightingEnabled ? 1 : 0;

    // configFlags (vec4): pixelSnap, flickerHz, dustLightnum, disableFade
    f32[32] = params.render.pixelSnap ? 1.0 : 0.0;
    f32[33] = params.ember.flickerHz;
    f32[34] = params.dust.lightnum;
    f32[35] = p.disableFade ? 1.0 : 0.0;

    return { f32, u32, buffer };
}

/**
 * Cria os dados iniciais das partículas com vidas escalonadas.
 * 
 * @param {number} [count=MAX_PARTICLES]
 * @param {Array<number>} [cameraPos=[0, 41, 0]]
 * @param {Object} [params=DEFAULT_PARTICLE_PARAMS]
 * @returns {Float32Array}
 */
export function createInitialParticleData(count = MAX_PARTICLES, cameraPos = [0, 41, 0], params = DEFAULT_PARTICLE_PARAMS) {
    const data = new Float32Array(count * 12);
    const boxHalfXZ = params.boxHalfXZ || 512.0;
    const boxHalfY = params.boxHalfY || 128.0;
    const emberRatio = params.emberRatio ?? 0.25;

    for (let i = 0; i < count; i++) {
        const offset = i * 12;

        const isEmber = Math.random() < emberRatio;
        const kind = isEmber ? 1.0 : 0.0;

        const px = cameraPos[0] + (Math.random() * 2.0 - 1.0) * boxHalfXZ;
        const py = cameraPos[1] + (Math.random() * 2.0 - 1.0) * boxHalfY;
        const pz = cameraPos[2] + (Math.random() * 2.0 - 1.0) * boxHalfXZ;

        let lifeTotal = 0;
        let vx = 0, vy = 0, vz = 0;
        let worldSize = 0;

        if (isEmber) {
            const lMin = params.ember?.lifeMin ?? 1.5;
            const lMax = params.ember?.lifeMax ?? 3.5;
            lifeTotal = lMin + Math.random() * Math.max(0.001, lMax - lMin);

            const rMin = params.ember?.riseMin ?? 24.0;
            const rMax = params.ember?.riseMax ?? 48.0;
            vy = rMin + Math.random() * Math.max(0.001, rMax - rMin);

            const drift = params.ember?.drift ?? 8.0;
            vx = (Math.random() * 2.0 - 1.0) * drift;
            vz = (Math.random() * 2.0 - 1.0) * drift;
            worldSize = params.ember?.size ?? 0.6;
        } else {
            const lMin = params.dust?.lifeMin ?? 6.0;
            const lMax = params.dust?.lifeMax ?? 12.0;
            lifeTotal = lMin + Math.random() * Math.max(0.001, lMax - lMin);

            const spd = params.dust?.speed ?? 6.0;
            vx = (Math.random() * 2.0 - 1.0) * spd;
            vy = (Math.random() * 2.0 - 1.0) * (spd * 0.5);
            vz = (Math.random() * 2.0 - 1.0) * spd;
            worldSize = params.dust?.size ?? 0.35;
        }

        const initialLife = Math.random() * lifeTotal;
        const phase = Math.random() * Math.PI * 2.0;

        data[offset + 0] = px;
        data[offset + 1] = py;
        data[offset + 2] = pz;
        data[offset + 3] = initialLife;

        data[offset + 4] = vx;
        data[offset + 5] = vy;
        data[offset + 6] = vz;
        data[offset + 7] = kind;

        data[offset + 8] = lifeTotal;
        data[offset + 9] = phase;
        data[offset + 10] = worldSize;
        data[offset + 11] = 0.0;
    }

    return data;
}
