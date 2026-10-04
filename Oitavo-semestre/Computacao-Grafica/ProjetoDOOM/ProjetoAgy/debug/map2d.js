import { WadFile } from '../src/wad/WadFile.js';
import { loadMap } from '../src/wad/MapData.js';

const WAD_PATH = new URL('../assets/freedoom1.wad', import.meta.url);
const MAP_NAME = 'E1M1';
const PADDING = 30; // Margem visual em pixels

function displayError(message) {
    const errorOverlay = document.getElementById('error-overlay');
    const errorMessage = document.getElementById('error-message');
    if (errorOverlay && errorMessage) {
        errorMessage.textContent = message;
        errorOverlay.style.display = 'flex';
    }
    console.error(message);
}

/**
 * Calcula a bounding box (limites min/max de X e Y) a partir do array de vértices.
 * @param {Array} vertexes 
 * @returns {Object} { minX, maxX, minY, maxY }
 */
function calculateBounds(vertexes) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < vertexes.length; i++) {
        const v = vertexes[i];
        if (v.x < minX) minX = v.x;
        if (v.x > maxX) maxX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.y > maxY) maxY = v.y;
    }

    return { minX, maxX, minY, maxY };
}

/**
 * Exibe no console todas as estatísticas obrigatórias do mapa lido.
 */
function logMapStatistics(map, bounds, playerStart) {
    console.group(`[WAD] Estatísticas do Mapa ${map.name}`);

    // 1. Contagem de registros de cada tabela
    console.log('1. Contagem de Registros:');
    console.table({
        THINGS: map.things.length,
        LINEDEFS: map.linedefs.length,
        SIDEDEFS: map.sidedefs.length,
        VERTEXES: map.vertexes.length,
        SEGS: map.segs.length,
        SSECTORS: map.ssectors.length,
        NODES: map.nodes.length,
        SECTORS: map.sectors.length,
    });

    // 2. Limites do mapa (min e max de X e Y)
    console.log(`2. Limites do Mapa: X [${bounds.minX}, ${bounds.maxX}] | Y [${bounds.minY}, ${bounds.maxY}]`);

    // 3. Posição e ângulo de spawn do Jogador 1 (Thing type 1)
    if (playerStart) {
        console.log(`3. Início do Jogador 1: Posição (${playerStart.x}, ${playerStart.y}) | Ângulo: ${playerStart.angle}° (0° = Leste, 90° = Norte)`);
    } else {
        console.warn('3. Início do Jogador 1: Não encontrado na tabela THINGS!');
    }

    // 4. Menor e maior altura de chão e de teto entre os setores
    let minFloor = Infinity, maxFloor = -Infinity;
    let minCeil = Infinity, maxCeil = -Infinity;

    for (const sec of map.sectors) {
        if (sec.floorHeight < minFloor) minFloor = sec.floorHeight;
        if (sec.floorHeight > maxFloor) maxFloor = sec.floorHeight;
        if (sec.ceilingHeight < minCeil) minCeil = sec.ceilingHeight;
        if (sec.ceilingHeight > maxCeil) maxCeil = sec.ceilingHeight;
    }
    console.log(`4. Alturas dos Setores: Chão [${minFloor} a ${maxFloor}] | Teto [${minCeil} a ${maxCeil}]`);

    // 5. Número de nomes de textura distintos usados nas sidedefs e nos setores
    const sidedefTextures = new Set();
    for (const side of map.sidedefs) {
        if (side.upperTexture && side.upperTexture !== '-') sidedefTextures.add(side.upperTexture);
        if (side.lowerTexture && side.lowerTexture !== '-') sidedefTextures.add(side.lowerTexture);
        if (side.middleTexture && side.middleTexture !== '-') sidedefTextures.add(side.middleTexture);
    }

    const sectorTextures = new Set();
    for (const sec of map.sectors) {
        if (sec.floorTexture && sec.floorTexture !== '-') sectorTextures.add(sec.floorTexture);
        if (sec.ceilingTexture && sec.ceilingTexture !== '-') sectorTextures.add(sec.ceilingTexture);
    }

    console.log(`5. Texturas Distintas: ${sidedefTextures.size} em Sidedefs (paredes) | ${sectorTextures.size} em Setores (pisos/tetos)`);
    console.groupEnd();
}

/**
 * Renderiza o mapa 2D no Canvas com proporções preservadas e eixo Y invertido.
 */
function renderMap(canvas, ctx, map, bounds, playerStart) {
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Fundo preto clássico
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, width, height);

    const mapWidth = bounds.maxX - bounds.minX;
    const mapHeight = bounds.maxY - bounds.minY;

    // Escala uniforme para manter o aspect ratio do mapa
    const availableWidth = width - 2 * PADDING;
    const availableHeight = height - 2 * PADDING;
    const scale = Math.min(availableWidth / mapWidth, availableHeight / mapHeight);

    // Centralização do mapa na tela
    const offsetX = (width - mapWidth * scale) / 2;
    const offsetY = (height - mapHeight * scale) / 2;

    // Mapeamento de coordenadas Doom -> Canvas:
    // O eixo Y do Doom cresce para o norte (para cima), enquanto o do canvas cresce para baixo.
    // Portanto, invertemos com: (bounds.maxY - y)
    const toScreenX = (x) => offsetX + (x - bounds.minX) * scale;
    const toScreenY = (y) => offsetY + (bounds.maxY - y) * scale;

    ctx.lineWidth = 1;

    // Passo 1: Desenhar linedefs de 2 lados em cinza (#777)
    ctx.strokeStyle = '#666666';
    ctx.beginPath();
    for (let i = 0; i < map.linedefs.length; i++) {
        const line = map.linedefs[i];
        if (line.twoSided) {
            const v1 = map.vertexes[line.v1];
            const v2 = map.vertexes[line.v2];
            ctx.moveTo(toScreenX(v1.x), toScreenY(v1.y));
            ctx.lineTo(toScreenX(v2.x), toScreenY(v2.y));
        }
    }
    ctx.stroke();

    // Passo 2: Desenhar linedefs de 1 lado em branco (#ffffff) sobrepondo as internas
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    for (let i = 0; i < map.linedefs.length; i++) {
        const line = map.linedefs[i];
        if (!line.twoSided) {
            const v1 = map.vertexes[line.v1];
            const v2 = map.vertexes[line.v2];
            ctx.moveTo(toScreenX(v1.x), toScreenY(v1.y));
            ctx.lineTo(toScreenX(v2.x), toScreenY(v2.y));
        }
    }
    ctx.stroke();

    // Passo 3: Marcar o início do Jogador 1 com seta verde orientada
    if (playerStart) {
        const px = toScreenX(playerStart.x);
        const py = toScreenY(playerStart.y);
        const angleRad = (playerStart.angle * Math.PI) / 180.0;

        // Como o eixo Y do canvas é invertido em relação ao mundo 3D/Doom, o seno é subtraído
        const arrowLength = 20;
        const tipX = px + Math.cos(angleRad) * arrowLength;
        const tipY = py - Math.sin(angleRad) * arrowLength;

        // Corpo da seta
        ctx.strokeStyle = '#00e676';
        ctx.fillStyle = '#00e676';
        ctx.lineWidth = 2.5;

        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();

        // Ponta da seta
        const headLength = 8;
        const wing1 = angleRad + Math.PI - 0.45;
        const wing2 = angleRad + Math.PI + 0.45;

        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX + Math.cos(wing1) * headLength, tipY - Math.sin(wing1) * headLength);
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX + Math.cos(wing2) * headLength, tipY - Math.sin(wing2) * headLength);
        ctx.stroke();

        // Círculo na base da posição do jogador
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fill();
    }
}

async function initDebug() {
    const statusText = document.getElementById('status-text');
    const canvas = document.getElementById('map-canvas');
    const ctx = canvas.getContext('2d');

    try {
        if (statusText) statusText.textContent = `Carregando "${WAD_PATH}"...`;

        // 1. Carrega o arquivo WAD via fetch
        const wad = await WadFile.fromUrl(WAD_PATH);

        if (statusText) statusText.textContent = `WAD lido (${wad.type}, ${wad.lumps.length} lumps). Processando mapa ${MAP_NAME}...`;

        // 2. Extrai e valida as tabelas do mapa E1M1
        const map = loadMap(wad, MAP_NAME);

        // 3. Calcula limites e busca o ponto de partida do jogador 1
        const bounds = calculateBounds(map.vertexes);
        const playerStart = map.things.find((t) => t.type === 1);

        // 4. Imprime no console as estatísticas completas
        logMapStatistics(map, bounds, playerStart);

        if (statusText) {
            statusText.textContent = `Mapa ${map.name} carregado: ${map.linedefs.length} linedefs, ${map.vertexes.length} vértices, ${map.sectors.length} setores.`;
        }

        // 5. Renderização e escuta para resize
        const redraw = () => renderMap(canvas, ctx, map, bounds, playerStart);
        redraw();
        window.addEventListener('resize', redraw);

    } catch (err) {
        displayError(`Erro ao carregar ou processar o mapa: ${err.message}`);
    }
}

window.addEventListener('DOMContentLoaded', initDebug);
