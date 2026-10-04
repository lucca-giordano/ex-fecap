import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WadFile } from '../src/wad/WadFile.js';
import { loadMap } from '../src/wad/MapData.js';
import { parseSpriteLumpName, findSpriteLumps, buildSpriteRegistry } from '../src/wad/Sprites.js';
import {
    computeViewAngle,
    selectViewNumber,
    selectAnimationFrame,
    getThingOffset,
    packSpriteInstances,
} from '../src/sprites/spriteLogic.js';
import { filterThingsBySkill, SKILL } from '../src/sprites/thingTable.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const wadPath = path.resolve(__dirname, '../assets/freedoom1.wad');
if (!fs.existsSync(wadPath)) {
    console.error(`[check-sprites] Arquivo WAD não encontrado em: ${wadPath}`);
    process.exit(1);
}

const buffer = fs.readFileSync(wadPath);
const wad = new WadFile(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));

let failed = false;

function assert(condition, message) {
    if (!condition) {
        console.error(`  [FALHA] ${message}`);
        failed = true;
    } else {
        console.log(`  [OK] ${message}`);
    }
}

console.log('====================================================');
console.log('Verificação Automatizada de Sprites (Etapa 11)');
console.log('====================================================\n');

// 1. Interpretação de Nomes de Lumps
console.log('1. Testando interpretação de nomes de lumps:');
const p1 = parseSpriteLumpName('TROOA1');
assert(p1 !== null && p1.prefix === 'TROO' && p1.pairs.length === 1, 'TROOA1 é reconhecido com prefixo TROO');
assert(p1.pairs[0].frame === 'A' && p1.pairs[0].view === 1 && p1.pairs[0].mirrored === false, 'TROOA1 tem quadro A, vista 1, não espelhado');

const p0 = parseSpriteLumpName('TROOA0');
assert(p0 !== null && p0.pairs[0].frame === 'A' && p0.pairs[0].view === 0, 'TROOA0 tem quadro A, vista única (0)');

const p2 = parseSpriteLumpName('TROOA2A8');
assert(p2 !== null && p2.pairs.length === 2, 'TROOA2A8 possui 2 pares de rotação');
assert(p2.pairs[0].frame === 'A' && p2.pairs[0].view === 2 && !p2.pairs[0].mirrored, 'TROOA2A8 par 1: quadro A, vista 2, normal');
assert(p2.pairs[1].frame === 'A' && p2.pairs[1].view === 8 && p2.pairs[1].mirrored, 'TROOA2A8 par 2: quadro A, vista 8, espelhado');

assert(parseSpriteLumpName('INVALID') === null, 'Nome com 7 caracteres rejeitado');
assert(parseSpriteLumpName('TR1A1') === null, 'Nome com 5 caracteres rejeitado');
assert(parseSpriteLumpName('TROOA9') === null, 'Dígito de vista 9 inválido rejeitado');
assert(parseSpriteLumpName('TROO11') === null, 'Letra de quadro inválida rejeitada');
assert(parseSpriteLumpName('') === null, 'Nome vazio rejeitado');

// 2. Localização dos Lumps entre S_START e S_END
console.log('\n2. Testando localização dos lumps entre S_START e S_END:');
const spriteLumps = findSpriteLumps(wad);
assert(spriteLumps.size > 0, `Lumps de sprites encontrados no WAD: ${spriteLumps.size}`);
assert(spriteLumps.has('TROOA1'), 'Lump TROOA1 encontrado no conjunto de sprites');
assert(spriteLumps.has('SHOTA0'), 'Lump SHOTA0 encontrado no conjunto de sprites');
assert(spriteLumps.has('PLAYW0'), 'Lump PLAYW0 encontrado no conjunto de sprites');

// 3. Escolha de Vista e Rotações
console.log('\n3. Testando escolha de vista (âncoras e wrap-around):');
// Âncora 1: objeto virado para o leste (angle 0) visto de um ponto a leste dele (a = 180) usa a vista 1
const v1 = selectViewNumber(180, 0, true);
assert(v1 === 1, `Âncora 1: angle=0, a=180 -> vista 1 (esperado: 1, obtido: ${v1})`);

// Âncora 2: visto de oeste (a = 0) usa a vista 5
const v5 = selectViewNumber(0, 0, true);
assert(v5 === 5, `Âncora 2: angle=0, a=0 -> vista 5 (esperado: 5, obtido: ${v5})`);

// Âncora 3: objeto virado para o norte (angle 90) visto do norte (a = 270) usa a vista 1
const v1North = selectViewNumber(270, 90, true);
assert(v1North === 1, `Âncora 3: angle=90, a=270 -> vista 1 (esperado: 1, obtido: ${v1North})`);

// Wrap-around: objeto virado a 270 graus visto com a = 45 usa a vista 8
const v8Wrap = selectViewNumber(45, 270, true);
assert(v8Wrap === 8, `Wrap-around: angle=270, a=45 -> vista 8 (esperado: 8, obtido: ${v8Wrap})`);

// Vista única (sem rotações)
const vSingle = selectViewNumber(180, 0, false);
assert(vSingle === 0, `Vista única retorna 0 independentemente do ângulo (obtido: ${vSingle})`);

// Cálculo do ângulo a a partir de coordenadas da câmera e do objeto
const angleDeg = computeViewAngle(100, 0, 0, 0); // Jogador em (100, 0), objeto em (0, 0)
assert(Math.abs(angleDeg - 180) < 0.001, `computeViewAngle(100,0, 0,0) = 180° (obtido: ${angleDeg})`);

// 4. Sequência de Animação com Deslocamento de Fase
console.log('\n4. Testando sequência de animação e desfasamento:');
const frames = 'ABCD';
const f0 = selectAnimationFrame(frames, 0, 4, 0);
const f1 = selectAnimationFrame(frames, 4, 4, 0);
const f2 = selectAnimationFrame(frames, 8, 4, 0);
const f3 = selectAnimationFrame(frames, 12, 4, 0);
const f4Loop = selectAnimationFrame(frames, 16, 4, 0);
assert(f0 === 'A' && f1 === 'B' && f2 === 'C' && f3 === 'D' && f4Loop === 'A', 'Animação avança a cada ticsPerFrame e faz loop cíclico');

const offset0 = getThingOffset(0);
const offset1 = getThingOffset(1);
const offset2 = getThingOffset(2);
assert(offset0 !== offset1 && offset1 !== offset2, 'Offsets de fase diferem entre objetos distintos');

const fWithOffset = selectAnimationFrame(frames, 0, 4, 4); // Deslocamento de 4 tics deve adiantar 1 quadro
assert(fWithOffset === 'B', `Animação com offset 4 tics seleciona B no tic 0 (obtido: ${fWithOffset})`);

// 5. Filtro de Dificuldade
console.log('\n5. Testando filtro de dificuldade (SKILL 3):');
const mockThings = [
    { type: 3001, flags: 0x0002 },          // Válido: Skill 3, singleplayer
    { type: 3001, flags: 0x0002 | 0x0010 }, // Inválido: Multiplayer only
    { type: 3001, flags: 0x0001 },          // Inválido: Apenas Skill 1-2
    { type: 3001, flags: 0x0004 },          // Inválido: Apenas Skill 4-5
    { type: 3001, flags: 0x0007 },          // Válido: Todas as skills
];
const filterResult = filterThingsBySkill(mockThings, 3);
assert(filterResult.kept.length === 2, `Filtro de dificuldade selecionou 2 de 5 objetos (obtido: ${filterResult.kept.length})`);
assert(filterResult.discardedMultiplayer === 1, `1 objeto descartado por flag multiplayer (obtido: ${filterResult.discardedMultiplayer})`);
assert(filterResult.discardedSkill === 2, `2 objetos descartados por bit de dificuldade (obtido: ${filterResult.discardedSkill})`);

// 6. Layout e Alinhamento das Instâncias na GPU
console.log('\n6. Testando empacotamento de instâncias na GPU (layout de 32 bytes):');
const mockInstances = [
    {
        worldPos: [100.5, 41.0, -200.5],
        layer: 3,
        lightnum: 12,
        mirrored: true,
        fullbright: false,
        fuzz: false,
    },
    {
        worldPos: [0.0, 0.0, 0.0],
        layer: 0,
        lightnum: 15,
        mirrored: false,
        fullbright: true,
        fuzz: true,
    },
];
const packed = packSpriteInstances(mockInstances);
assert(packed.byteLength === 64, `Buffer empacotado tem 64 bytes para 2 instâncias (obtido: ${packed.byteLength})`);
const u32View = new Uint32Array(packed);
const f32View = new Float32Array(packed);
assert(Math.abs(f32View[0] - 100.5) < 0.001, 'Posição X float32 correta');
assert(u32View[3] === 3, 'Layer u32 correta');
assert(u32View[4] === 12, 'Lightnum u32 correto');
assert(u32View[5] === 1, 'Flags da instância 0 possui bit 0 (mirrored) ligado');
assert(u32View[13] === (2 | 4), 'Flags da instância 1 possui bit 1 (fullbright) e bit 2 (fuzz) ligados');

// 7. Resolução de Sprites no E1M1
console.log('\n7. Testando resolução de sprites das entidades presentes no mapa E1M1:');
const map = loadMap(wad, 'E1M1');
const mapFilter = filterThingsBySkill(map.things, SKILL);
const mapTypes = new Set(mapFilter.kept.map((t) => t.type));

const registry = buildSpriteRegistry(wad, mapTypes);
assert(registry.layersCount > 0, `Texture Array possui ${registry.layersCount} camadas`);
assert(registry.maxWidth > 0 && registry.maxHeight > 0, `Dimensões máximas da camada: ${registry.maxWidth}x${registry.maxHeight} px`);

let missingSpritesForMap = 0;
for (const type of mapTypes) {
    const status = registry.typeStatus.get(type);
    if (!status || status.ignored) continue; // Pula tipos ignorados silenciosamente (spawns)

    if (!status.resolved) {
        console.error(`  [ERRO] Tipo ${type} presente no E1M1 não foi resolvido! Motivo: ${status.reason}`);
        missingSpritesForMap++;
        failed = true;
    } else {
        assert(status.validFrames.length > 0, `Tipo ${type} (${status.name} [${status.prefix}]) possui quadros válidos: "${status.validFrames}"`);
    }
}
assert(missingSpritesForMap === 0, `Todos os tipos de entidades do E1M1 encontraram lumps de sprites válidos no WAD!`);

console.log('\n====================================================');
if (failed) {
    console.error('❌ Falha na verificação de sprites.');
    process.exit(1);
} else {
    console.log('✅ Todas as verificações de sprites passaram com sucesso!');
    process.exit(0);
}
