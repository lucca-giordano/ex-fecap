import { WadFile } from '../src/wad/WadFile.js';
import { loadMenuAssets } from '../src/menu/MenuAssets.js';
import { composeMenu } from '../src/menu/MenuRenderer.js';

async function initDebugMenu() {
    const gallery = document.getElementById('gallery-container');
    const selSkull = document.getElementById('sel-skull');
    const selLang = document.getElementById('sel-lang');

    gallery.innerHTML = '<p style="color:#aaa;">Carregando freedoom1.wad e assets do menu...</p>';

    const wadUrl = new URL('../assets/freedoom1.wad', import.meta.url);
    let wad, assets;
    try {
        wad = await WadFile.fromUrl(wadUrl);
        assets = loadMenuAssets(wad);
    } catch (err) {
        gallery.innerHTML = `<p style="color:#ef5350;">Erro ao carregar WAD: ${err.message}</p>`;
        console.error(err);
        return;
    }

    gallery.innerHTML = '';

    const screenDefinitions = [
        {
            title: '1. Tela de Título (Menu Principal, started = false)',
            desc: 'Fundo opaco TITLEPIC em (0, 0) com logo M_DOOM e itens com rótulos gráficos ou fonte.',
            state: { currentScreen: 'main', started: false, selectedItem: { main: 0 } },
        },
        {
            title: '2. Menu Principal sobre Cena (started = true)',
            desc: 'Fundo transparente para sobrepor à cena congelada; caveira animada no item selecionado.',
            state: { currentScreen: 'main', started: true, resumeFailed: false, selectedItem: { main: 1 } },
        },
        {
            title: '3. Menu Principal com Aviso de Retomada (resumeFailed = true)',
            desc: 'Exibe "CLICK TO RESUME" centralizado em Y=185 quando a captura de cursor falhou.',
            state: { currentScreen: 'main', started: true, resumeFailed: true, selectedItem: { main: 0 } },
        },
        {
            title: '4. Opções (Termômetros no Nível 5 - Padrão)',
            desc: 'M_OPTTTL no topo, alternâncias de texto em x=60 e x=210, e barras deslizantes com 10 células (incluindo densidade de partículas).',
            state: {
                currentScreen: 'options',
                started: true,
                selectedItem: { options: 7 },
                settings: { visualMode: 'retro', crt: true, lighting: true, particles: true, particleDensity: 5, mouseSensitivityLevel: 5, flySpeedLevel: 5 },
            },
        },
        {
            title: '5. Opções (Termômetros no Nível 1 - Mínimo)',
            desc: 'Valores mínimos: sensibilidade, velocidade e densidade de partículas na primeira célula (posição = 0).',
            state: {
                currentScreen: 'options',
                started: true,
                selectedItem: { options: 7 },
                settings: { visualMode: 'retro', crt: true, lighting: true, particles: true, particleDensity: 1, mouseSensitivityLevel: 1, flySpeedLevel: 1 },
            },
        },
        {
            title: '6. Opções (Termômetros no Nível 10 - Máximo)',
            desc: 'Valores máximos: sensibilidade, velocidade e densidade de partículas na décima célula (posição = 9).',
            state: {
                currentScreen: 'options',
                started: true,
                selectedItem: { options: 7 },
                settings: { visualMode: 'moderno', crt: false, lighting: false, particles: false, particleDensity: 10, mouseSensitivityLevel: 10, flySpeedLevel: 10 },
            },
        },
        {
            title: '7. Submenu Debug',
            desc: 'Opções técnicas da sessão: texturas, cores por setor, backface culling, teste de céu e HUD.',
            state: {
                currentScreen: 'debug',
                started: true,
                selectedItem: { debug: 2 },
                settings: { textured: true, sectorColors: false, culling: true, skyTest: false, hud: true },
            },
        },
        {
            title: '8. READ THIS! (Ajuda e Mapeamento de Teclas)',
            desc: 'Fundo preto, duas colunas com todas as ações e teclas lidas de ACTION_KEYS e rodapé de retorno.',
            state: { currentScreen: 'help', started: true },
        },
    ];

    // Cria os elementos do DOM para cada tela
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = 320;
    offscreenCanvas.height = 200;
    const offCtx = offscreenCanvas.getContext('2d');

    const renderers = [];

    for (const def of screenDefinitions) {
        const card = document.createElement('div');
        card.className = 'screen-card';

        const canvas = document.createElement('canvas');
        canvas.width = 960;
        canvas.height = 600;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        const title = document.createElement('div');
        title.className = 'screen-title';
        title.textContent = def.title;

        const desc = document.createElement('div');
        desc.className = 'screen-desc';
        desc.textContent = def.desc;

        card.appendChild(canvas);
        card.appendChild(title);
        card.appendChild(desc);
        gallery.appendChild(card);

        renderers.push({
            canvas,
            ctx,
            def,
        });
    }

    function renderAll(tempo = 0) {
        const lang = selLang.value;
        const skullMode = selSkull.value;

        // Se for forçado 0 ou 1, ajusta o tempo para produzir aquele índice
        let effectiveTime = tempo;
        if (skullMode === '0') {
            effectiveTime = 0.0; // índice 0
        } else if (skullMode === '1') {
            effectiveTime = (8.0 / 35.0) + 0.01; // índice 1
        }

        for (const item of renderers) {
            const buffer = composeMenu(item.def.state, assets, effectiveTime, lang);
            const imgData = new ImageData(buffer, 320, 200);
            offCtx.putImageData(imgData, 0, 0);

            // Limpa canvas de destino e desenha ampliado 3x com nearest neighbor
            item.ctx.clearRect(0, 0, 960, 600);
            item.ctx.drawImage(offscreenCanvas, 0, 0, 960, 600);
        }
    }

    selSkull.addEventListener('change', () => renderAll(performance.now() / 1000));
    selLang.addEventListener('change', () => renderAll(performance.now() / 1000));

    // Loop de animação para a caveira quando no modo "auto"
    let animId;
    function loop(now) {
        if (selSkull.value === 'auto') {
            renderAll(now / 1000);
        }
        animId = requestAnimationFrame(loop);
    }

    renderAll(0);
    animId = requestAnimationFrame(loop);
}

window.addEventListener('DOMContentLoaded', initDebugMenu);
