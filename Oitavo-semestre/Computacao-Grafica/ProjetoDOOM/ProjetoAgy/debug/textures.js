import { WadFile } from '../src/wad/WadFile.js';
import { loadMap } from '../src/wad/MapData.js';
import { loadTexturesAndFlats } from '../src/wad/Textures.js';

/**
 * Visualizador 2D para depuração de texturas e flats do Doom (E1M1).
 * Não depende de WebGPU, utiliza Canvas 2D puro para validar a decodificação
 * de PLAYPAL (paleta 0), PNAMES, TEXTURE1/2, Patches e Flats.
 */
async function initDebugViewer() {
    const loadingElem = document.getElementById('loading');
    const contentElem = document.getElementById('content');
    const statsBar = document.getElementById('stats-bar');
    const wallGrid = document.getElementById('wall-grid');
    const flatGrid = document.getElementById('flat-grid');
    const wallCountElem = document.getElementById('wall-count');
    const flatCountElem = document.getElementById('flat-count');

    try {
        const wadUrl = new URL('../assets/freedoom1.wad', import.meta.url);
        const wad = await WadFile.fromUrl(wadUrl);
        const map = loadMap(wad, 'E1M1');
        const data = loadTexturesAndFlats(wad, map);

        const { palette, flats, wallTextures, stats } = data;

        // Renderiza Texturas de Parede
        wallCountElem.textContent = String(wallTextures.size);
        for (const [name, tex] of wallTextures.entries()) {
            const card = document.createElement('div');
            card.className = 'texture-card';

            const wrapper = document.createElement('div');
            wrapper.className = 'canvas-wrapper';

            const canvas = document.createElement('canvas');
            canvas.width = tex.width;
            canvas.height = tex.height;

            const ctx = canvas.getContext('2d');
            const imgData = ctx.createImageData(tex.width, tex.height);
            const d = imgData.data;

            let transparentCount = 0;
            const total = tex.width * tex.height;
            for (let i = 0; i < total; i++) {
                const dst = i * 4;
                if (tex.opacity[i] === 0) {
                    // Pixels transparentes desenhados em magenta puro
                    d[dst + 0] = 255;
                    d[dst + 1] = 0;
                    d[dst + 2] = 255;
                    d[dst + 3] = 255;
                    transparentCount++;
                } else {
                    const palIdx = tex.indices[i];
                    d[dst + 0] = palette[palIdx * 3 + 0];
                    d[dst + 1] = palette[palIdx * 3 + 1];
                    d[dst + 2] = palette[palIdx * 3 + 2];
                    d[dst + 3] = 255;
                }
            }
            ctx.putImageData(imgData, 0, 0);
            wrapper.appendChild(canvas);

            const nameElem = document.createElement('div');
            nameElem.className = 'texture-name';
            nameElem.textContent = name;

            const sizeElem = document.createElement('div');
            sizeElem.className = 'texture-size';
            sizeElem.textContent = `${tex.width} × ${tex.height} px`;

            card.appendChild(wrapper);
            card.appendChild(nameElem);
            card.appendChild(sizeElem);

            if (transparentCount > 0) {
                const badge = document.createElement('div');
                badge.className = 'badge-transparent';
                badge.textContent = `Transp: ${transparentCount} px`;
                card.appendChild(badge);
            }

            wallGrid.appendChild(card);
        }

        // Renderiza Flats (Pisos e Tetos)
        flatCountElem.textContent = String(flats.size);
        for (const [name, flatBytes] of flats.entries()) {
            const card = document.createElement('div');
            card.className = 'texture-card';

            const wrapper = document.createElement('div');
            wrapper.className = 'canvas-wrapper';

            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 64;

            const ctx = canvas.getContext('2d');
            const imgData = ctx.createImageData(64, 64);
            const d = imgData.data;

            for (let i = 0; i < 4096; i++) {
                const dst = i * 4;
                const palIdx = flatBytes[i];
                d[dst + 0] = palette[palIdx * 3 + 0];
                d[dst + 1] = palette[palIdx * 3 + 1];
                d[dst + 2] = palette[palIdx * 3 + 2];
                d[dst + 3] = 255;
            }
            ctx.putImageData(imgData, 0, 0);
            wrapper.appendChild(canvas);

            const nameElem = document.createElement('div');
            nameElem.className = 'texture-name';
            nameElem.textContent = name;

            const sizeElem = document.createElement('div');
            sizeElem.className = 'texture-size';
            sizeElem.textContent = `64 × 64 px`;

            card.appendChild(wrapper);
            card.appendChild(nameElem);
            card.appendChild(sizeElem);

            flatGrid.appendChild(card);
        }

        // Atualiza barra de estatísticas
        statsBar.innerHTML = `
            <div class="stats-item">Paredes: <strong>${stats.loadedWalls} / ${stats.neededWalls.length}</strong></div>
            <div class="stats-item">Flats: <strong>${stats.loadedFlats} / ${stats.neededFlats.length}</strong></div>
            <div class="stats-item">Dimensão Máx. Parede: <strong>${stats.maxWallWidth} × ${stats.maxWallHeight}</strong></div>
            <div class="stats-item">Com Transparência: <strong>${stats.transparentTextures.length}</strong></div>
            <div class="stats-item">Faltantes: <strong>${stats.missingWalls.length + stats.missingFlats.length}</strong></div>
        `;

        loadingElem.style.display = 'none';
        contentElem.style.display = 'block';

    } catch (err) {
        loadingElem.style.color = '#e53935';
        loadingElem.textContent = `Erro ao carregar texturas: ${err.message}`;
        console.error(err);
    }
}

window.addEventListener('DOMContentLoaded', initDebugViewer);
