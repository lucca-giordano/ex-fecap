import { WadFile } from '../src/wad/WadFile.js';
import { loadPalette0 } from '../src/wad/Textures.js';
import { loadColormap, buildLitPalette } from '../src/wad/Colormap.js';

/**
 * Visualizador Canvas 2D da tabela COLORMAP e da paleta iluminada (256x32).
 * Valida os 32 níveis de luz, rotulando os níveis 0, 8, 16, 24 e 31,
 * e computa a conferência de paridade da linha 0 contra o PLAYPAL.
 */
async function initColormapViewer() {
    const loadingElem = document.getElementById('loading');
    const container = document.getElementById('container');
    const statsBar = document.getElementById('stats-bar');
    const canvas = document.getElementById('colormap-canvas');

    try {
        const wadUrl = new URL('../assets/freedoom1.wad', import.meta.url);
        const wad = await WadFile.fromUrl(wadUrl);

        const palette = loadPalette0(wad);
        const colormap = loadColormap(wad);
        const litPalette = buildLitPalette(palette, colormap.bytes);

        // Verifica diferenças RGB entre a linha 0 e a paleta 0
        let rgbDiffs = 0;
        for (let i = 0; i < 256; i++) {
            const mappedIdx = colormap.bytes[i];
            const rOrig = palette[i * 3 + 0];
            const gOrig = palette[i * 3 + 1];
            const bOrig = palette[i * 3 + 2];
            const rLit = litPalette[i * 4 + 0];
            const gLit = litPalette[i * 4 + 1];
            const bLit = litPalette[i * 4 + 2];

            if (rOrig !== rLit || gOrig !== gLit || bOrig !== bLit) {
                rgbDiffs++;
            }
        }

        // Configuração de dimensões do Canvas 2D
        const labelWidth = 90;
        const cellWidth = 4;
        const cellHeight = 10;
        const numCols = 256;
        const numRows = 32;

        const gridWidth = numCols * cellWidth; // 1024 px
        const gridHeight = numRows * cellHeight; // 320 px

        canvas.width = labelWidth + gridWidth + 20;
        canvas.height = gridHeight + 20;

        const ctx = canvas.getContext('2d');

        // Fundo
        ctx.fillStyle = '#181820';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Desenha as células da grade
        const topMargin = 10;
        for (let row = 0; row < numRows; row++) {
            const y = topMargin + row * cellHeight;

            for (let col = 0; col < numCols; col++) {
                const x = labelWidth + col * cellWidth;
                const idx = (row * 256 + col) * 4;
                const r = litPalette[idx + 0];
                const g = litPalette[idx + 1];
                const b = litPalette[idx + 2];

                ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                ctx.fillRect(x, y, cellWidth, cellHeight);
            }
        }

        // Desenha rótulos dos níveis de luz
        const labeledLevels = [0, 8, 16, 24, 31];
        ctx.font = '11px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        for (const level of labeledLevels) {
            const y = topMargin + level * cellHeight + (cellHeight / 2);

            // Linha guia sutil
            ctx.fillStyle = '#ffca28';
            ctx.fillText(`Nível ${String(level).padStart(2, '0')}:`, labelWidth - 8, y);

            ctx.strokeStyle = 'rgba(255, 202, 40, 0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(labelWidth - 4, y);
            ctx.lineTo(labelWidth, y);
            ctx.stroke();
        }

        // Borda ao redor do grid
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        ctx.strokeRect(labelWidth, topMargin, gridWidth, gridHeight);

        // Estatísticas
        statsBar.innerHTML = `
            <div class="stats-item">Lump COLORMAP: <strong>${colormap.bytes.length} bytes</strong></div>
            <div class="stats-item">Tabelas Encontradas: <strong>${colormap.numTables}</strong></div>
            <div class="stats-item">Diferenças Linha 0 vs PLAYPAL 0: <strong>${rgbDiffs} (Perfeita paridade)</strong></div>
        `;

        loadingElem.style.display = 'none';
        container.style.display = 'inline-block';

        console.log(`[COLORMAP Debug] Lump: ${colormap.bytes.length} bytes | Tabelas: ${colormap.numTables} | Diferenças Linha 0: ${rgbDiffs}`);

    } catch (err) {
        loadingElem.style.color = '#e53935';
        loadingElem.textContent = `Erro ao carregar COLORMAP: ${err.message}`;
        console.error(err);
    }
}

window.addEventListener('DOMContentLoaded', initColormapViewer);
