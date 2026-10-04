import { WadFile } from '../src/wad/WadFile.js';
import { loadMap } from '../src/wad/MapData.js';
import { loadPalette0 } from '../src/wad/Textures.js';
import { THING_TABLE, filterThingsBySkill } from '../src/sprites/thingTable.js';
import { buildSpriteRegistry } from '../src/wad/Sprites.js';

/**
 * Visualizador 2D para depuração e inspeção dos sprites do Doom (E1M1).
 * Não depende de WebGPU: utiliza Canvas 2D puro para validar a decodificação dos lumps,
 * a interpretação de rotações (vistas 1 a 8), espelhamento horizontal e âncoras (offsets).
 */
async function initDebugSprites() {
    const statsBar = document.getElementById('stats-bar');
    const content = document.getElementById('content');

    try {
        const wadUrl = new URL('../assets/freedoom1.wad', import.meta.url);
        const wad = await WadFile.fromUrl(wadUrl);
        const palette = loadPalette0(wad);
        const map = loadMap(wad, 'E1M1');

        // Filtra coisas por habilidade 3
        const { kept, discardedMultiplayer, discardedSkill } = filterThingsBySkill(map.things, 3);

        // Contagem de objetos por tipo no E1M1
        const mapTypeCounts = new Map();
        for (const th of kept) {
            mapTypeCounts.set(th.type, (mapTypeCounts.get(th.type) || 0) + 1);
        }

        // Constrói registro para todos os tipos conhecidos
        const allTypes = Object.keys(THING_TABLE).map(Number);
        const registry = buildSpriteRegistry(wad, allTypes);

        // Atualiza barra de estatísticas
        let resolvedCount = 0;
        let unresolvedCount = 0;
        for (const type of mapTypeCounts.keys()) {
            const status = registry.typeStatus.get(type);
            if (status && status.resolved) {
                resolvedCount++;
            } else if (!status || !status.ignored) {
                unresolvedCount++;
            }
        }

        statsBar.innerHTML = `
            <strong>WAD:</strong> freedoom1.wad | <strong>Lumps de Sprite:</strong> ${registry.spriteLumpsCount} | <strong>Camadas Texture Array:</strong> ${registry.layersCount}<br>
            <strong>Dimensões Máximas:</strong> ${registry.maxWidth} x ${registry.maxHeight} px | <strong>Entidades E1M1 (Skill 3):</strong> ${kept.length} (Descartados: ${discardedMultiplayer} multi, ${discardedSkill} dif.)<br>
            <strong>Tipos no Mapa:</strong> ${mapTypeCounts.size} (${resolvedCount} resolvidos, ${unresolvedCount} não resolvidos)
        `;

        // Ordena os tipos para exibição: primeiro os presentes no mapa, depois os demais
        const sortedTypes = allTypes.sort((a, b) => {
            const countA = mapTypeCounts.get(a) || 0;
            const countB = mapTypeCounts.get(b) || 0;
            if (countA > 0 && countB === 0) return -1;
            if (countB > 0 && countA === 0) return 1;
            return a - b;
        });

        for (const type of sortedTypes) {
            const def = THING_TABLE[type];
            const countInMap = mapTypeCounts.get(type) || 0;
            const status = registry.typeStatus.get(type);

            const card = document.createElement('div');
            card.className = `sprite-card ${(!status || !status.resolved) ? 'unresolved' : ''}`;

            const header = document.createElement('div');
            header.className = 'card-header';

            const title = document.createElement('div');
            title.className = 'card-title';
            title.innerHTML = `${def ? def.name : 'Tipo Desconhecido'} <span class="type-badge">Tipo ${type}</span>`;

            const meta = document.createElement('div');
            meta.className = 'card-meta';
            meta.innerHTML = `Prefixo: <strong>${def ? def.prefix : '?'}</strong> | No mapa: <strong>${countInMap}</strong> | Quadros: <strong>${status?.validFrames || 'Nenhum'}</strong>`;

            header.appendChild(title);
            header.appendChild(meta);
            card.appendChild(header);

            if (!status || !status.resolved) {
                const errDiv = document.createElement('div');
                errDiv.style.color = '#ff6b6b';
                errDiv.style.fontSize = '14px';
                errDiv.textContent = `Não resolvido: ${status ? status.reason : 'Não configurado'}`;
                card.appendChild(errDiv);
                content.appendChild(card);
                continue;
            }

            // Fileira com as 8 vistas do primeiro quadro válido
            const firstFrame = status.validFrames[0];
            const viewsMap = registry.typeFrameViews.get(type)?.get(firstFrame);

            const viewsRow = document.createElement('div');
            viewsRow.className = 'views-row';

            // Verifica se possui rotações (vistas 1 a 8) ou vista única (vista 0)
            const isSingleView = viewsMap && viewsMap.has(0);
            const viewsToRender = isSingleView ? [0] : [1, 2, 3, 4, 5, 6, 7, 8];

            for (const viewNum of viewsToRender) {
                const vInfo = viewsMap ? viewsMap.get(viewNum) : null;
                const slot = document.createElement('div');
                slot.className = 'view-slot';

                if (!vInfo) {
                    slot.innerHTML = `<div style="color:#666;font-size:12px;padding:20px;">Vista ${viewNum}<br>Ausente</div>`;
                    viewsRow.appendChild(slot);
                    continue;
                }

                const dec = registry.decodedLumps.get(vInfo.lumpIndex);
                if (!dec) {
                    slot.innerHTML = `<div style="color:#f44336;font-size:12px;">Falha ao decodificar</div>`;
                    viewsRow.appendChild(slot);
                    continue;
                }

                // Criação do Canvas 3x
                const SCALE = 3;
                const canvas = document.createElement('canvas');
                canvas.width = dec.width * SCALE;
                canvas.height = dec.height * SCALE;

                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = false;

                // Cria ImageData na resolução original
                const imgData = ctx.createImageData(dec.width, dec.height);
                const d = imgData.data;

                for (let x = 0; x < dec.width; x++) {
                    const srcCol = vInfo.mirrored ? (dec.width - 1 - x) : x;
                    for (let y = 0; y < dec.height; y++) {
                        const srcIdx = y * dec.width + srcCol;
                        const dstIdx = (y * dec.width + x) * 4;

                        if (dec.opacity[srcIdx] > 0) {
                            const palIdx = dec.indices[srcIdx];
                            d[dstIdx + 0] = palette[palIdx * 3 + 0];
                            d[dstIdx + 1] = palette[palIdx * 3 + 1];
                            d[dstIdx + 2] = palette[palIdx * 3 + 2];
                            d[dstIdx + 3] = 255;
                        } else {
                            d[dstIdx + 3] = 0; // Transparente
                        }
                    }
                }

                // Desenha ImageData ampliada para o Canvas 3x
                const offscreen = document.createElement('canvas');
                offscreen.width = dec.width;
                offscreen.height = dec.height;
                offscreen.getContext('2d').putImageData(imgData, 0, 0);

                ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);

                // Desenha a cruz de marcação da origem (leftOffset, topOffset)
                // Doom original: leftOffset é o X do pivô a partir da esquerda, topOffset é a altura a partir do topo
                const crossX = dec.leftOffset * SCALE;
                const crossY = dec.topOffset * SCALE;

                ctx.strokeStyle = '#00ffff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                // Linha horizontal
                ctx.moveTo(crossX - 6, crossY);
                ctx.lineTo(crossX + 6, crossY);
                // Linha vertical
                ctx.moveTo(crossX, crossY - 6);
                ctx.lineTo(crossX, crossY + 6);
                ctx.stroke();

                const container = document.createElement('div');
                container.className = 'canvas-container';
                container.appendChild(canvas);

                const label = document.createElement('div');
                label.className = 'view-label';
                label.innerHTML = `Vista ${viewNum === 0 ? 'Única (0)' : viewNum}${vInfo.mirrored ? ' (Espelhada)' : ''}`;

                const lumpLabel = document.createElement('div');
                lumpLabel.className = 'view-lump-name';
                lumpLabel.textContent = `${vInfo.lumpName} (${dec.width}x${dec.height})`;

                slot.appendChild(container);
                slot.appendChild(label);
                slot.appendChild(lumpLabel);
                viewsRow.appendChild(slot);
            }

            card.appendChild(viewsRow);
            content.appendChild(card);
        }
    } catch (err) {
        console.error('[Debug Sprites] Erro:', err);
        statsBar.innerHTML = `<span style="color:#f44336;">Erro: ${err.message}</span>`;
    }
}

window.addEventListener('DOMContentLoaded', initDebugSprites);
