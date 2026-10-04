import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    DEFAULT_PARTICLE_PARAMS,
    PARTICLE_STRUCT_SIZE,
    SIMULATION_UBO_SIZE,
    DRAW_UBO_SIZE,
    validateAndSanitizeParams,
    findNearestPaletteIndex,
    pixelSizeAt,
    hexToRgb,
} from '../src/particles/particleConfig.js';
import { WadFile } from '../src/wad/WadFile.js';
import { loadPalette0 } from '../src/wad/Textures.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('====================================================');
console.log('Verificação Automatizada de Partículas (Bloco Comum)');
console.log('====================================================\n');

let errors = 0;

function assert(condition, message) {
    if (!condition) {
        console.error(`  [ERRO] ${message}`);
        errors++;
    } else {
        console.log(`  [OK] ${message}`);
    }
}

// ------------------------------------------------------------------
// 1. Verificação de Tamanhos de Structs e UBOs Alinhados ao WGSL
// ------------------------------------------------------------------
console.log('1. Testando tamanhos e alinhamentos WGSL:');
assert(PARTICLE_STRUCT_SIZE === 48, 'Tamanho da struct Particle = 48 bytes (12 floats)');
assert(PARTICLE_STRUCT_SIZE % 16 === 0, 'Struct Particle alinhada a múltiplos de 16 bytes');
assert(SIMULATION_UBO_SIZE === 112, 'Tamanho de SimulationParams UBO = 112 bytes (7 x vec4)');
assert(SIMULATION_UBO_SIZE % 16 === 0, 'SimulationParams UBO alinhado a múltiplos de 16 bytes');
assert(DRAW_UBO_SIZE === 144, 'Tamanho de DrawParams UBO = 144 bytes (9 x vec4)');
assert(DRAW_UBO_SIZE % 16 === 0, 'DrawParams UBO alinhado a múltiplos de 16 bytes');

// ------------------------------------------------------------------
// 2. Validação, Faixas e Mesclagem de Parâmetros
// ------------------------------------------------------------------
console.log('\n2. Testando validação, limites de faixa e mesclagem:');

// a) JSON válido padrão
const validDefault = JSON.parse(JSON.stringify(DEFAULT_PARTICLE_PARAMS));
const parsedDefault = validateAndSanitizeParams(validDefault);
assert(parsedDefault.version === 1, 'Versão 1 reconhecida');
assert(parsedDefault.count === 1200, 'Count padrão = 1200');
assert(parsedDefault.emberRatio === 0.25, 'emberRatio padrão = 0.25');
assert(parsedDefault.dust.size === 0.35, 'dust.size padrão = 0.35');
assert(parsedDefault.ember.size === 0.6, 'ember.size padrão = 0.6');
assert(parsedDefault.render.minPixels === 1, 'render.minPixels padrão = 1');
assert(parsedDefault.render.maxPixels === 6, 'render.maxPixels padrão = 6');

// b) Objeto inválido ou versão diferente de 1
const invalidVer = validateAndSanitizeParams({ version: 2, count: 5000 });
assert(invalidVer.version === 1 && invalidVer.count === 1200, 'Versão !== 1 é ignorada, revertendo para padrões');

const invalidNull = validateAndSanitizeParams(null);
assert(invalidNull.version === 1 && invalidNull.count === 1200, 'Objeto nulo reverte para padrões');

// c) Campos fora da faixa (devem ser clampados)
const clamped = validateAndSanitizeParams({
    version: 1,
    count: 99999,            // max 8192
    emberRatio: -0.5,        // min 0
    boxHalfXZ: 2000,         // max 1500
    boxHalfY: 10,            // min 32
    dust: {
        size: 10.0,          // max 4
        lifeMin: 0.05,       // min 0.2
        lifeMax: 100,        // max 60
        speed: -5,           // min 0
        lightnum: 25,        // max 15
        color: 'invalid',    // formato #RRGGBB inválido
    },
    ember: {
        size: 0.01,          // min 0.05
        riseMin: 150,        // max 120
        riseMax: 200,        // max 120
        drift: 50,           // max 40
        flickerHz: 50,       // max 30
    },
    render: {
        sizeScale: 10,       // max 4
        minPixels: 0,        // min 1
        maxPixels: 30,       // max 16
        fadeFraction: 0.9,   // max 0.5
    }
});

assert(clamped.count === 8192, 'count limitado a 8192');
assert(clamped.emberRatio === 0.0, 'emberRatio limitado a 0.0');
assert(clamped.boxHalfXZ === 1500, 'boxHalfXZ limitado a 1500');
assert(clamped.boxHalfY === 32, 'boxHalfY limitado a 32');
assert(clamped.dust.size === 4.0, 'dust.size limitado a 4.0');
assert(clamped.dust.lifeMin === 0.2, 'dust.lifeMin limitado a 0.2');
assert(clamped.dust.lifeMax === 60.0, 'dust.lifeMax limitado a 60.0');
assert(clamped.dust.speed === 0, 'dust.speed limitado a 0');
assert(clamped.dust.lightnum === 15, 'dust.lightnum limitado a 15');
assert(clamped.dust.color === DEFAULT_PARTICLE_PARAMS.dust.color, 'Cor inválida substituída pelo padrão');
assert(clamped.ember.size === 0.05, 'ember.size limitado a 0.05');
assert(clamped.ember.riseMin === 120, 'ember.riseMin limitado a 120');
assert(clamped.ember.riseMax === 120, 'ember.riseMax limitado a 120');
assert(clamped.ember.drift === 40, 'ember.drift limitado a 40');
assert(clamped.ember.flickerHz === 30, 'ember.flickerHz limitado a 30');
assert(clamped.render.sizeScale === 4.0, 'render.sizeScale limitado a 4.0');
assert(clamped.render.minPixels === 1, 'render.minPixels limitado a 1');
assert(clamped.render.maxPixels === 16, 'render.maxPixels limitado a 16');
assert(clamped.render.fadeFraction === 0.5, 'render.fadeFraction limitado a 0.5');

// d) Campos ausentes recebem padrões
const partial = validateAndSanitizeParams({
    version: 1,
    count: 500,
    dust: { size: 0.5 }
});
assert(partial.count === 500, 'Campo fornecido count preservado');
assert(partial.dust.size === 0.5, 'Campo fornecido dust.size preservado');
assert(partial.emberRatio === DEFAULT_PARTICLE_PARAMS.emberRatio, 'Campo ausente emberRatio preenchido com padrão');
assert(partial.dust.speed === DEFAULT_PARTICLE_PARAMS.dust.speed, 'Campo ausente dust.speed preenchido com padrão');
assert(partial.ember.colorHot === DEFAULT_PARTICLE_PARAMS.ember.colorHot, 'Campo ausente ember.colorHot preenchido com padrão');

// ------------------------------------------------------------------
// 3. Verificação do Algoritmo de Cor Mais Próxima na Paleta
// ------------------------------------------------------------------
console.log('\n3. Testando busca de cores mais próximas na paleta 0:');
const testPal = new Uint8Array(256 * 3);
testPal[0] = 0; testPal[1] = 0; testPal[2] = 0;             // 0: Preto
testPal[3] = 255; testPal[4] = 255; testPal[5] = 255;       // 1: Branco
testPal[6] = 255; testPal[7] = 0; testPal[8] = 0;           // 2: Vermelho
testPal[9] = 0; testPal[10] = 255; testPal[11] = 0;         // 3: Verde
testPal[12] = 0; testPal[13] = 0; testPal[14] = 255;        // 4: Azul

assert(findNearestPaletteIndex(testPal, 10, 10, 10) === 0, 'Cor próxima do preto mapeia para índice 0');
assert(findNearestPaletteIndex(testPal, 240, 240, 240) === 1, 'Cor próxima do branco mapeia para índice 1');
assert(findNearestPaletteIndex(testPal, 200, 10, 10) === 2, 'Cor próxima do vermelho mapeia para índice 2');

const wadPath = path.resolve(__dirname, '../assets/freedoom1.wad');
if (fs.existsSync(wadPath)) {
    const buffer = fs.readFileSync(wadPath);
    const wad = new WadFile(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
    const pal0 = loadPalette0(wad);
    const dustRgb = hexToRgb(DEFAULT_PARTICLE_PARAMS.dust.color);
    const dustIdx = findNearestPaletteIndex(pal0, dustRgb[0], dustRgb[1], dustRgb[2]);
    assert(dustIdx >= 0 && dustIdx < 256, `Índice de poeira encontrado na paleta real do WAD: ${dustIdx}`);
}

// ------------------------------------------------------------------
// 4. Verificação de pixelSizeAt com Valores Esperados
// ------------------------------------------------------------------
console.log('\n4. Testando modelo de tamanho em pixels (pixelSizeAt):');

const p = DEFAULT_PARTICLE_PARAMS;

// Valores esperados do prompt:
// poeira (size 0.35) em profundidade 20 dá 5, em 100 dá 1, em 10 dá 6
const dust20 = pixelSizeAt(0.35, 20, p, 400);
assert(dust20 === 5, `Poeira (size 0.35) em z=20 resulta em 5 px (obtido: ${dust20})`);

const dust100 = pixelSizeAt(0.35, 100, p, 400);
assert(dust100 === 1, `Poeira (size 0.35) em z=100 resulta em 1 px (obtido: ${dust100})`);

const dust10 = pixelSizeAt(0.35, 10, p, 400);
assert(dust10 === 6, `Poeira (size 0.35) em z=10 resulta em 6 px [clamped maxPixels] (obtido: ${dust10})`);

// brasa (size 0.6) em 20 dá 6 e em 100 dá 2
const ember20 = pixelSizeAt(0.6, 20, p, 400);
assert(ember20 === 6, `Brasa (size 0.6) em z=20 resulta em 6 px [clamped maxPixels] (obtido: ${ember20})`);

const ember100 = pixelSizeAt(0.6, 100, p, 400);
assert(ember100 === 2, `Brasa (size 0.6) em z=100 resulta em 2 px (obtido: ${ember100})`);

// ------------------------------------------------------------------
// 5. Teste de Monotonicidade (Tamanho nunca cresce com profundidade crescente)
// ------------------------------------------------------------------
console.log('\n5. Testando monotonicidade de tamanho de 8 a 1000 unidades:');

let monotonicDust = true;
let prevDustSize = pixelSizeAt(0.35, 8, p, 400);
for (let z = 9; z <= 1000; z++) {
    const curSize = pixelSizeAt(0.35, z, p, 400);
    if (curSize > prevDustSize) {
        monotonicDust = false;
        console.error(`  [ERRO] Monotonicidade violada para poeira em z=${z}: anterior ${prevDustSize} px < atual ${curSize} px`);
        break;
    }
    prevDustSize = curSize;
}
assert(monotonicDust, 'Tamanho de poeira é monotonicamente não-crescente de z=8 a z=1000');

let monotonicEmber = true;
let prevEmberSize = pixelSizeAt(0.6, 8, p, 400);
for (let z = 9; z <= 1000; z++) {
    const curSize = pixelSizeAt(0.6, z, p, 400);
    if (curSize > prevEmberSize) {
        monotonicEmber = false;
        console.error(`  [ERRO] Monotonicidade violada para brasa em z=${z}: anterior ${prevEmberSize} px < atual ${curSize} px`);
        break;
    }
    prevEmberSize = curSize;
}
assert(monotonicEmber, 'Tamanho de brasa é monotonicamente não-crescente de z=8 a z=1000');

// ------------------------------------------------------------------
// Conclusão
// ------------------------------------------------------------------
console.log('\n====================================================');
if (errors === 0) {
    console.log('✅ Todos os testes de validação, limites e modelo de tamanho passaram!');
    process.exit(0);
} else {
    console.error(`❌ ${errors} erro(s) encontrado(s) na verificação de partículas.`);
    process.exit(1);
}
