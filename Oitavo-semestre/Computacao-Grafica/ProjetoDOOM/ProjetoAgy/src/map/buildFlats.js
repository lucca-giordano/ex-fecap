import { doomToWorld } from './buildWalls.js';

/**
 * Gera uma cor RGB determinística a partir de uma string (nome do flat).
 * @param {string} str 
 * @returns {Array<number>} [r, g, b] normalizado entre 0.0 e 1.0
 */
export function hashStringToColor(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash |= 0;
    }
    const r = ((hash & 0xFF) / 255.0) * 0.55 + 0.30;
    const g = (((hash >> 8) & 0xFF) / 255.0) * 0.55 + 0.30;
    const b = (((hash >> 16) & 0xFF) / 255.0) * 0.55 + 0.30;
    return [r, g, b];
}

/**
 * Gera uma cor RGB determinística a partir do índice numérico do setor.
 * @param {number} id 
 * @returns {Array<number>} [r, g, b] normalizado entre 0.0 e 1.0
 */
export function hashIntToColor(id) {
    let hash = (id ^ 0x9e3779b9) * 0x85ebca6b;
    hash = (hash ^ (hash >>> 13)) * 0xc2b2ae35;
    hash ^= (hash >>> 16);
    const r = ((hash & 0xFF) / 255.0) * 0.55 + 0.30;
    const g = (((hash >> 8) & 0xFF) / 255.0) * 0.55 + 0.30;
    const b = (((hash >> 16) & 0xFF) / 255.0) * 0.55 + 0.30;
    return [r, g, b];
}

/**
 * Algoritmo de Sutherland-Hodgman para recortar um polígono convexo contra um semiplano.
 * @param {Array<Array<number>>} poly 
 * @param {Object} plane { x, y, dx, dy }
 * @returns {Array<Array<number>>}
 */
function clipPolygonAgainstHalfPlane(poly, plane) {
    const out = [];
    const n = poly.length;
    if (n === 0) return out;

    for (let i = 0; i < n; i++) {
        const A = poly[i];
        const B = poly[(i + 1) % n];

        const sA = plane.dx * (A[1] - plane.y) - plane.dy * (A[0] - plane.x);
        const sB = plane.dx * (B[1] - plane.y) - plane.dy * (B[0] - plane.x);

        const inA = sA <= 1e-7;
        const inB = sB <= 1e-7;

        if (inA && inB) {
            out.push(B);
        } else if (inA && !inB) {
            const t = sA / (sA - sB);
            out.push([A[0] + t * (B[0] - A[0]), A[1] + t * (B[1] - A[1])]);
        } else if (!inA && inB) {
            const t = sA / (sA - sB);
            out.push([A[0] + t * (B[0] - A[0]), A[1] + t * (B[1] - A[1])]);
            out.push(B);
        }
    }

    return out;
}

/**
 * Remove vértices consecutivos duplicados com tolerância de 0.001 unidade.
 * @param {Array<Array<number>>} poly 
 * @returns {Array<Array<number>>}
 */
function cleanPolygonVertices(poly) {
    if (poly.length < 3) return [];
    const cleaned = [];
    for (let i = 0; i < poly.length; i++) {
        const cur = poly[i];
        const prev = cleaned[cleaned.length - 1];
        if (!prev || Math.hypot(cur[0] - prev[0], cur[1] - prev[1]) >= 0.001) {
            cleaned.push(cur);
        }
    }
    if (cleaned.length > 2 && Math.hypot(cleaned[0][0] - cleaned[cleaned.length - 1][0], cleaned[0][1] - cleaned[cleaned.length - 1][1]) < 0.001) {
        cleaned.pop();
    }
    return cleaned;
}

/**
 * Calcula a área com sinal de um polígono 2D.
 * @param {Array<Array<number>>} poly 
 * @returns {number}
 */
function calculateSignedArea(poly) {
    let area = 0;
    for (let i = 0; i < poly.length; i++) {
        const j = (i + 1) % poly.length;
        area += poly[i][0] * poly[j][1] - poly[j][0] * poly[i][1];
    }
    return area / 2.0;
}

/**
 * Constrói a geometria 3D dos chãos e tetos com UVs ancorados no mundo (u = x, v = -y)
 * no layout de 52 bytes por vértice.
 * 
 * Convenção UV dos Flats:
 * u = x e v = -y nas coordenadas originais do Doom, antes da conversão para o espaço de mundo.
 * O shader aplica wrap(i32(floor(u)), 64) e wrap(i32(floor(v)), 64), ancorando a textura
 * ao sistema de mundo absoluto, o que garante perfeita continuidade entre subsectors vizinhos.
 * 
 * @param {Object} mapData Objeto contendo os dados do mapa
 * @param {Map<string, Object>} [flatTextureMap=new Map()] Mapa nome -> { layer, width, height }
 * @returns {Object} { vertices, sectorVertices, indices, subsectorInfo, stats }
 */
export function buildFlats(mapData, flatTextureMap = new Map()) {
    const vertexWordsFlat = [];
    const vertexWordsSector = [];
    const rawIndices = [];
    const subsectorInfo = [];

    const stats = {
        totalSubsectors: mapData.ssectors.length,
        generatedPolygons: 0,
        discardedPolygons: [],
        totalTriangles: 0,
        totalArea: 0,
        segViolations: 0,
        violationIndices: [],
    };

    // 1. Caixa delimitadora do mapa com margem de 256 unidades
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < mapData.vertexes.length; i++) {
        const v = mapData.vertexes[i];
        if (v.x < minX) minX = v.x;
        if (v.x > maxX) maxX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.y > maxY) maxY = v.y;
    }
    const MARGIN = 256;
    const initialBoundingBox = [
        [minX - MARGIN, minY - MARGIN],
        [maxX + MARGIN, minY - MARGIN],
        [maxX + MARGIN, maxY + MARGIN],
        [minX - MARGIN, maxY + MARGIN],
    ];

    // 2. Mapeamento de semiplanos ancestrais via DFS na árvore BSP
    const subsectorPlanes = new Map();
    function traverseBspTree(nodeIdx, currentPlanes) {
        const node = mapData.nodes[nodeIdx];

        const rightPlanes = [...currentPlanes, { x: node.x, y: node.y, dx: node.dx, dy: node.dy }];
        if (node.rightChild & 0x8000) {
            subsectorPlanes.set(node.rightChild & 0x7FFF, rightPlanes);
        } else {
            traverseBspTree(node.rightChild, rightPlanes);
        }

        const leftPlanes = [...currentPlanes, { x: node.x, y: node.y, dx: -node.dx, dy: -node.dy }];
        if (node.leftChild & 0x8000) {
            subsectorPlanes.set(node.leftChild & 0x7FFF, leftPlanes);
        } else {
            traverseBspTree(node.leftChild, leftPlanes);
        }
    }

    if (mapData.nodes.length > 0) {
        traverseBspTree(mapData.nodes.length - 1, []);
    }

    let vertexOffset = 0;

    // 3. Processamento de cada subsector
    for (let ssIdx = 0; ssIdx < mapData.ssectors.length; ssIdx++) {
        const ss = mapData.ssectors[ssIdx];
        const ancestralPlanes = subsectorPlanes.get(ssIdx) || [];

        let poly = initialBoundingBox.map(pt => [...pt]);

        for (let i = 0; i < ancestralPlanes.length; i++) {
            poly = clipPolygonAgainstHalfPlane(poly, ancestralPlanes[i]);
            if (poly.length < 3) break;
        }

        for (let s = 0; s < ss.segCount; s++) {
            const seg = mapData.segs[ss.firstSeg + s];
            const v1 = mapData.vertexes[seg.v1];
            const v2 = mapData.vertexes[seg.v2];
            const segPlane = {
                x: v1.x,
                y: v1.y,
                dx: v2.x - v1.x,
                dy: v2.y - v1.y,
            };
            poly = clipPolygonAgainstHalfPlane(poly, segPlane);
            if (poly.length < 3) break;
        }

        poly = cleanPolygonVertices(poly);
        const signedArea = calculateSignedArea(poly);
        const absArea = Math.abs(signedArea);

        if (poly.length < 3 || absArea < 0.01) {
            stats.discardedPolygons.push(ssIdx);
            continue;
        }

        if (signedArea < 0) {
            poly.reverse();
        }

        stats.generatedPolygons++;
        stats.totalArea += absArea;

        // Recupera setor através do primeiro seg
        const firstSeg = mapData.segs[ss.firstSeg];
        const linedef = mapData.linedefs[firstSeg.linedef];
        const sidedefIdx = (firstSeg.direction === 0) ? linedef.rightSidedef : linedef.leftSidedef;
        const sidedef = mapData.sidedefs[sidedefIdx];
        const sectorIdx = sidedef.sector;
        const sector = mapData.sectors[sectorIdx];

        const floorFlat = sector.floorTexture;
        const ceilFlat = sector.ceilingTexture;
        const isSky = (ceilFlat === 'F_SKY1');

        subsectorInfo.push({
            subsector: ssIdx,
            sector: sectorIdx,
            floorFlat,
            ceilFlat,
            polygon: poly,
            area: absArea,
            isSky,
        });

        // Layer de textura nos arrays
        const floorTexInfo = flatTextureMap.get(floorFlat.toUpperCase());
        const floorLayer = floorTexInfo ? floorTexInfo.layer : 0;

        let ceilLayer = 0;
        let ceilKind = 1; // 1 = flat
        if (isSky) {
            ceilKind = 2; // 2 = céu
            ceilLayer = 0;
        } else {
            const ceilTexInfo = flatTextureMap.get(ceilFlat.toUpperCase());
            ceilLayer = ceilTexInfo ? ceilTexInfo.layer : 0;
        }

        // Cores para o modo sólido
        const colFloorFlat = hashStringToColor(floorFlat);
        const colCeilFlat = isSky ? [0.35, 0.65, 0.95] : [colFloorFlat[0] * 0.8, colFloorFlat[1] * 0.8, colFloorFlat[2] * 0.8];

        const colSector = hashIntToColor(sectorIdx);
        const colFloorSector = colSector;
        const colCeilSector = isSky ? [0.35, 0.65, 0.95] : [colSector[0] * 0.8, colSector[1] * 0.8, colSector[2] * 0.8];

        const numVerts = poly.length;

        const baseLightnum = Math.min(Math.max(Math.floor(sector.lightLevel / 16), 0), 15);

        // 4. CHÃO (Floor): Altura floorHeight, Normal [0, 1, 0] em world
        const floorBase = vertexOffset;
        for (let i = 0; i < numVerts; i++) {
            const doomX = poly[i][0];
            const doomY = poly[i][1];
            const p = doomToWorld(doomX, doomY, sector.floorHeight);

            // Coordenadas UV do Flat ancoradas no mundo: u = x, v = -y
            const u = doomX;
            const v = -doomY;

            vertexWordsFlat.push({
                posX: p[0], posY: p[1], posZ: p[2],
                normX: 0.0, normY: 1.0, normZ: 0.0,
                colR: colFloorFlat[0], colG: colFloorFlat[1], colB: colFloorFlat[2],
                u, v,
                layer: floorLayer >>> 0,
                kind: 1, // 1 = flat
                lightnum: baseLightnum >>> 0,
            });

            vertexWordsSector.push({
                posX: p[0], posY: p[1], posZ: p[2],
                normX: 0.0, normY: 1.0, normZ: 0.0,
                colR: colFloorSector[0], colG: colFloorSector[1], colB: colFloorSector[2],
                u, v,
                layer: floorLayer >>> 0,
                kind: 1,
                lightnum: baseLightnum >>> 0,
            });
        }
        vertexOffset += numVerts;

        // Triangulação em leque para o chão: (0, i, i + 1)
        for (let i = 1; i < numVerts - 1; i++) {
            rawIndices.push(floorBase, floorBase + i, floorBase + i + 1);
            stats.totalTriangles++;
        }

        // 5. TETO (Ceiling): Altura ceilingHeight, Normal [0, -1, 0] em world (ou luz direcional para o céu)
        const ceilBase = vertexOffset;
        const ceilNorm = isSky ? [0.5298, 0.7417, 0.4238] : [0.0, -1.0, 0.0];

        for (let i = 0; i < numVerts; i++) {
            const doomX = poly[i][0];
            const doomY = poly[i][1];
            const p = doomToWorld(doomX, doomY, sector.ceilingHeight);

            const u = doomX;
            const v = -doomY;

            vertexWordsFlat.push({
                posX: p[0], posY: p[1], posZ: p[2],
                normX: ceilNorm[0], normY: ceilNorm[1], normZ: ceilNorm[2],
                colR: colCeilFlat[0], colG: colCeilFlat[1], colB: colCeilFlat[2],
                u, v,
                layer: ceilLayer >>> 0,
                kind: ceilKind, // 1 = flat, 2 = céu
                lightnum: baseLightnum >>> 0,
            });

            vertexWordsSector.push({
                posX: p[0], posY: p[1], posZ: p[2],
                normX: ceilNorm[0], normY: ceilNorm[1], normZ: ceilNorm[2],
                colR: colCeilSector[0], colG: colCeilSector[1], colB: colCeilSector[2],
                u, v,
                layer: ceilLayer >>> 0,
                kind: ceilKind,
                lightnum: baseLightnum >>> 0,
            });
        }
        vertexOffset += numVerts;

        // Triangulação em ordem inversa para o teto: (0, i + 1, i)
        for (let i = 1; i < numVerts - 1; i++) {
            rawIndices.push(ceilBase, ceilBase + i + 1, ceilBase + i);
            stats.totalTriangles++;
        }

        // 6. Validação dos pontos finais dos segs
        for (let s = 0; s < ss.segCount; s++) {
            const seg = mapData.segs[ss.firstSeg + s];
            for (const vIdx of [seg.v1, seg.v2]) {
                const pt = mapData.vertexes[vIdx];
                let isInside = true;
                for (let i = 0; i < poly.length; i++) {
                    const A = poly[i];
                    const B = poly[(i + 1) % poly.length];
                    const edgeLen = Math.hypot(B[0] - A[0], B[1] - A[1]);
                    if (edgeLen < 1e-7) continue;
                    const dist = ((B[0] - A[0]) * (pt.y - A[1]) - (B[1] - A[1]) * (pt.x - A[0])) / edgeLen;
                    if (dist < -0.5) {
                        isInside = false;
                        break;
                    }
                }
                if (!isInside) {
                    stats.segViolations++;
                    if (stats.violationIndices.length < 10) {
                        stats.violationIndices.push({
                            subsector: ssIdx,
                            seg: ss.firstSeg + s,
                            point: [pt.x, pt.y],
                        });
                    }
                }
            }
        }
    }

    // Monta os ArrayBuffers de 56 bytes por vértice (14 palavras * 4 bytes)
    const totalVertices = vertexWordsFlat.length;

    const bufferFlat = new ArrayBuffer(totalVertices * 56);
    const floatViewFlat = new Float32Array(bufferFlat);
    const uintViewFlat = new Uint32Array(bufferFlat);

    const bufferSector = new ArrayBuffer(totalVertices * 56);
    const floatViewSector = new Float32Array(bufferSector);
    const uintViewSector = new Uint32Array(bufferSector);

    for (let i = 0; i < totalVertices; i++) {
        const wf = vertexWordsFlat[i];
        const ws = vertexWordsSector[i];
        const offset = i * 14;

        // Visualização Flat
        floatViewFlat[offset + 0] = wf.posX;
        floatViewFlat[offset + 1] = wf.posY;
        floatViewFlat[offset + 2] = wf.posZ;
        floatViewFlat[offset + 3] = wf.normX;
        floatViewFlat[offset + 4] = wf.normY;
        floatViewFlat[offset + 5] = wf.normZ;
        floatViewFlat[offset + 6] = wf.colR;
        floatViewFlat[offset + 7] = wf.colG;
        floatViewFlat[offset + 8] = wf.colB;
        floatViewFlat[offset + 9] = wf.u;
        floatViewFlat[offset + 10] = wf.v;
        uintViewFlat[offset + 11] = wf.layer;
        uintViewFlat[offset + 12] = wf.kind;
        uintViewFlat[offset + 13] = wf.lightnum;

        // Visualização Setor
        floatViewSector[offset + 0] = ws.posX;
        floatViewSector[offset + 1] = ws.posY;
        floatViewSector[offset + 2] = ws.posZ;
        floatViewSector[offset + 3] = ws.normX;
        floatViewSector[offset + 4] = ws.normY;
        floatViewSector[offset + 5] = ws.normZ;
        floatViewSector[offset + 6] = ws.colR;
        floatViewSector[offset + 7] = ws.colG;
        floatViewSector[offset + 8] = ws.colB;
        floatViewSector[offset + 9] = ws.u;
        floatViewSector[offset + 10] = ws.v;
        uintViewSector[offset + 11] = ws.layer;
        uintViewSector[offset + 12] = ws.kind;
        uintViewSector[offset + 13] = ws.lightnum;
    }

    return {
        buffer: bufferFlat,
        vertices: floatViewFlat,
        sectorBuffer: bufferSector,
        sectorVertices: floatViewSector,
        indices: new Uint32Array(rawIndices),
        subsectorInfo,
        stats,
    };
}
