import { decodePatch } from './Textures.js';
import { THING_TABLE, SILENT_IGNORES } from '../sprites/thingTable.js';

/**
 * Analisa o nome de um lump para verificar se corresponde ao formato de nome de sprite do Doom:
 * - 6 caracteres: PREF + F + V (ex: TROOA1, SHOTA0)
 * - 8 caracteres: PREF + F1 + V1 + F2 + V2 (ex: TROOA2A8, o mesmo lump serve à vista 2 normal e vista 8 espelhada)
 * 
 * Vistas de 1 a 8 são ângulos ao redor do objeto (1 = de frente, 5 = de costas).
 * Vista 0 indica ângulo único (mesmo gráfico para todos os ângulos).
 * 
 * @param {string} name 
 * @returns {Object|null} { prefix, pairs: [{ frame, view, mirrored }] } ou null se inválido
 */
export function parseSpriteLumpName(name) {
    if (!name || (name.length !== 6 && name.length !== 8)) {
        return null;
    }

    const upper = name.toUpperCase();
    const prefix = upper.slice(0, 4);

    // Letra do quadro 1 (A-Z) e dígito da vista 1 ('0' a '8')
    const frame1 = upper[4];
    const view1 = parseInt(upper[5], 10);
    if (frame1 < 'A' || frame1 > 'Z' || isNaN(view1) || view1 < 0 || view1 > 8) {
        return null;
    }

    const pairs = [
        { frame: frame1, view: view1, mirrored: false },
    ];

    if (upper.length === 8) {
        const frame2 = upper[6];
        const view2 = parseInt(upper[7], 10);
        if (frame2 < 'A' || frame2 > 'Z' || isNaN(view2) || view2 < 0 || view2 > 8) {
            return null;
        }
        // O segundo par é desenhado espelhado horizontalmente
        pairs.push({ frame: frame2, view: view2, mirrored: true });
    }

    return { prefix, pairs };
}

/**
 * Localiza os lumps de sprites no arquivo WAD:
 * Procura os marcadores S_START e S_END (ou SS_START e SS_END).
 * Se nenhum par existir, varre todos os lumps que atendem ao formato de nome e tamanho >= 8.
 * Em caso de nomes repetidos, a última ocorrência prevalece.
 * 
 * @param {import('./WadFile.js').WadFile} wad 
 * @returns {Map<string, number>} Mapa nome do lump -> índice do lump no WAD
 */
export function findSpriteLumps(wad) {
    let startIndex = -1;
    let endIndex = -1;

    // 1. Tenta S_START e S_END
    for (let i = 0; i < wad.lumps.length; i++) {
        const n = wad.lumps[i].name;
        if (n === 'S_START') startIndex = i;
        if (n === 'S_END') endIndex = i;
    }

    // 2. Fallback para SS_START e SS_END
    if (startIndex < 0 || endIndex < 0) {
        for (let i = 0; i < wad.lumps.length; i++) {
            const n = wad.lumps[i].name;
            if (n === 'SS_START') startIndex = i;
            if (n === 'SS_END') endIndex = i;
        }
    }

    const spriteMap = new Map();

    if (startIndex >= 0 && endIndex > startIndex) {
        // Varre lumps estritamente entre os marcadores
        for (let i = startIndex + 1; i < endIndex; i++) {
            const l = wad.lumps[i];
            if (l.size >= 8 && parseSpriteLumpName(l.name)) {
                // Última ocorrência sobrescreve as anteriores
                spriteMap.set(l.name, i);
            }
        }
    } else {
        // Fallback global se não houver marcadores
        for (let i = 0; i < wad.lumps.length; i++) {
            const l = wad.lumps[i];
            if (l.size >= 8 && parseSpriteLumpName(l.name)) {
                spriteMap.set(l.name, i);
            }
        }
    }

    return spriteMap;
}

/**
 * Decodifica um lump de sprite no formato picture para arrays planos de índices e opacidade.
 * 
 * @param {import('./WadFile.js').WadFile} wad 
 * @param {number} lumpIndex 
 * @returns {Object|null} { width, height, leftOffset, topOffset, indices, opacity, columns }
 */
export function decodeSpritePicture(wad, lumpIndex) {
    const patch = decodePatch(wad, lumpIndex);
    if (!patch) return null;

    const { width, height, leftOffset, topOffset, columns } = patch;
    const indices = new Uint8Array(width * height);
    const opacity = new Uint8Array(width * height);

    for (let col = 0; col < width; col++) {
        const posts = columns[col] || [];
        for (const post of posts) {
            for (let row = 0; row < post.length; row++) {
                const y = post.topDelta + row;
                if (y < height) {
                    const idx = y * width + col;
                    indices[idx] = post.pixels[row];
                    opacity[idx] = 1;
                }
            }
        }
    }

    return {
        width,
        height,
        leftOffset,
        topOffset,
        indices,
        opacity,
        columns,
    };
}

/**
 * Constrói o registro completo de sprites a partir do WAD e dos tipos necessários.
 * Mapeia cada (prefixo, quadro, vista) para uma camada da textura array e indicador de espelhamento.
 * 
 * @param {import('./WadFile.js').WadFile} wad 
 * @param {Iterable<number>|null} [neededTypes=null] Lista opcional de tipos presentes (se null, usa todos de THING_TABLE)
 * @param {number} [maxLayersLimit=256] Limite máximo de camadas da textura array do dispositivo
 * @returns {Object} Registro com camadas decodificadas, metadados e tabelas de consulta
 */
export function buildSpriteRegistry(wad, neededTypes = null, maxLayersLimit = 256) {
    const spriteLumps = findSpriteLumps(wad);

    // Tipos a processar
    const typesToProcess = neededTypes ? Array.from(neededTypes) : Object.keys(THING_TABLE).map(Number);

    const typeStatus = new Map(); // type -> { resolved: boolean, def, validFrames, reason }
    const neededLumpIndicesSet = new Set();
    const typeFrameViews = new Map(); // type -> Map<frameChar, Map<viewNum, { lumpIndex, mirrored }>>

    // 1. Resolve cada tipo contra os lumps existentes no WAD
    for (const type of typesToProcess) {
        if (SILENT_IGNORES.has(type)) {
            typeStatus.set(type, { resolved: false, ignored: true });
            continue;
        }

        const def = THING_TABLE[type];
        if (!def) {
            typeStatus.set(type, { resolved: false, reason: 'tipo desconhecido na THING_TABLE' });
            continue;
        }

        // Verifica quais quadros da sequência existem no WAD
        let validFrames = '';
        const frameMap = new Map();

        for (const f of def.frames) {
            const viewsMap = new Map();

            // Procura lumps que definem quadros deste prefixo e letra
            for (const [lumpName, lumpIdx] of spriteLumps) {
                const parsed = parseSpriteLumpName(lumpName);
                if (!parsed || parsed.prefix !== def.prefix) continue;

                for (const pair of parsed.pairs) {
                    if (pair.frame === f) {
                        viewsMap.set(pair.view, {
                            lumpName,
                            lumpIndex: lumpIdx,
                            mirrored: pair.mirrored,
                        });
                    }
                }
            }

            if (viewsMap.size > 0) {
                validFrames += f;
                frameMap.set(f, viewsMap);
            }
        }

        if (validFrames.length === 0) {
            typeStatus.set(type, {
                resolved: false,
                def,
                validFrames: '',
                reason: 'nenhum quadro do prefixo encontrado no WAD',
            });
        } else {
            typeStatus.set(type, {
                resolved: true,
                def,
                validFrames,
                name: def.name,
                prefix: def.prefix,
            });
            typeFrameViews.set(type, frameMap);

            // Marca lumps usados
            for (const viewsMap of frameMap.values()) {
                for (const vInfo of viewsMap.values()) {
                    neededLumpIndicesSet.add(vInfo.lumpIndex);
                }
            }
        }
    }

    // 2. Se o número de camadas exceder o limite de hardware, descarta quadros além do primeiro
    let lumpIndicesArray = Array.from(neededLumpIndicesSet);
    if (lumpIndicesArray.length > maxLayersLimit) {
        console.warn(
            `[Sprites] Quantidade de lumps de sprites (${lumpIndicesArray.length}) excede limite GPU (${maxLayersLimit}). Reduzindo animação para o 1º quadro.`
        );
        neededLumpIndicesSet.clear();
        for (const [type, frameMap] of typeFrameViews) {
            const status = typeStatus.get(type);
            if (!status || !status.resolved) continue;

            const firstFrame = status.validFrames[0];
            status.validFrames = firstFrame; // Reduz para apenas 1 quadro
            const firstFrameViews = frameMap.get(firstFrame);
            if (firstFrameViews) {
                for (const vInfo of firstFrameViews.values()) {
                    neededLumpIndicesSet.add(vInfo.lumpIndex);
                }
            }
        }
        lumpIndicesArray = Array.from(neededLumpIndicesSet);
    }

    // 3. Decodifica todos os lumps necessários e calcula dimensões máximas
    let maxWidth = 1;
    let maxHeight = 1;
    const decodedLumps = new Map(); // lumpIndex -> decoded picture
    const lumpToLayer = new Map();  // lumpIndex -> layerIndex (0..N-1)

    lumpIndicesArray.sort((a, b) => a - b);
    for (let layer = 0; layer < lumpIndicesArray.length; layer++) {
        const lumpIdx = lumpIndicesArray[layer];
        lumpToLayer.set(lumpIdx, layer);

        const decoded = decodeSpritePicture(wad, lumpIdx);
        if (decoded) {
            decodedLumps.set(lumpIdx, decoded);
            if (decoded.width > maxWidth) maxWidth = decoded.width;
            if (decoded.height > maxHeight) maxHeight = decoded.height;
        }
    }

    // 4. Constrói tabela de metadados das camadas para o buffer da GPU
    // width, height, leftOffset, topOffset por camada
    const layersCount = lumpIndicesArray.length;
    const metadata = [];
    for (let layer = 0; layer < layersCount; layer++) {
        const lumpIdx = lumpIndicesArray[layer];
        const dec = decodedLumps.get(lumpIdx);
        if (dec) {
            metadata.push({
                width: dec.width,
                height: dec.height,
                leftOffset: dec.leftOffset,
                topOffset: dec.topOffset,
            });
        } else {
            metadata.push({ width: 0, height: 0, leftOffset: 0, topOffset: 0 });
        }
    }

    // 5. Monta tabela rápida de consulta (type, frame, view) -> { layer, mirrored, width, height, leftOffset, topOffset }
    const lookup = new Map(); // key = `${type}_${frame}_${view}`
    for (const [type, frameMap] of typeFrameViews) {
        for (const [f, viewsMap] of frameMap) {
            for (const [v, vInfo] of viewsMap) {
                const layer = lumpToLayer.get(vInfo.lumpIndex);
                const dec = decodedLumps.get(vInfo.lumpIndex);
                if (layer !== undefined && dec) {
                    lookup.set(`${type}_${f}_${v}`, {
                        layer,
                        mirrored: vInfo.mirrored,
                        width: dec.width,
                        height: dec.height,
                        leftOffset: dec.leftOffset,
                        topOffset: dec.topOffset,
                    });
                }
            }
        }
    }

    return {
        typeStatus,
        typeFrameViews,
        decodedLumps,
        lumpIndicesArray,
        lumpToLayer,
        layersCount,
        maxWidth,
        maxHeight,
        metadata,
        lookup,
        spriteLumpsCount: spriteLumps.size,
    };
}
