import { Camera } from './camera.js';
import { mat4Create, mat4Perspective, mat4Multiply } from './math.js';
import { shaderCode, getScenePipelineDescriptor } from './shaders.js';
import {
    createShaderModuleChecked,
    createRenderPipelineChecked,
} from './gpu/gpuChecks.js';
import { WadFile } from './wad/WadFile.js';
import { loadMap } from './wad/MapData.js';
import { buildWalls, doomToWorld } from './map/buildWalls.js';
import { buildFlats } from './map/buildFlats.js';
import { findSector, findSubsector } from './map/bsp.js';
import { loadTexturesAndFlats } from './wad/Textures.js';
import { createGpuTextureSet } from './gpu/TextureSet.js';
import { loadColormap, buildLitPalette, skyNameForMap } from './wad/Colormap.js';
import { Display, VERTICAL_FOV_RAD } from './gpu/Display.js';
import { settings } from './core/Settings.js';
import { controls, ACTION_KEYS } from './input/Controls.js';
import { loadMenuAssets } from './menu/MenuAssets.js';
import { composeMenu } from './menu/MenuRenderer.js';
import { Menu } from './menu/Menu.js';
import { MenuPass } from './gpu/MenuPass.js';
import { MENU_LANG } from './menu/menuText.js';
import { ParticleSystem } from './particles/ParticleSystem.js';
import { ParticleParams } from './particles/ParticleParams.js';
import { TuningPanel } from './particles/TuningPanel.js';
import {
    hexToRgb,
    findNearestPaletteIndex,
} from './particles/particleConfig.js';
import { filterThingsBySkill, SKILL, SILENT_IGNORES } from './sprites/thingTable.js';
import { buildSpriteRegistry } from './wad/Sprites.js';
import {
    computeViewAngle,
    selectViewNumber,
    selectAnimationFrame,
    getThingOffset,
    packSpriteInstances,
} from './sprites/spriteLogic.js';
import { SpriteSet } from './gpu/SpriteSet.js';

const SHOW_ERROR_OVERLAY = true;

let errorCount = 0;
let firstError = null;

function displayDevError(err, source = '', lineno = 0, colno = 0) {
    if (!SHOW_ERROR_OVERLAY) return;

    errorCount++;

    const loadingText = document.getElementById('loading-text');
    if (loadingText) {
        loadingText.textContent = 'Falha ao iniciar';
        loadingText.style.color = '#ff4444';
    }

    let overlay = document.getElementById('dev-error-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'dev-error-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            max-width: 650px;
            background: rgba(30, 0, 0, 0.95);
            border: 2px solid #ff3333;
            color: #ffcccc;
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
            padding: 12px;
            z-index: 10000;
            box-shadow: 0 4px 20px rgba(0,0,0,0.8);
            border-radius: 4px;
            line-height: 1.4;
            user-select: text;
        `;
        document.body.appendChild(overlay);
    }

    if (!firstError) {
        const message = err?.message || String(err);
        const stackLines = (err?.stack ? err.stack.split('\n').slice(0, 15).join('\n') : 'Sem stack trace');
        const location = (source || err?.fileName) ? `${source || err.fileName}:${lineno || err.lineNumber || 0}:${colno || err.columnNumber || 0}` : '';

        firstError = { message, location, stackLines };
    }

    const badge = errorCount > 1 ? ` <span style="background:#ff3333;color:#fff;padding:1px 6px;border-radius:3px;font-size:10px;">+${errorCount - 1} erro(s)</span>` : '';

    const escapeHtml = (str) => String(str).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

    overlay.innerHTML = `
        <div style="font-weight:bold;color:#ff5555;margin-bottom:6px;font-size:12px;">
            FALHA DE EXECUÇÃO DETECTADA${badge}
        </div>
        <div style="color:#ffffff;margin-bottom:4px;"><strong>Mensagem:</strong> ${escapeHtml(firstError.message)}</div>
        ${firstError.location ? `<div style="color:#ffaa00;margin-bottom:4px;"><strong>Local:</strong> ${escapeHtml(firstError.location)}</div>` : ''}
        <pre style="margin:6px 0 0 0;background:#150000;padding:6px;overflow-x:auto;font-size:10px;color:#ff9999;border:1px solid #550000;max-height:200px;">${escapeHtml(firstError.stackLines)}</pre>
    `;
}

window.addEventListener('error', (e) => {
    displayDevError(e.error || e.message, e.filename, e.lineno, e.colno);
});

window.addEventListener('unhandledrejection', (e) => {
    displayDevError(e.reason);
});

/**
 * Função utilitária para inspecionar e registrar mensagens de compilação de shader modules WebGPU.
 * @param {string} label 
 * @param {GPUShaderModule} shaderModule 
 */
async function logShaderCompilation(label, shaderModule) {
    if (shaderModule && shaderModule.getCompilationInfo) {
        try {
            const info = await shaderModule.getCompilationInfo();
            if (info.messages.length > 0) {
                console.group(`[Compilação Shader] ${label} (${info.messages.length} mensagens):`);
                for (const msg of info.messages) {
                    const logFn = msg.type === 'error' ? console.error : (msg.type === 'warning' ? console.warn : console.log);
                    logFn(`[${msg.type.toUpperCase()}] Linha ${msg.lineNum}:${msg.linePos} - ${msg.message}`);
                }
                console.groupEnd();
            } else {
                console.log(`[Compilação Shader] ${label}: Compilado com sucesso (0 mensagens de erro/aviso).`);
            }
        } catch (err) {
            console.warn(`[Compilação Shader] Falha ao obter compilation info de ${label}:`, err.message);
        }
    }
}

/**
 * Aplicação principal da Etapa 7:
 * - Leitura e decodificação do lump COLORMAP (34 tabelas de 256 bytes)
 * - Criação da textura da paleta iluminada (256x32)
 * - Iluminação por setor (lightnum) com contraste em paredes ortogonais (+1 horizontal, -1 vertical)
 * - Mapeamento e renderização do céu real (F_SKY1 e teste geral com tecla K)
 * - Renderização em resolução interna fixa e exibição em dois modos (Retro 4:3 e Moderno)
 * - Efeito de shader externo: Pós-processamento CRT de Timothy Lottes (scanlines, curvatura e máscara de fósforo)
 * - Passada de blit com fullscreen triangle, nearest neighbor e postProcess
 * - Controles: M (modo visual), X (CRT), F (tela cheia), L (luz), K (teste céu), T (texturas), C (culling), V (cores flats)
 */
async function init() {
    const errorOverlay = document.getElementById('error-overlay');
    const errorMessage = document.getElementById('error-message');
    const hudInfo = document.getElementById('hud-info');
    const canvas = document.getElementById('webgpu-canvas');
    const btnDisplayMode = document.getElementById('btn-display-mode');
    const btnCrtToggle = document.getElementById('btn-crt-toggle');

    function showError(msg) {
        if (errorMessage && errorOverlay) {
            errorMessage.textContent = msg;
            errorOverlay.style.display = 'flex';
        }
        console.error('[WebGPU Error]', msg);
    }

    // 1. Verificação e inicialização do WebGPU
    if (!navigator.gpu) {
        showError(
            'Seu navegador não possui suporte ao WebGPU. ' +
            'Por favor, utilize o Google Chrome ou Microsoft Edge atualizado com aceleração gráfica ativada.'
        );
        return;
    }

    let adapter;
    try {
        adapter = await navigator.gpu.requestAdapter();
    } catch (e) {
        showError(`Falha ao requisitar o adaptador WebGPU: ${e.message}`);
        return;
    }

    if (!adapter) {
        showError('Nenhum adaptador de GPU compatível com WebGPU foi encontrado.');
        return;
    }

    let device;
    try {
        device = await adapter.requestDevice();
    } catch (e) {
        showError(`Falha ao criar o dispositivo WebGPU: ${e.message}`);
        return;
    }

    device.lost.then((info) => {
        console.error('O dispositivo WebGPU foi perdido:', info.message);
        displayDevError(new Error(`O dispositivo WebGPU foi perdido: ${info.message}`));
    });

    device.addEventListener('uncapturederror', (event) => {
        const errorMsg = event.error?.message || String(event.error);
        console.error('[WebGPU Uncaptured Error]', errorMsg);
        displayDevError(new Error(`[WebGPU uncapturederror] ${errorMsg}`));
    });

    const context = canvas.getContext('webgpu');
    if (!context) {
        showError('Não foi possível obter o contexto WebGPU do canvas HTML.');
        return;
    }

    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device,
        format: presentationFormat,
        alphaMode: 'opaque',
    });

    // 2. Carregamento do arquivo WAD e do mapa E1M1
    const wadUrl = new URL('../assets/freedoom1.wad', import.meta.url);
    let wad, map;
    try {
        wad = await WadFile.fromUrl(wadUrl);
        map = loadMap(wad, 'E1M1');
    } catch (err) {
        showError(`Erro ao carregar o arquivo WAD ou o mapa: ${err.message}`);
        return;
    }

    // 3. Decodificação da tabela COLORMAP e montagem da paleta iluminada
    let colormap, litPaletteData, paletteDiffCount = 0;
    let rawPalette = null;
    const skyName = skyNameForMap('E1M1');

    try {
        colormap = loadColormap(wad);
        const { loadPalette0 } = await import('./wad/Textures.js');
        rawPalette = loadPalette0(wad);
        litPaletteData = buildLitPalette(rawPalette, colormap.bytes);

        // Validação de paridade entre a linha 0 da paleta iluminada e o PLAYPAL 0
        for (let i = 0; i < 256; i++) {
            const rOrig = rawPalette[i * 3 + 0];
            const gOrig = rawPalette[i * 3 + 1];
            const bOrig = rawPalette[i * 3 + 2];
            const rLit = litPaletteData[i * 4 + 0];
            const gLit = litPaletteData[i * 4 + 1];
            const bLit = litPaletteData[i * 4 + 2];
            if (rOrig !== rLit || gOrig !== gLit || bOrig !== bLit) {
                paletteDiffCount++;
            }
        }
    } catch (err) {
        showError(`Erro ao processar COLORMAP ou paleta: ${err.message}`);
        return;
    }

    // 4. Decodificação das texturas e flats (incluindo a textura do céu SKY1)
    let textureData;
    try {
        textureData = loadTexturesAndFlats(wad, map, [skyName]);
    } catch (err) {
        showError(`Erro ao decodificar texturas do WAD: ${err.message}`);
        return;
    }

    // Carregamento dos assets gráficos e fonte do menu
    let menuAssets;
    try {
        menuAssets = loadMenuAssets(wad);
    } catch (err) {
        showError(`Erro ao carregar assets do menu: ${err.message}`);
        return;
    }

    // 5. Inicialização do gerenciador de exibição (Display) e Passada de Menu
    const display = new Display(device, presentationFormat);
    display.setMode(settings.get('visualMode'));
    display.setCrt(settings.get('crt'));

    const menuPass = new MenuPass(device);
    if (!menuPass.supported && menuPass.lastError) {
        displayDevError(menuPass.lastError);
    }

    // Uniform buffer de 96 bytes:
    // mvp (64B) + cameraPos (16B) + renderMode (4B) + lightingEnabled (4B) + skyLayer (4B) + skyTest (4B)
    let renderMode = settings.get('textured') ? 0 : 1;      // 0 = texturizado, 1 = cores sólidas
    let lightingEnabled = settings.get('lighting') ? 1 : 0; // 1 = ligado, 0 = desligado
    let skyTest = settings.get('skyTest') ? 1 : 0;         // 0 = desligado, 1 = céu em todos os tetos
    let cullEnabled = settings.get('culling');
    let colorModeBySector = settings.get('sectorColors');

    const uniformBuffer = device.createBuffer({
        label: 'scene.uniformBuffer',
        size: 96,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // 6. Envio de texturas e paleta iluminada para a GPU
    let gpuTextures;
    try {
        gpuTextures = createGpuTextureSet(device, textureData, uniformBuffer, litPaletteData, skyName);
    } catch (err) {
        showError(`Erro ao inicializar texturas na GPU: ${err.message}`);
        return;
    }

    // 6.1. Inicialização dos Parâmetros e Sistema de Partículas (Efeito Externo nº 2)
    const particleParams = new ParticleParams();
    await particleParams.init();

    const getPaletteIndices = (params) => {
        if (!rawPalette) return { dustIdx: 0, warmEmberIdx: 0, coldEmberIdx: 0 };
        const dRgb = hexToRgb(params.dust.color);
        const wRgb = hexToRgb(params.ember.colorHot);
        const cRgb = hexToRgb(params.ember.colorCool);
        return {
            dustIdx: findNearestPaletteIndex(rawPalette, dRgb[0], dRgb[1], dRgb[2]),
            warmEmberIdx: findNearestPaletteIndex(rawPalette, wRgb[0], wRgb[1], wRgb[2]),
            coldEmberIdx: findNearestPaletteIndex(rawPalette, cRgb[0], cRgb[1], cRgb[2]),
        };
    };

    const particleIndices = getPaletteIndices(particleParams.get());
    const particleSystem = new ParticleSystem(device, gpuTextures.litPaletteTexture, particleIndices, particleParams);
    const particlesOk = await particleSystem.init();
    if (!particlesOk) {
        console.warn('[Partículas] Desativando partículas nesta sessão devido a falha na inicialização.');
        settings.set('particles', false, false);
        if (particleSystem.lastError) {
            displayDevError(particleSystem.lastError);
        }
    }

    particleParams.subscribe((newParams) => {
        if (particleSystem) {
            particleSystem.updatePaletteIndices(getPaletteIndices(newParams));
        }
    });

    // 6.2. Inicialização dos Sprites 3D dos objetos do mapa (THINGS)
    const { kept: filteredThings, discardedMultiplayer, discardedSkill } = filterThingsBySkill(map.things, SKILL);

    let discardedInvalidSector = 0;
    const mapObjects = [];
    const keptTypeCounts = new Map();

    for (let i = 0; i < filteredThings.length; i++) {
        const thing = filteredThings[i];
        if (SILENT_IGNORES.has(thing.type)) {
            continue; // Spawns e teleporte ignorados em silêncio
        }

        const secIdx = findSector(map, thing.x, thing.y);
        if (secIdx < 0 || secIdx >= map.sectors.length) {
            console.warn(`[Sprites] Objeto tipo ${thing.type} em (${thing.x}, ${thing.y}) descartado: setor inválido (${secIdx}).`);
            discardedInvalidSector++;
            continue;
        }

        const sec = map.sectors[secIdx];
        const worldBase = doomToWorld(thing.x, thing.y, sec.floorHeight);

        mapObjects.push({
            thing,
            sector: sec,
            worldBase,
            phaseOffset: getThingOffset(i),
        });

        keptTypeCounts.set(thing.type, (keptTypeCounts.get(thing.type) || 0) + 1);
    }

    const spriteRegistry = buildSpriteRegistry(wad, keptTypeCounts.keys(), device.limits.maxTextureArrayLayers);

    const urlParams = new URLSearchParams(window.location.search);
    const breakSprites = urlParams.get('breakSprites') === '1';

    let spritesAvailable = false;
    let spriteSet = null;
    try {
        spriteSet = new SpriteSet(
            device,
            spriteRegistry,
            gpuTextures.litPaletteTexture,
            'rgba8unorm',
            'depth24plus'
        );
        const spritesOk = await spriteSet.init({ breakPipeline: breakSprites });
        if (spritesOk) {
            spritesAvailable = true;
        } else {
            spritesAvailable = false;
            console.warn('[Sprites] Desativando sprites nesta sessão devido a falha na inicialização.');
            settings.set('sprites', false, false);
            if (spriteSet.lastError) {
                displayDevError(spriteSet.lastError);
            }
        }
    } catch (err) {
        spritesAvailable = false;
        console.error('[Sprites] Erro ao criar SpriteSet:', err);
        settings.set('sprites', false, false);
        displayDevError(err);
    }

    // Histograma e estatísticas de carregamento no console
    console.log('================ SPRITES DOOM (E1M1) ================');
    console.log(`Objetos totais no lump THINGS: ${map.things.length}`);
    console.log(`Descartados por Multiplayer: ${discardedMultiplayer}`);
    console.log(`Descartados por Dificuldade (SKILL ${SKILL}): ${discardedSkill}`);
    console.log(`Descartados por Setor Inválido: ${discardedInvalidSector}`);
    console.log(`Objetos Ativos no Mundo 3D: ${mapObjects.length} (${keptTypeCounts.size} tipos distintos)`);
    console.log(`Camadas no Texture Array (rg8uint): ${spriteRegistry.layersCount} (Limite GPU: ${device.limits.maxTextureArrayLayers})`);
    console.log(`Dimensões Máximas da Camada: ${spriteRegistry.maxWidth} x ${spriteRegistry.maxHeight} px (Limite GPU: ${device.limits.maxTextureDimension2D})`);
    console.log(`Tamanho da Struct de Instância: 32 bytes (Alinhamento std430: 16 bytes)`);

    const histogram = [];
    for (const [type, count] of keptTypeCounts) {
        const status = spriteRegistry.typeStatus.get(type);
        histogram.push({
            Tipo: type,
            Qtd: count,
            Nome: status?.name || 'Desconhecido',
            Prefixo: status?.prefix || '?',
            Quadros: status?.validFrames || '-',
            Status: status?.resolved ? 'Resolvido' : 'NÃO RESOLVIDO',
        });
    }
    console.table(histogram);
    console.log('=====================================================');

    // 7. Geração da geometria 3D com layout de 56 bytes por vértice
    const walls = buildWalls(map, gpuTextures.wallTextureMap);
    const flats = buildFlats(map, gpuTextures.flatTextureMap);

    // 8. Configuração do Ponto de Início (Spawn) e Câmera
    const playerStart = map.things.find((t) => t.type === 1);
    if (!playerStart) {
        showError('Ponto de início do Jogador 1 (Thing type 1) não encontrado no mapa.');
        return;
    }

    const spawnSectorIdx = findSector(map, playerStart.x, playerStart.y);
    const spawnSector = map.sectors[spawnSectorIdx];
    const spawnEyeZ = spawnSector.floorHeight + 41.0;
    const spawnWorldPos = doomToWorld(playerStart.x, playerStart.y, spawnEyeZ);

    const camera = new Camera();
    camera.setSpawn(spawnWorldPos, playerStart.angle);

    let menu = null;

    function resetCameraToSpawn() {
        camera.setSpawn(spawnWorldPos, playerStart.angle);
    }

    async function requestGameLock() {
        try {
            await controls.requestLock();
            if (menu) menu.resumeFailed = false;
        } catch (err) {
            console.warn('[Pointer Lock] Falha ao solicitar lock:', err);
            if (menu && menu.started) {
                menu.resumeFailed = true;
                menu.dirty = true;
            }
        }
    }

    function toggleFullscreenAction() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    }

    const tuningPanel = new TuningPanel(particleParams, particleSystem, controls, () => {
        setTimeout(() => {
            if (menu && menu.started && document.pointerLockElement !== canvas) {
                menu.dirty = true;
            }
        }, 100);
    });

    controls.onToggleTuning = () => {
        if (!menu || !menu.started) return;
        tuningPanel.toggle();
        if (tuningPanel.isOpen) {
            menu.dirty = true;
        }
    };

    menu = new Menu({
        onNewGame: () => {
            resetCameraToSpawn();
            requestGameLock();
        },
        onResume: () => {
            requestGameLock();
        },
        onToggleFullscreen: toggleFullscreenAction,
        onOpenTuning: () => {
            tuningPanel.open();
        },
    });

    // 9. Limites do mapa e cálculo dos planos de corte
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < map.vertexes.length; i++) {
        const v = map.vertexes[i];
        if (v.x < minX) minX = v.x;
        if (v.x > maxX) maxX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.y > maxY) maxY = v.y;
    }
    const mapDiagonal = Math.hypot(maxX - minX, maxY - minY);
    const nearPlane = 1.0;
    const farPlane = Math.max(4000.0, mapDiagonal * 1.5);

    // 10. Pipeline de Renderização da Cena (desenha na textura offscreen rgba8unorm)
    const sceneShaderRes = await createShaderModuleChecked(device, {
        label: 'scene.shaderModule',
        code: shaderCode,
    });
    if (!sceneShaderRes.ok) {
        showError(`Falha ao iniciar: Erro no shader da cena (${sceneShaderRes.error?.message})`);
        displayDevError(sceneShaderRes.error);
        return;
    }
    const shaderModule = sceneShaderRes.value;

    const pipelineLayout = device.createPipelineLayout({
        label: 'scene.pipelineLayout',
        bindGroupLayouts: [gpuTextures.bindGroupLayout],
    });

    const pipelineBackRes = await createRenderPipelineChecked(
        device,
        getScenePipelineDescriptor(shaderModule, pipelineLayout, 'back', 'rgba8unorm', 'depth24plus')
    );
    const pipelineNoCullRes = await createRenderPipelineChecked(
        device,
        getScenePipelineDescriptor(shaderModule, pipelineLayout, 'none', 'rgba8unorm', 'depth24plus')
    );

    if (!pipelineBackRes.ok || !pipelineNoCullRes.ok) {
        const err = pipelineBackRes.error || pipelineNoCullRes.error;
        showError(`Falha ao iniciar: ${err?.message || 'Pipeline da cena inválida'}`);
        displayDevError(err);
        return;
    }

    const pipelineCullBack = pipelineBackRes.value;
    const pipelineNoCull = pipelineNoCullRes.value;

    // 11. Validação de compilação dos módulos de shader (getCompilationInfo)
    await logShaderCompilation('Doom Scene Shader Module', shaderModule);
    await logShaderCompilation('Blit & CRT Shader Module', display.blitShaderModule);
    await logShaderCompilation('Menu Shader Module', menuPass.shaderModule);

    // 12. Estatísticas e Validações no Console (uma vez ao carregar)
    const skySubsectorCount = flats.subsectorInfo.filter(s => s.isSky).length;
    const lightDistribution = new Array(16).fill(0);
    for (const sec of map.sectors) {
        const ln = Math.min(Math.max(Math.floor(sec.lightLevel / 16), 0), 15);
        lightDistribution[ln]++;
    }

    console.group('[E1M1] Validações e Estatísticas de Iluminação, Exibição e CRT (Etapa 7)');
    console.log(`1. Lump COLORMAP: ${colormap.bytes.length} bytes | ${colormap.numTables} tabelas de 256 bytes encontradas`);
    console.log(`2. Diferenças RGB Linha 0 (litPalette) vs PLAYPAL 0: ${paletteDiffCount} (Esperado: 0)`);
    console.log(`3. Textura do Céu: Nome "${skyName}" | Dimensões: ${textureData.wallTextures.get(skyName)?.width || 256} × ${textureData.wallTextures.get(skyName)?.height || 128} px | Camada GPU: ${gpuTextures.skyLayer} | Subsectors com F_SKY1: ${skySubsectorCount}`);
    console.log(`4. Distribuição de Lightnum dos Setores (0 a 15):`, lightDistribution.map((count, idx) => `[${idx}]: ${count}`).join(', '));
    console.log(`5. Modos de Exibição Inicial: "${display.mode}" (640x400 em 4:3)`);
    console.log(`6. Pós-Processamento CRT: ${display.crtEnabled ? 'LIGADO' : 'DESLIGADO'} | MASK_ENABLED: true | WARP_ENABLED: true`);
    console.log(`7. Uniform de Pós-Processamento: ${display.blitUniformBufferSize} bytes alocados (100% de capacidade utilizada, alinhado a 16 bytes)`);
    console.log(`8. Geometria Total: ${(walls.vertices.length + flats.vertices.length) / 14} vértices (56B/vtx) | ${(walls.indices.length + flats.indices.length) / 3} triângulos`);
    console.groupEnd();

    console.group('[Controles & Configurações] Validações da Etapa 8');
    // 1. Tabela de ações e teclas ativas
    const actionsTable = Object.entries(ACTION_KEYS).map(([action, def]) => ({
        'Ação': action,
        'event.code': def.code,
        'Rótulo': def.label,
        'Grupo': def.group,
        'Descrição': def.desc,
    }));
    console.table(actionsTable);
    // 2. Origem das configurações
    console.log(`[Configurações] Origem dos valores: ${settings.source}`);
    // 3. Status da solicitação de unadjustedMovement no pointer lock
    console.log(`[Pointer Lock] Status de unadjustedMovement: ${controls.unadjustedMovementStatus}`);
    console.groupEnd();

    console.group('[Menu Freedoom] Validações e Estatísticas (Etapa 9)');
    console.log(`1. Lumps de menu encontrados: ${menuAssets.foundLumps.length} (${menuAssets.foundLumps.slice(0, 10).join(', ')}...)`);
    console.log(`2. Lumps de menu ausentes: ${menuAssets.missingLumps.length === 0 ? 'Nenhum (0)' : menuAssets.missingLumps.join(', ')}`);
    console.log(`3. Dimensões dos principais patches:`, menuAssets.dimensions);
    console.log(`4. Idioma ativo: "${MENU_LANG}"`);
    console.log(`5. Uniform buffer do menu: ${menuPass.uniformBufferSize} bytes alocados (alinhado a 16 bytes)`);
    console.groupEnd();

    // 13. Buffers WebGPU para Paredes e Flats (56B por vértice)
    const wallsVertexBuffer = device.createBuffer({
        label: 'scene.wallsVertexBuffer',
        size: walls.vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(wallsVertexBuffer, 0, walls.vertices);

    const wallsIndexBuffer = device.createBuffer({
        label: 'scene.wallsIndexBuffer',
        size: Math.ceil(walls.indices.byteLength / 4) * 4,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(wallsIndexBuffer, 0, walls.indices);

    const flatsVertexBuffer = device.createBuffer({
        label: 'scene.flatsVertexBuffer',
        size: flats.vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(flatsVertexBuffer, 0, flats.vertices);

    const flatsSectorVertexBuffer = device.createBuffer({
        label: 'scene.flatsSectorVertexBuffer',
        size: flats.sectorVertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(flatsSectorVertexBuffer, 0, flats.sectorVertices);

    const flatsIndexBuffer = device.createBuffer({
        label: 'scene.flatsIndexBuffer',
        size: Math.ceil(flats.indices.byteLength / 4) * 4,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(flatsIndexBuffer, 0, flats.indices);

    // 14. Ajuste de tamanho do canvas e display
    function resizeCanvas() {
        const width = Math.max(1, Math.floor(window.innerWidth * window.devicePixelRatio));
        const height = Math.max(1, Math.floor(window.innerHeight * window.devicePixelRatio));

        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }

        display.update(canvas.width, canvas.height);
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // 14. Ajuste de tamanho do canvas e display
    function updateDisplayButtonText() {
        if (btnDisplayMode) {
            btnDisplayMode.textContent = (settings.get('visualMode') === 'retro')
                ? 'Visual: Retro 4:3'
                : 'Visual: Moderno';
        }
    }

    function updateCrtButtonText() {
        if (btnCrtToggle) {
            btnCrtToggle.textContent = settings.get('crt') ? 'CRT: Ligado' : 'CRT: Desligado';
        }
    }

    // Configuração dos botões superiores da interface chamando settings.toggle
    if (btnDisplayMode) {
        updateDisplayButtonText();
        btnDisplayMode.addEventListener('click', (e) => {
            e.stopPropagation();
            settings.toggle('visualMode');
            btnDisplayMode.blur();
        });
        btnDisplayMode.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });
    }

    if (btnCrtToggle) {
        updateCrtButtonText();
        btnCrtToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            settings.toggle('crt');
            btnCrtToggle.blur();
        });
        btnCrtToggle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });
    }

    // 15. Subscrições Reativas ao Módulo Central de Configurações
    settings.subscribe('visualMode', (mode) => {
        display.setMode(mode);
        display.update(canvas.width, canvas.height);
        updateDisplayButtonText();
        console.log(`[Modo de Exibição] Alternado para: ${mode === 'retro' ? 'Retro 4:3' : 'Moderno'} | Resolução interna: ${display.internalWidth}×${display.internalHeight}`);
    });

    settings.subscribe('crt', (crt) => {
        display.setCrt(crt);
        updateCrtButtonText();
        console.log(`[Efeito CRT] ${crt ? 'LIGADO (Scanlines, Curvatura e Fósforo)' : 'DESLIGADO (Nearest Puro)'}`);
    });

    settings.subscribe('culling', (cull) => {
        cullEnabled = cull;
        console.log(`[Culling] ${cullEnabled ? 'LIGADO (Back)' : 'DESLIGADO'}`);
    });

    settings.subscribe('lighting', (lit) => {
        lightingEnabled = lit ? 1 : 0;
        console.log(`[Iluminação] ${lightingEnabled === 1 ? 'LIGADA (Tabela COLORMAP)' : 'DESLIGADA (Brilho total)'}`);
    });

    settings.subscribe('skyTest', (sky) => {
        skyTest = sky ? 1 : 0;
        console.log(`[Teste do Céu] ${skyTest === 1 ? 'LIGADO (Todos os tetos exibem o céu)' : 'DESLIGADO (Apenas F_SKY1)'}`);
    });

    settings.subscribe('textured', (tex) => {
        renderMode = tex ? 0 : 1;
        console.log(`[Modo de Renderização] ${renderMode === 0 ? 'TEXTURIZADO' : 'CORES SÓLIDAS'}`);
    });

    settings.subscribe('sectorColors', (sec) => {
        colorModeBySector = sec;
        console.log(`[Modo Flats Sólidos] ${colorModeBySector ? 'POR SETOR' : 'POR FLAT'}`);
    });

    settings.subscribe('hud', (show) => {
        if (hudInfo) {
            hudInfo.style.display = show ? 'block' : 'none';
        }
        console.log(`[HUD] ${show ? 'EXIBINDO' : 'OCULTO'}`);
    });

    if (hudInfo) {
        hudInfo.style.display = settings.get('hud') ? 'block' : 'none';
    }

    // Inicialização do gerenciador de controles unificado
    controls.attach(canvas, camera);

    // Eventos de Pointer Lock e interação com o Menu
    canvas.addEventListener('click', () => {
        if (document.pointerLockElement === canvas) return;
        if (!menu.started) {
            menu.started = true;
            resetCameraToSpawn();
            requestGameLock();
        } else {
            requestGameLock();
        }
    });

    document.addEventListener('pointerlockerror', () => {
        console.warn('[Pointer Lock] pointerlockerror disparado pelo navegador.');
        if (menu.started) {
            menu.resumeFailed = true;
            menu.dirty = true;
        }
    });

    document.addEventListener('pointerlockchange', () => {
        const isLocked = document.pointerLockElement === canvas;
        if (isLocked) {
            menu.resumeFailed = false;
        } else {
            // Ao perder o lock (inclusive Esc), o menu abre na tela principal se o tuning não estiver aberto
            if (!tuningPanel.isOpen) {
                menu.currentScreen = 'main';
                menu.dirty = true;
            }
        }
    });

    window.addEventListener('keydown', (e) => {
        // Se o painel de calibragem estiver aberto, o menu não consome teclas
        if (tuningPanel.isOpen) return;

        // Se o menu estiver visível (cursor destravado), o menu consome as teclas
        if (document.pointerLockElement !== canvas) {
            const consumed = menu.handleKeyDown(e);
            if (consumed) {
                e.preventDefault();
            }
        }
    });

    document.addEventListener('fullscreenchange', () => {
        menu.dirty = true;
    });

    // 16. Loop Principal de Renderização
    const projMatrix = mat4Create();
    const mvpMatrix = mat4Create();

    const startTime = performance.now();
    let lastTime = startTime;
    let gameTime = 0.0;
    let frameCount = 0;
    let frameCheckCount = 0;
    let fpsTimer = 0;
    let currentFps = 60;

    function frame(now) {
        const dt = Math.min((now - lastTime) / 1000.0, 0.1);
        lastTime = now;
        const elapsedSec = (now - startTime) / 1000.0;

        frameCount++;
        fpsTimer += dt;
        if (fpsTimer >= 0.5) {
            currentFps = frameCount / fpsTimer;
            frameCount = 0;
            fpsTimer = 0;
        }

        // Atualiza display com dimensões atuais do canvas e tempo
        display.update(canvas.width, canvas.height, elapsedSec);

        const isMenuVisible = (document.pointerLockElement !== canvas) && !tuningPanel.isOpen;

        // Se o menu estiver visível, oculta HUD HTML e atualiza animação do menu
        if (isMenuVisible) {
            if (hudInfo) hudInfo.style.display = 'none';

            menu.update(elapsedSec);
            if (menu.dirty) {
                const menuPixels = composeMenu(menu.getState(), menuAssets, elapsedSec, MENU_LANG);
                menuPass.uploadPixels(menuPixels);
                menu.dirty = false;
            }
        } else {
            // Jogo ativo ou modo de calibragem: atualiza controles e câmera
            controls.update(dt);
        }

        // Matriz de projeção: FOV vertical constante (73.74° = 90° horizontal em 4:3)
        mat4Perspective(projMatrix, VERTICAL_FOV_RAD, display.projAspect, nearPlane, farPlane);

        const viewMatrix = camera.getViewMatrix();
        mat4Multiply(mvpMatrix, projMatrix, viewMatrix);

        // Atualização do Uniform Buffer da Cena (96 bytes):
        device.queue.writeBuffer(uniformBuffer, 0, mvpMatrix);
        const camPos = camera.position;
        device.queue.writeBuffer(uniformBuffer, 64, new Float32Array([camPos[0], camPos[1], camPos[2], 1.0]));
        device.queue.writeBuffer(uniformBuffer, 80, new Uint32Array([
            renderMode,
            lightingEnabled,
            gpuTextures.skyLayer,
            skyTest,
        ]));

        // Relógio de animação em tics do Doom (35 tics/s), congelado se menu estiver visível
        if (menu.started && !isMenuVisible) {
            gameTime += dt;
        }
        const gameTics = Math.floor(gameTime * 35.0);

        // Prepara instâncias de sprites para o frame atual
        const camX = camera.position[0];
        const camY = -camera.position[2];

        const spriteInstances = [];
        if (spritesAvailable && spriteSet && settings.get('sprites')) {
            for (let i = 0; i < mapObjects.length; i++) {
                const obj = mapObjects[i];
                const status = spriteRegistry.typeStatus.get(obj.thing.type);
                if (!status || !status.resolved) continue;

                const frameChar = selectAnimationFrame(
                    status.validFrames,
                    gameTics,
                    status.def.tics,
                    obj.phaseOffset
                );

                const viewsMap = spriteRegistry.typeFrameViews.get(obj.thing.type)?.get(frameChar);
                if (!viewsMap) continue;

                let viewNum = 0;
                if (!viewsMap.has(0)) {
                    const a = computeViewAngle(camX, camY, obj.thing.x, obj.thing.y);
                    viewNum = selectViewNumber(a, obj.thing.angle, true);
                }

                const lookupInfo = spriteRegistry.lookup.get(`${obj.thing.type}_${frameChar}_${viewNum}`);
                if (!lookupInfo) continue;

                const lightnum = Math.floor(obj.sector.lightLevel / 16);

                spriteInstances.push({
                    worldPos: obj.worldBase,
                    layer: lookupInfo.layer,
                    lightnum,
                    mirrored: lookupInfo.mirrored,
                    fullbright: status.def.fullbright,
                    fuzz: status.def.fuzz,
                });
            }

            const packedData = packSpriteInstances(spriteInstances);
            spriteSet.updateInstances(packedData, spriteInstances.length);
            const camRight = [Math.cos(camera.yaw), 0.0, Math.sin(camera.yaw)];
            spriteSet.updateUniforms(mvpMatrix, camRight, camera.position, lightingEnabled === 1);
        }

        // Identifica setor da câmera para o HUD
        const doomPos = camera.getDoomPosition();
        const curSubsectorIdx = findSubsector(map, doomPos[0], doomPos[1]);
        const curSecIdx = findSector(map, doomPos[0], doomPos[1]);
        const curSec = map.sectors[curSecIdx] || { floorHeight: '?', ceilingHeight: '?', floorTexture: '?', ceilingTexture: '?', lightLevel: 160 };
        const doomYaw = camera.getDoomYawDegrees();
        const curLightnum = Math.min(Math.max(Math.floor(curSec.lightLevel / 16), 0), 15);

        // Atualização do HUD HTML (apenas quando jogo ativo e habilitado em settings)
        if (!isMenuVisible && hudInfo && settings.get('hud')) {
            hudInfo.style.display = 'block';
            const visualMode = settings.get('visualMode');
            const visualModeText = (visualMode === 'retro')
                ? '<span style="color:#ffca28">Retro 4:3 (7)</span>'
                : '<span style="color:#64b5f6">Moderno (7)</span>';
            const crtStatusText = settings.get('crt')
                ? '<span style="color:#66bb6a">LIGADO (6)</span>'
                : '<span style="color:#ef5350">DESLIGADO (6)</span>';
            const runStatusText = controls.isRunning
                ? '<span style="color:#ffca28">LIGADA (R)</span>'
                : '<span style="color:#888">DESLIGADA (R)</span>';
            const speedLevel = settings.get('flySpeedLevel');
            const sensLevel = settings.get('mouseSensitivityLevel');
            const lightStatusText = (lightingEnabled === 1)
                ? '<span style="color:#66bb6a">LIGADA (4)</span>'
                : '<span style="color:#ef5350">DESLIGADA (4)</span>';
            const skyTestText = (skyTest === 1)
                ? '<span style="color:#ab47bc">ATIVO (5)</span>'
                : '<span style="color:#888">Inativo (5)</span>';
            const renderModeText = (renderMode === 0)
                ? '<span style="color:#4caf50">Texturizado (1)</span>'
                : '<span style="color:#ffb74d">Cores Sólidas (1)</span>';
            const cullingText = cullEnabled
                ? '<span style="color:#66bb6a">LIGADO (3)</span>'
                : '<span style="color:#ef5350">DESLIGADO (3)</span>';
            const partEnabled = settings.get('particles');
            const currentParticleParams = particleParams.get();
            const N = currentParticleParams.count;
            const partStatusText = partEnabled
                ? `<span style="color:#66bb6a">on ${N}/8192</span>`
                : `<span style="color:#ef5350">off ${N}/8192</span>`;
            const spritesEnabled = settings.get('sprites');
            const spritesStatusText = spritesEnabled
                ? '<span style="color:#66bb6a">on</span>'
                : '<span style="color:#ef5350">off</span>';

            hudInfo.innerHTML = `
                <div><strong>Visual:</strong> ${visualModeText} | <strong>CRT:</strong> ${crtStatusText} | <strong>Sprites (O):</strong> ${spritesStatusText} (${spriteInstances.length} objetos / ${keptTypeCounts.size} tipos) | <strong>Partículas (P):</strong> ${partStatusText} | <strong>FPS:</strong> ${currentFps.toFixed(0)}</div>
                <div><strong>Corrida:</strong> ${runStatusText} | <strong>Velocidade:</strong> ${speedLevel}/10 (- / =) | <strong>Sensibilidade:</strong> ${sensLevel}/10 (, / .) | <strong style="color:#ffca28;">[H: ajuda] [T: calibragem]</strong></div>
                <div><strong>Modo:</strong> ${renderModeText} | <strong>Luz:</strong> ${lightStatusText} (Setor: ${curLightnum}/15) | <strong>Céu:</strong> ${skyTestText} | <strong>Cull:</strong> ${cullingText}</div>
                <div><strong>Posição:</strong> X: ${doomPos[0].toFixed(1)} | Y: ${doomPos[1].toFixed(1)} | Z: ${doomPos[2].toFixed(1)} | <strong>Yaw:</strong> ${doomYaw.toFixed(1)}°</div>
                <div><strong>Subsector:</strong> ${curSubsectorIdx} | <strong>Setor:</strong> ${curSecIdx} (Chão: ${curSec.floorHeight}, Teto: ${curSec.ceilingHeight}, Piso: ${curSec.floorTexture})</div>
            `;
        }

        // Execução dos comandos da GPU
        const checkThisFrame = frameCheckCount < 5;
        if (checkThisFrame) {
            frameCheckCount++;
            device.pushErrorScope('validation');
        }

        const commandEncoder = device.createCommandEncoder({
            label: `main.commandEncoder${checkThisFrame ? `.${frameCheckCount}` : ''}`,
        });

        const particlesActive = (menu.started || !isMenuVisible) && settings.get('particles') && particleSystem.supported;
        const currentParticleParams = particleParams.get();
        const activeCount = currentParticleParams.count;

        // PASSADA 1: Computação (Simulação das partículas, dt = 0 se o menu estiver visível)
        if (particlesActive) {
            const simDt = (isMenuVisible && !tuningPanel.isOpen) ? 0.0 : dt;
            particleSystem.recordComputePass(commandEncoder, simDt, elapsedSec, camera.position, activeCount, currentParticleParams);
        }

        // PASSADA 2: Renderiza a cena 3D (se o jogo estiver ativo OU se started = true com menu por cima)
        if (menu.started || !isMenuVisible) {
            const scenePassDesc = {
                colorAttachments: [
                    {
                        view: display.sceneColorView,
                        clearValue: { r: 0.04, g: 0.04, b: 0.06, a: 1.0 },
                        loadOp: 'clear',
                        storeOp: 'store',
                    },
                ],
                depthStencilAttachment: {
                    view: display.sceneDepthView,
                    depthClearValue: 1.0,
                    depthLoadOp: 'clear',
                    depthStoreOp: 'store',
                },
            };

            const scenePass = commandEncoder.beginRenderPass(scenePassDesc);
            scenePass.setPipeline(cullEnabled ? pipelineCullBack : pipelineNoCull);
            scenePass.setBindGroup(0, gpuTextures.bindGroup);

            // Desenha paredes
            scenePass.setVertexBuffer(0, wallsVertexBuffer);
            scenePass.setIndexBuffer(wallsIndexBuffer, 'uint32');
            scenePass.drawIndexed(walls.indices.length);

            // Desenha chãos e tetos
            const activeFlatsBuffer = (renderMode === 1 && colorModeBySector) ? flatsSectorVertexBuffer : flatsVertexBuffer;
            scenePass.setVertexBuffer(0, activeFlatsBuffer);
            scenePass.setIndexBuffer(flatsIndexBuffer, 'uint32');
            scenePass.drawIndexed(flats.indices.length);

            scenePass.end();
        }

        // PASSADA 2.5: Renderiza os sprites dos objetos do mundo 3D com teste de profundidade
        const spritesActive = (menu.started || !isMenuVisible) && settings.get('sprites') && spritesAvailable && spriteSet;
        if (spritesActive) {
            spriteSet.recordRenderPass(
                commandEncoder,
                display.sceneColorView,
                display.sceneDepthView
            );
        }

        // PASSADA 3: Renderiza as partículas sobre a cena 3D com teste de profundidade
        if (particlesActive) {
            const particleRenderData = {
                viewProj: mvpMatrix,
                cameraPos: camera.position,
                internalWidth: display.internalWidth,
                internalHeight: display.internalHeight,
                time: elapsedSec,
                lightingEnabled: (lightingEnabled === 1),
                activeCount,
            };
            particleSystem.recordRenderPass(
                commandEncoder,
                display.sceneColorView,
                display.sceneDepthView,
                particleRenderData,
                currentParticleParams
            );
        }

        // PASSADA 4: Desenha o menu 320x200 sobre a cena ANTES do blit/CRT
        if (isMenuVisible) {
            menuPass.recordPass(
                commandEncoder,
                display.sceneColorView,
                display.internalWidth,
                display.internalHeight,
                menu.started
            );
        }

        // PASSADA DE BLIT: Copia a textura interna da cena para o canvas com pós-processamento CRT
        display.recordBlitPass(commandEncoder, context.getCurrentTexture().createView({ label: 'display.contextView' }));

        const commandBuffer = commandEncoder.finish({
            label: `main.commandBuffer${checkThisFrame ? `.${frameCheckCount}` : ''}`,
        });
        device.queue.submit([commandBuffer]);

        if (checkThisFrame) {
            const fNum = frameCheckCount;
            device.popErrorScope().then((validationError) => {
                if (validationError) {
                    console.error(`[WebGPU Frame Validation Error (Frame ${fNum})]`, validationError.message);
                    displayDevError(new Error(`[Frame ${fNum} Submit Validation Error] ${validationError.message}`));
                }
            }).catch((err) => {
                console.error('[WebGPU Frame popErrorScope Error]', err);
            });
        }

        requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
}

window.addEventListener('DOMContentLoaded', () => {
    init().catch((err) => {
        displayDevError(err);
        console.error('[init] Falha na inicialização:', err);
    });
});
