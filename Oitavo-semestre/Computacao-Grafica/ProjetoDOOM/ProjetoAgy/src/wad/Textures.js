import { readName, WadError } from './WadFile.js';

const LITTLE_ENDIAN = true;

/**
 * Busca um lump no diretório do WAD e retorna a ÚLTIMA ocorrência encontrada.
 * @param {WadFile} wad 
 * @param {string} name Nome do lump
 * @param {number} [exactSize=-1] Se >= 0, exige que o lump tenha exatamente esse tamanho
 * @returns {number} Índice do lump ou -1 se não encontrado
 */
export function findLastLump(wad, name, exactSize = -1) {
    const upper = name.toUpperCase();
    for (let i = wad.lumps.length - 1; i >= 0; i--) {
        const l = wad.lumps[i];
        if (l.name === upper) {
            if (exactSize >= 0 && l.size !== exactSize) continue;
            return i;
        }
    }
    return -1;
}

/**
 * Decodifica o lump PLAYPAL, extraindo a Paleta 0 (256 cores RGB, 768 bytes).
 * @param {WadFile} wad 
 * @returns {Uint8Array} Array de 768 bytes (256 entradas RGB)
 */
export function loadPalette0(wad) {
    const palIdx = wad.findLump('PLAYPAL');
    if (palIdx < 0) {
        throw new WadError('Lump PLAYPAL não encontrado no arquivo WAD.');
    }
    const bytes = wad.getLumpBytes(palIdx);
    if (bytes.length < 768) {
        throw new WadError(`Lump PLAYPAL muito pequeno (${bytes.length} bytes, esperado mínimo de 768).`);
    }
    return bytes.slice(0, 768);
}

/**
 * Decodifica a tabela de nomes de patches (PNAMES).
 * @param {WadFile} wad 
 * @returns {Array<string>} Lista ordenada de nomes de patches
 */
export function loadPnames(wad) {
    const pnamesIdx = wad.findLump('PNAMES');
    if (pnamesIdx < 0) {
        throw new WadError('Lump PNAMES não encontrado no arquivo WAD.');
    }
    const view = wad.getLumpView(pnamesIdx);
    const count = view.getUint32(0, LITTLE_ENDIAN);
    const pnames = [];
    for (let i = 0; i < count; i++) {
        pnames.push(readName(view, 4 + i * 8, 8));
    }
    return pnames;
}

/**
 * Decodifica as definições de texturas de parede contidas nos lumps TEXTURE1 e TEXTURE2.
 * Em caso de nomes repetidos, a primeira ocorrência prevalece.
 * @param {WadFile} wad 
 * @returns {Map<string, Object>} Mapa nome -> definição da textura
 */
export function loadTextureDefinitions(wad) {
    const texturesDef = new Map();

    for (const lumpName of ['TEXTURE1', 'TEXTURE2']) {
        const lIdx = wad.findLump(lumpName);
        if (lIdx < 0) continue;

        const view = wad.getLumpView(lIdx);
        const count = view.getInt32(0, LITTLE_ENDIAN);

        for (let i = 0; i < count; i++) {
            const offset = view.getInt32(4 + i * 4, LITTLE_ENDIAN);
            const name = readName(view, offset, 8);

            // Primeira ocorrência prevalece
            if (!texturesDef.has(name)) {
                const width = view.getInt16(offset + 12, LITTLE_ENDIAN);
                const height = view.getInt16(offset + 14, LITTLE_ENDIAN);
                const patchCount = view.getInt16(offset + 20, LITTLE_ENDIAN);

                const patches = [];
                for (let p = 0; p < patchCount; p++) {
                    const po = offset + 22 + p * 10;
                    patches.push({
                        originX: view.getInt16(po, LITTLE_ENDIAN),
                        originY: view.getInt16(po + 2, LITTLE_ENDIAN),
                        patchIndex: view.getInt16(po + 4, LITTLE_ENDIAN),
                    });
                }

                texturesDef.set(name, { name, width, height, patches });
            }
        }
    }

    return texturesDef;
}

/**
 * Decodifica um patch no formato "picture" do Doom.
 * @param {WadFile} wad 
 * @param {string|number} patchNameOrIndex 
 * @returns {Object|null} { width, height, columns, leftOffset, topOffset } ou null se inválido
 */
export function decodePatch(wad, patchNameOrIndex) {
    const lIdx = (typeof patchNameOrIndex === 'number')
        ? patchNameOrIndex
        : findLastLump(wad, patchNameOrIndex);
    if (lIdx < 0) return null;

    const view = wad.getLumpView(lIdx);
    if (view.byteLength < 8) return null;

    const width = view.getUint16(0, LITTLE_ENDIAN);
    const height = view.getUint16(2, LITTLE_ENDIAN);
    const leftOffset = view.getInt16(4, LITTLE_ENDIAN);
    const topOffset = view.getInt16(6, LITTLE_ENDIAN);

    const columns = [];
    for (let col = 0; col < width; col++) {
        const colOffset = view.getUint32(8 + col * 4, LITTLE_ENDIAN);
        let p = colOffset;
        const posts = [];

        while (p < view.byteLength) {
            const topDelta = view.getUint8(p);
            if (topDelta === 0xFF) break; // 0xFF indica o fim da coluna

            const length = view.getUint8(p + 1);
            p += 3; // topDelta(1) + length(1) + padding(1)

            if (p + length > view.byteLength) break;
            const pixels = new Uint8Array(view.buffer, view.byteOffset + p, length);
            posts.push({ topDelta, length, pixels });

            p += length + 1; // pixels(length) + padding(1)
        }

        columns.push(posts);
    }

    return { width, height, leftOffset, topOffset, columns };
}

/**
 * Decodifica a paleta, os flats e compõe todas as texturas de parede utilizadas no mapa.
 * Função pura e desacoplada do WebGPU.
 * 
 * @param {WadFile} wad 
 * @param {Object} mapData 
 * @param {Array<string>} [extraWalls=[]] Texturas adicionais de parede a carregar (ex: textura do céu SKY1)
 * @returns {Object} { palette, flats, wallTextures, stats }
 */
export function loadTexturesAndFlats(wad, mapData, extraWalls = []) {
    const stats = {
        neededWalls: [],
        loadedWalls: 0,
        missingWalls: [],
        neededFlats: [],
        loadedFlats: 0,
        missingFlats: [],
        maxWallWidth: 0,
        maxWallHeight: 0,
        transparentTextures: [],
        invalidPatchRefs: [],
    };

    // 1. Paleta 0
    const palette = loadPalette0(wad);

    // 2. Coleta nomes distintos usados no mapa
    const neededWallsSet = new Set();
    for (const side of mapData.sidedefs) {
        if (side.upperTexture && side.upperTexture !== '-') neededWallsSet.add(side.upperTexture.toUpperCase());
        if (side.lowerTexture && side.lowerTexture !== '-') neededWallsSet.add(side.lowerTexture.toUpperCase());
        if (side.middleTexture && side.middleTexture !== '-') neededWallsSet.add(side.middleTexture.toUpperCase());
    }
    for (const extra of extraWalls) {
        if (extra && extra !== '-') neededWallsSet.add(extra.toUpperCase());
    }
    stats.neededWalls = Array.from(neededWallsSet).sort();

    const neededFlatsSet = new Set();
    for (const sec of mapData.sectors) {
        if (sec.floorTexture && sec.floorTexture !== 'F_SKY1') neededFlatsSet.add(sec.floorTexture.toUpperCase());
        if (sec.ceilingTexture && sec.ceilingTexture !== 'F_SKY1') neededFlatsSet.add(sec.ceilingTexture.toUpperCase());
    }
    stats.neededFlats = Array.from(neededFlatsSet).sort();

    // 3. Carregamento dos Flats (imagem raw 64x64 de 4096 bytes)
    const flats = new Map();
    for (const flatName of stats.neededFlats) {
        const lIdx = findLastLump(wad, flatName, 4096);
        if (lIdx >= 0) {
            flats.set(flatName, wad.getLumpBytes(lIdx));
            stats.loadedFlats++;
        } else {
            stats.missingFlats.push(flatName);
            console.warn(`[WAD Texturas] Flat "${flatName}" não encontrado (exigido lump de 4096 bytes). Será usado fallback.`);
        }
    }

    // 4. Carregamento de PNAMES e TEXTURE1/2
    const pnames = loadPnames(wad);
    const textureDefs = loadTextureDefinitions(wad);

    // Cache local de patches para acelerar composição
    const patchCache = new Map();
    function getCachedPatch(patchName) {
        if (patchCache.has(patchName)) return patchCache.get(patchName);
        const patch = decodePatch(wad, patchName);
        patchCache.set(patchName, patch);
        return patch;
    }

    // 5. Composição das texturas de parede
    const wallTextures = new Map();

    for (const wallName of stats.neededWalls) {
        const def = textureDefs.get(wallName);
        if (!def) {
            stats.missingWalls.push(wallName);
            console.warn(`[WAD Texturas] Textura de parede "${wallName}" não encontrada nas definições. Será usado fallback.`);
            continue;
        }

        const { width, height, patches } = def;
        if (width > stats.maxWallWidth) stats.maxWallWidth = width;
        if (height > stats.maxWallHeight) stats.maxWallHeight = height;

        const indices = new Uint8Array(width * height);
        const opacity = new Uint8Array(width * height);

        for (const patchRef of patches) {
            if (patchRef.patchIndex < 0 || patchRef.patchIndex >= pnames.length) {
                stats.invalidPatchRefs.push({ texture: wallName, patchIndex: patchRef.patchIndex });
                continue;
            }

            const patchName = pnames[patchRef.patchIndex];
            const patch = getCachedPatch(patchName);
            if (!patch) {
                stats.invalidPatchRefs.push({ texture: wallName, patchName });
                continue;
            }

            // Desenha colunas do patch
            for (let col = 0; col < patch.width; col++) {
                const destX = patchRef.originX + col;
                if (destX < 0 || destX >= width) continue;

                for (const post of patch.columns[col]) {
                    for (let row = 0; row < post.length; row++) {
                        const destY = patchRef.originY + post.topDelta + row;
                        if (destY < 0 || destY >= height) continue;

                        const idx = destY * width + destX;
                        indices[idx] = post.pixels[row];
                        opacity[idx] = 1;
                    }
                }
            }
        }

        // Verifica pixels transparentes
        let transparentPixels = 0;
        for (let i = 0; i < opacity.length; i++) {
            if (opacity[i] === 0) transparentPixels++;
        }

        if (transparentPixels > 0) {
            stats.transparentTextures.push({
                name: wallName,
                transparentPixels,
                totalPixels: width * height,
            });
        }

        wallTextures.set(wallName, {
            name: wallName,
            width,
            height,
            indices,
            opacity,
        });
        stats.loadedWalls++;
    }

    return {
        palette,
        flats,
        wallTextures,
        stats,
    };
}
