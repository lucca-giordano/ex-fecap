import { NO_SIDE } from '../wad/MapData.js';

/**
 * Converte coordenadas do Doom para o espaço de mundo 3D do renderizador.
 * (x, y, z)_doom -> (x, z, -y)_world
 * @param {number} x Coordenada X no sistema Doom (Leste)
 * @param {number} y Coordenada Y no sistema Doom (Norte)
 * @param {number} z Altura Z no sistema Doom (Chão/Teto)
 * @returns {Array<number>} [X, Y, Z] no espaço de mundo
 */
export function doomToWorld(x, y, z) {
    return [x, z, -y];
}

/**
 * Constrói a malha 3D de todas as paredes do mapa E1M1 com mapeamento UV e iluminação por setor.
 * 
 * Layout de cada vértice (56 bytes = 14 palavras de 32 bits):
 * - Posição: 3 floats (x, y, z)          [offset 0]
 * - Normal: 3 floats (nx, ny, nz)         [offset 12]
 * - Cor sólida: 3 floats (r, g, b)        [offset 24]
 * - UV: 2 floats (u, v)                   [offset 36]
 * - Layer: 1 uint32                       [offset 44] (0xFFFFFFFF = sem textura)
 * - Kind: 1 uint32                        [offset 48] (0 = parede, 1 = flat, 2 = céu)
 * - Lightnum: 1 uint32                    [offset 52] (0 a 15)
 * 
 * @param {Object} mapData Objeto contendo os dados do mapa
 * @param {Map<string, Object>} [wallTextureMap=new Map()] Mapa nome -> { layer, width, height }
 * @returns {Object} { vertices: Float32Array, buffer: ArrayBuffer, indices: Uint32Array, quadInfo: Array, stats: Object }
 */
export function buildWalls(mapData, wallTextureMap = new Map()) {
    // Array temporário para armazenar vértices em palavras de 32 bits
    const vertexWords = [];
    const rawIndices = [];
    const quadInfo = [];

    const stats = {
        middleQuads: 0,
        lowerQuads: 0,
        upperQuads: 0,
        ignoredLinedefs: [],
        twoSidedMiddleIgnored: 0,
        skyUpperOmitted: 0,
        noTexturePieces: 0, // Peças com layer 0xFFFFFFFF (nome "-")
    };

    let vertexCount = 0;

    /**
     * Adiciona um quad de parede com orientação CCW, coordenadas UV e nível de luz.
     * @param {Object} vA Vértice A do Doom { x, y }
     * @param {Object} vB Vértice B do Doom { x, y }
     * @param {number} zBottom Altura inferior (Doom)
     * @param {number} zTop Altura superior (Doom)
     * @param {boolean} isRightSide true se pertence ao lado direito da linedef
     * @param {Object} meta Metadados do quad { linedef, sidedef, sector, kind, textureName, base, xOffset, yOffset, lightnum }
     */
    function addQuad(vA, vB, zBottom, zTop, isRightSide, meta) {
        if (zTop <= zBottom) return;

        const dx = vB.x - vA.x;
        const dy = vB.y - vA.y;
        const len = Math.hypot(dx, dy);
        if (len === 0) return;

        let nx, ny, nz;
        let p0, p1, p2, p3;

        if (isRightSide) {
            nx = dy / len;
            ny = 0;
            nz = dx / len;

            p0 = doomToWorld(vA.x, vA.y, zBottom); // Inferior esquerdo
            p1 = doomToWorld(vB.x, vB.y, zBottom); // Inferior direito
            p2 = doomToWorld(vB.x, vB.y, zTop);    // Superior direito
            p3 = doomToWorld(vA.x, vA.y, zTop);    // Superior esquerdo
        } else {
            nx = -dy / len;
            ny = 0;
            nz = -dx / len;

            p0 = doomToWorld(vB.x, vB.y, zBottom); // Inferior esquerdo
            p1 = doomToWorld(vA.x, vA.y, zBottom); // Inferior direito
            p2 = doomToWorld(vA.x, vA.y, zTop);    // Superior direito
            p3 = doomToWorld(vB.x, vB.y, zTop);    // Superior esquerdo
        }

        // Cor sólida por tipo para o modo não-texturizado
        let r, g, b;
        if (meta.kind === 'middle') {
            r = 0.72; g = 0.55; b = 0.38;
            stats.middleQuads++;
        } else if (meta.kind === 'lower') {
            r = 0.65; g = 0.18; b = 0.18;
            stats.lowerQuads++;
        } else {
            r = 0.45; g = 0.52; b = 0.62;
            stats.upperQuads++;
        }

        // Determinação de layer de textura
        let layer = 0xFFFFFFFF;
        const texName = (meta.textureName || '').toUpperCase();

        if (texName === '' || texName === '-') {
            layer = 0xFFFFFFFF;
            stats.noTexturePieces++;
        } else if (wallTextureMap.has(texName)) {
            layer = wallTextureMap.get(texName).layer;
        } else {
            layer = 0; // Fallback
        }

        // Cálculo de UVs não-normalizados
        const uLeft = meta.xOffset;
        const uRight = meta.xOffset + len;
        const vTop = meta.base + meta.yOffset - zTop;
        const vBottom = meta.base + meta.yOffset - zBottom;

        const lightnum = (meta.lightnum !== undefined) ? meta.lightnum : 15;

        const quadVerts = [
            { x: p0[0], y: p0[1], z: p0[2], u: uLeft,  v: vBottom }, // 0
            { x: p1[0], y: p1[1], z: p1[2], u: uRight, v: vBottom }, // 1
            { x: p2[0], y: p2[1], z: p2[2], u: uRight, v: vTop },    // 2
            { x: p3[0], y: p3[1], z: p3[2], u: uLeft,  v: vTop },    // 3
        ];

        const baseIndex = vertexCount;
        for (let i = 0; i < 4; i++) {
            const p = quadVerts[i];
            vertexWords.push({
                posX: p.x, posY: p.y, posZ: p.z,
                normX: nx, normY: ny, normZ: nz,
                colR: r, colG: g, colB: b,
                u: p.u, v: p.v,
                layer: layer >>> 0,
                kind: 0, // 0 = parede
                lightnum: lightnum >>> 0,
            });
        }
        vertexCount += 4;

        // Triângulos CCW: (0, 1, 2) e (0, 2, 3)
        rawIndices.push(
            baseIndex + 0, baseIndex + 1, baseIndex + 2,
            baseIndex + 0, baseIndex + 2, baseIndex + 3
        );

        quadInfo.push({
            ...meta,
            normal: [nx, ny, nz],
            height: zTop - zBottom,
            length: len,
            layer,
            lightnum,
        });
    }

    // Processamento de cada linedef do mapa
    for (let i = 0; i < mapData.linedefs.length; i++) {
        const line = mapData.linedefs[i];

        if (line.rightSidedef === NO_SIDE || line.rightSidedef >= mapData.sidedefs.length) {
            stats.ignoredLinedefs.push({
                index: i,
                reason: `Linedef não possui sidedef direito válido (${line.rightSidedef})`,
            });
            continue;
        }

        const v1 = mapData.vertexes[line.v1];
        const v2 = mapData.vertexes[line.v2];
        if (!v1 || !v2) {
            stats.ignoredLinedefs.push({
                index: i,
                reason: `Linedef referencia vértices inválidos (v1: ${line.v1}, v2: ${line.v2})`,
            });
            continue;
        }

        const rightSide = mapData.sidedefs[line.rightSidedef];
        const secF = mapData.sectors[rightSide.sector];

        // Contraste de luz nas paredes alinhadas aos eixos:
        // Horizontal (y1 == y2): lightnum - 1; Vertical (x1 == x2): lightnum + 1.
        let contrastOffset = 0;
        if (v1.y === v2.y) {
            contrastOffset = -1;
        } else if (v1.x === v2.x) {
            contrastOffset = 1;
        }

        const rightLightnum = Math.min(Math.max(Math.floor(secF.lightLevel / 16) + contrastOffset, 0), 15);

        // Caso 1: Linedef de um lado só (sem lado esquerdo)
        if (line.leftSidedef === NO_SIDE) {
            const texName = rightSide.middleTexture;
            const texInfo = wallTextureMap.get((texName || '').toUpperCase());
            const texHeight = texInfo ? texInfo.height : 128;

            // Base para 1-sided middle:
            // Se lower unpegged (0x0010): base = floor(F) + texHeight; senão: base = ceil(F)
            const base = line.lowerUnpegged ? (secF.floorHeight + texHeight) : secF.ceilingHeight;

            addQuad(v1, v2, secF.floorHeight, secF.ceilingHeight, true, {
                linedef: i,
                sidedef: line.rightSidedef,
                sector: rightSide.sector,
                kind: 'middle',
                textureName: texName,
                base,
                xOffset: rightSide.xOffset,
                yOffset: rightSide.yOffset,
                lightnum: rightLightnum,
            });
        } else {
            // Caso 2: Linedef de dois lados
            if (line.leftSidedef >= mapData.sidedefs.length) {
                stats.ignoredLinedefs.push({
                    index: i,
                    reason: `Linedef possui sidedef esquerdo fora dos limites (${line.leftSidedef})`,
                });
                continue;
            }

            const leftSide = mapData.sidedefs[line.leftSidedef];
            const secB = mapData.sectors[leftSide.sector];

            // A luz do lado esquerdo vem do setor B (o lado voltado para ele)
            const leftLightnum = Math.min(Math.max(Math.floor(secB.lightLevel / 16) + contrastOffset, 0), 15);

            const hasMidF = rightSide.middleTexture && rightSide.middleTexture !== '-';
            const hasMidB = leftSide.middleTexture && leftSide.middleTexture !== '-';
            if (hasMidF || hasMidB) {
                stats.twoSidedMiddleIgnored++;
            }

            // Regra do céu (F_SKY1 em ambos os tetos)
            const isSky = (secF.ceilingTexture === 'F_SKY1' && secB.ceilingTexture === 'F_SKY1');

            // 2.a: Parede inferior no lado direito, se chão(B) > chão(F)
            if (secB.floorHeight > secF.floorHeight) {
                // Lower 2-sided: se lower unpegged (0x0010): base = ceil(F); senão: base = floor(B)
                const base = line.lowerUnpegged ? secF.ceilingHeight : secB.floorHeight;
                addQuad(v1, v2, secF.floorHeight, secB.floorHeight, true, {
                    linedef: i,
                    sidedef: line.rightSidedef,
                    sector: rightSide.sector,
                    kind: 'lower',
                    textureName: rightSide.lowerTexture,
                    base,
                    xOffset: rightSide.xOffset,
                    yOffset: rightSide.yOffset,
                    lightnum: rightLightnum,
                });
            }

            // 2.b: Parede superior no lado direito, se teto(B) < teto(F)
            if (secB.ceilingHeight < secF.ceilingHeight) {
                if (isSky) {
                    stats.skyUpperOmitted++;
                } else {
                    const texName = rightSide.upperTexture;
                    const texInfo = wallTextureMap.get((texName || '').toUpperCase());
                    const texHeight = texInfo ? texInfo.height : 128;

                    // Upper 2-sided: se upper unpegged (0x0008): base = ceil(F); senão: base = ceil(B) + texHeight
                    const base = line.upperUnpegged ? secF.ceilingHeight : (secB.ceilingHeight + texHeight);

                    addQuad(v1, v2, secB.ceilingHeight, secF.ceilingHeight, true, {
                        linedef: i,
                        sidedef: line.rightSidedef,
                        sector: rightSide.sector,
                        kind: 'upper',
                        textureName: texName,
                        base,
                        xOffset: rightSide.xOffset,
                        yOffset: rightSide.yOffset,
                        lightnum: rightLightnum,
                    });
                }
            }

            // 2.c: Parede inferior no lado esquerdo, se chão(F) > chão(B)
            if (secF.floorHeight > secB.floorHeight) {
                // No lado esquerdo, F e B trocam de papel:
                // Se lower unpegged: base = ceil(B); senão: base = floor(F)
                const base = line.lowerUnpegged ? secB.ceilingHeight : secF.floorHeight;
                addQuad(v1, v2, secB.floorHeight, secF.floorHeight, false, {
                    linedef: i,
                    sidedef: line.leftSidedef,
                    sector: leftSide.sector,
                    kind: 'lower',
                    textureName: leftSide.lowerTexture,
                    base,
                    xOffset: leftSide.xOffset,
                    yOffset: leftSide.yOffset,
                    lightnum: leftLightnum,
                });
            }

            // 2.d: Parede superior no lado esquerdo, se teto(F) < teto(B)
            if (secF.ceilingHeight < secB.ceilingHeight) {
                if (isSky) {
                    stats.skyUpperOmitted++;
                } else {
                    const texName = leftSide.upperTexture;
                    const texInfo = wallTextureMap.get((texName || '').toUpperCase());
                    const texHeight = texInfo ? texInfo.height : 128;

                    // No lado esquerdo, F e B trocam de papel:
                    // Se upper unpegged: base = ceil(B); senão: base = ceil(F) + texHeight
                    const base = line.upperUnpegged ? secB.ceilingHeight : (secF.ceilingHeight + texHeight);

                    addQuad(v1, v2, secF.ceilingHeight, secB.ceilingHeight, false, {
                        linedef: i,
                        sidedef: line.leftSidedef,
                        sector: leftSide.sector,
                        kind: 'upper',
                        textureName: texName,
                        base,
                        xOffset: leftSide.xOffset,
                        yOffset: leftSide.yOffset,
                        lightnum: leftLightnum,
                    });
                }
            }
        }
    }

    // Monta o ArrayBuffer com as duas views (Float32 e Uint32) no layout de 56 bytes
    const totalVertices = vertexWords.length;
    const buffer = new ArrayBuffer(totalVertices * 56); // 14 palavras * 4 bytes
    const floatView = new Float32Array(buffer);
    const uintView = new Uint32Array(buffer);

    for (let i = 0; i < totalVertices; i++) {
        const w = vertexWords[i];
        const offset = i * 14;

        floatView[offset + 0] = w.posX;
        floatView[offset + 1] = w.posY;
        floatView[offset + 2] = w.posZ;
        floatView[offset + 3] = w.normX;
        floatView[offset + 4] = w.normY;
        floatView[offset + 5] = w.normZ;
        floatView[offset + 6] = w.colR;
        floatView[offset + 7] = w.colG;
        floatView[offset + 8] = w.colB;
        floatView[offset + 9] = w.u;
        floatView[offset + 10] = w.v;
        uintView[offset + 11] = w.layer;
        uintView[offset + 12] = w.kind;
        uintView[offset + 13] = w.lightnum;
    }

    return {
        buffer,
        vertices: floatView,
        indices: new Uint32Array(rawIndices),
        quadInfo,
        stats,
    };
}
