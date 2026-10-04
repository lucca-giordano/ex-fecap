import { WadError, readName } from './WadFile.js';

const LITTLE_ENDIAN = true;

// Constante indicando ausência de sidedef (0xFFFF = 65535)
export const NO_SIDE = 0xFFFF;

// Flags de LINEDEFS
export const ML_BLOCKING      = 0x0001; // Bloqueia passagem de monstros e jogadores
export const ML_TWOSIDED      = 0x0004; // Possui dois lados (conecta dois setores)
export const ML_DONTPEGTOP    = 0x0008; // Upper unpegged: textura superior ancorada pelo teto
export const ML_DONTPEGBOTTOM = 0x0010; // Lower unpegged: textura inferior ancorada pelo chão

// Flag indicando que o filho de um nó BSP é um sub-setor (folha)
export const NF_SUBSECTOR     = 0x8000;

// Lista ordenada dos 10 lumps que compõem os dados de um mapa no Doom clássico
const MAP_LUMPS = [
    'THINGS',
    'LINEDEFS',
    'SIDEDEFS',
    'VERTEXES',
    'SEGS',
    'SSECTORS',
    'NODES',
    'SECTORS',
    'REJECT',
    'BLOCKMAP',
];

/**
 * Lê uma tabela homogênea de registros de tamanho fixo a partir de um lump do WAD.
 * Valida se o tamanho do lump é múltiplo exato do tamanho do registro.
 * @param {WadFile} wad 
 * @param {number} lumpIndex 
 * @param {number} recordSize 
 * @param {Function} parseRecordCallback 
 * @returns {Array}
 */
function parseTable(wad, lumpIndex, recordSize, parseRecordCallback) {
    const lump = wad.lumps[lumpIndex];
    if (lump.size % recordSize !== 0) {
        throw new WadError(
            `Tabela "${lump.name}" inválida: tamanho ${lump.size} bytes não é múltiplo do registro de ${recordSize} bytes.`
        );
    }

    const view = wad.getLumpView(lumpIndex);
    const records = [];
    const count = lump.size / recordSize;

    for (let i = 0; i < count; i++) {
        records.push(parseRecordCallback(view, i * recordSize));
    }

    return records;
}

/**
 * Lê os dados de geometria e entidades de um mapa a partir do arquivo WAD.
 * Mantém as coordenadas originais do Doom (X leste, Y norte, alturas em unidades Doom).
 * @param {WadFile} wad 
 * @param {string} mapName Ex: 'E1M1'
 * @returns {Object} Dados completos do mapa com campos em camelCase.
 */
export function loadMap(wad, mapName) {
    const targetMap = mapName.toUpperCase();
    const markerIndex = wad.findLump(targetMap);

    if (markerIndex < 0) {
        throw new WadError(`Marcador do mapa "${targetMap}" não foi encontrado no arquivo WAD.`);
    }

    // Validação estrita da sequência e nomes dos 10 lumps subsequentes ao marcador
    for (let i = 0; i < MAP_LUMPS.length; i++) {
        const expectedName = MAP_LUMPS[i];
        const currentLump = wad.lumps[markerIndex + 1 + i];

        if (!currentLump || currentLump.name !== expectedName) {
            const foundName = currentLump ? `"${currentLump.name}"` : 'fim do diretório';
            throw new WadError(
                `Estrutura do mapa "${targetMap}" inválida: esperava lump "${expectedName}" na posição ${i + 1} após o marcador, mas encontrou ${foundName}.`
            );
        }
    }

    // Helper para obter o índice absoluto do lump pelo nome dentro do bloco do mapa
    const getMapLumpIndex = (name) => markerIndex + 1 + MAP_LUMPS.indexOf(name);

    // 1. THINGS (10 bytes por registro): Entidades do mapa
    const things = parseTable(wad, getMapLumpIndex('THINGS'), 10, (view, offset) => ({
        x: view.getInt16(offset, LITTLE_ENDIAN),
        y: view.getInt16(offset + 2, LITTLE_ENDIAN),
        angle: view.getInt16(offset + 4, LITTLE_ENDIAN), // Ângulo em graus: 0 = Leste, 90 = Norte
        type: view.getInt16(offset + 6, LITTLE_ENDIAN),   // Tipo 1 = Início do Jogador 1
        flags: view.getInt16(offset + 8, LITTLE_ENDIAN),
    }));

    // 2. LINEDEFS (14 bytes por registro): Linhas que conectam vértices e definem paredes
    const linedefs = parseTable(wad, getMapLumpIndex('LINEDEFS'), 14, (view, offset) => {
        const flags = view.getInt16(offset + 4, LITTLE_ENDIAN);
        return {
            v1: view.getUint16(offset, LITTLE_ENDIAN),
            v2: view.getUint16(offset + 2, LITTLE_ENDIAN),
            flags,
            special: view.getInt16(offset + 6, LITTLE_ENDIAN),
            tag: view.getInt16(offset + 8, LITTLE_ENDIAN),
            rightSidedef: view.getUint16(offset + 10, LITTLE_ENDIAN),
            leftSidedef: view.getUint16(offset + 12, LITTLE_ENDIAN),
            // Flags decodificadas como booleanos
            blocking: (flags & ML_BLOCKING) !== 0,
            twoSided: (flags & ML_TWOSIDED) !== 0,
            upperUnpegged: (flags & ML_DONTPEGTOP) !== 0,
            lowerUnpegged: (flags & ML_DONTPEGBOTTOM) !== 0,
        };
    });

    // 3. SIDEDEFS (30 bytes por registro): Lados das linedefs e texturas das paredes
    const sidedefs = parseTable(wad, getMapLumpIndex('SIDEDEFS'), 30, (view, offset) => ({
        xOffset: view.getInt16(offset, LITTLE_ENDIAN),
        yOffset: view.getInt16(offset + 2, LITTLE_ENDIAN),
        upperTexture: readName(view, offset + 4, 8),
        lowerTexture: readName(view, offset + 12, 8),
        middleTexture: readName(view, offset + 20, 8),
        sector: view.getUint16(offset + 28, LITTLE_ENDIAN),
    }));

    // 4. VERTEXES (4 bytes por registro): Coordenadas 2D dos vértices
    const vertexes = parseTable(wad, getMapLumpIndex('VERTEXES'), 4, (view, offset) => ({
        x: view.getInt16(offset, LITTLE_ENDIAN),
        y: view.getInt16(offset + 2, LITTLE_ENDIAN),
    }));

    // 5. SEGS (12 bytes por registro): Segmentos de linha formados pela partição BSP
    const segs = parseTable(wad, getMapLumpIndex('SEGS'), 12, (view, offset) => ({
        v1: view.getUint16(offset, LITTLE_ENDIAN),
        v2: view.getUint16(offset + 2, LITTLE_ENDIAN),
        angle: view.getInt16(offset + 4, LITTLE_ENDIAN),
        linedef: view.getUint16(offset + 6, LITTLE_ENDIAN),
        direction: view.getInt16(offset + 8, LITTLE_ENDIAN), // 0 = mesmo sentido da linedef, 1 = oposto
        offset: view.getInt16(offset + 10, LITTLE_ENDIAN),
    }));

    // 6. SSECTORS (4 bytes por registro): Sub-setores convexos
    const ssectors = parseTable(wad, getMapLumpIndex('SSECTORS'), 4, (view, offset) => ({
        segCount: view.getUint16(offset, LITTLE_ENDIAN),
        firstSeg: view.getUint16(offset + 2, LITTLE_ENDIAN),
    }));

    // 7. NODES (28 bytes por registro): Árvore BSP para determinação de visibilidade
    const parseBoundingBox = (view, offset) => ({
        top: view.getInt16(offset, LITTLE_ENDIAN),
        bottom: view.getInt16(offset + 2, LITTLE_ENDIAN),
        left: view.getInt16(offset + 4, LITTLE_ENDIAN),
        right: view.getInt16(offset + 6, LITTLE_ENDIAN),
    });

    const nodes = parseTable(wad, getMapLumpIndex('NODES'), 28, (view, offset) => ({
        x: view.getInt16(offset, LITTLE_ENDIAN),
        y: view.getInt16(offset + 2, LITTLE_ENDIAN),
        dx: view.getInt16(offset + 4, LITTLE_ENDIAN),
        dy: view.getInt16(offset + 6, LITTLE_ENDIAN),
        rightBox: parseBoundingBox(view, offset + 8),
        leftBox: parseBoundingBox(view, offset + 16),
        rightChild: view.getUint16(offset + 24, LITTLE_ENDIAN),
        leftChild: view.getUint16(offset + 26, LITTLE_ENDIAN),
    }));

    // 8. SECTORS (26 bytes por registro): Setores poligonais (chão, teto, luz)
    const sectors = parseTable(wad, getMapLumpIndex('SECTORS'), 26, (view, offset) => ({
        floorHeight: view.getInt16(offset, LITTLE_ENDIAN),
        ceilingHeight: view.getInt16(offset + 2, LITTLE_ENDIAN),
        floorTexture: readName(view, offset + 4, 8),
        ceilingTexture: readName(view, offset + 12, 8),
        lightLevel: view.getInt16(offset + 20, LITTLE_ENDIAN),
        special: view.getInt16(offset + 22, LITTLE_ENDIAN),
        tag: view.getInt16(offset + 24, LITTLE_ENDIAN),
    }));

    const mapData = {
        name: targetMap,
        things,
        linedefs,
        sidedefs,
        vertexes,
        segs,
        ssectors,
        nodes,
        sectors,
    };

    // Validação de integridade referencial entre todas as tabelas lidas
    validateMapReferences(mapData);

    return mapData;
}

/**
 * Valida a consistência de índices e relações entre as tabelas do mapa.
 * Lança WadError com mensagem detalhada caso algum índice esteja fora dos limites.
 * @param {Object} map 
 */
function validateMapReferences(map) {
    const { name, linedefs, sidedefs, vertexes, segs, ssectors, nodes, sectors } = map;

    const assert = (condition, message) => {
        if (!condition) {
            throw new WadError(`Validação de ${name}: ${message}`);
        }
    };

    const isIndexValid = (idx, list) => typeof idx === 'number' && idx >= 0 && idx < list.length;

    // Validação de Linedefs
    linedefs.forEach((line, i) => {
        assert(isIndexValid(line.v1, vertexes), `Linedef ${i} aponta para v1 inválido (${line.v1}). Total de vértices: ${vertexes.length}.`);
        assert(isIndexValid(line.v2, vertexes), `Linedef ${i} aponta para v2 inválido (${line.v2}). Total de vértices: ${vertexes.length}.`);
        assert(isIndexValid(line.rightSidedef, sidedefs), `Linedef ${i} aponta para sidedef direito inválido (${line.rightSidedef}). Total de sidedefs: ${sidedefs.length}.`);
        assert(line.leftSidedef === NO_SIDE || isIndexValid(line.leftSidedef, sidedefs), `Linedef ${i} aponta para sidedef esquerdo inválido (${line.leftSidedef}).`);
    });

    // Validação de Sidedefs
    sidedefs.forEach((side, i) => {
        assert(isIndexValid(side.sector, sectors), `Sidedef ${i} aponta para setor inválido (${side.sector}). Total de setores: ${sectors.length}.`);
    });

    // Validação de Segs
    segs.forEach((seg, i) => {
        assert(isIndexValid(seg.v1, vertexes), `Seg ${i} aponta para v1 inválido (${seg.v1}).`);
        assert(isIndexValid(seg.v2, vertexes), `Seg ${i} aponta para v2 inválido (${seg.v2}).`);
        assert(isIndexValid(seg.linedef, linedefs), `Seg ${i} aponta para linedef inválida (${seg.linedef}).`);
    });

    // Validação de Sub-setores (SSectors)
    ssectors.forEach((ss, i) => {
        assert(ss.segCount > 0, `Subsector ${i} possui contagem de segs inválida (${ss.segCount}).`);
        assert(
            ss.firstSeg + ss.segCount <= segs.length,
            `Subsector ${i} referencia segs fora do intervalo (${ss.firstSeg} + ${ss.segCount} > ${segs.length}).`
        );
    });

    // Validação de Nodes BSP
    nodes.forEach((node, i) => {
        const children = [
            { id: node.rightChild, label: 'filhoDireito' },
            { id: node.leftChild, label: 'filhoEsquerdo' },
        ];

        for (const child of children) {
            if (child.id & NF_SUBSECTOR) {
                const subsectorIndex = child.id & ~NF_SUBSECTOR;
                assert(
                    isIndexValid(subsectorIndex, ssectors),
                    `Nó ${i} (${child.label}) referencia sub-setor inexistente (${subsectorIndex}). Total: ${ssectors.length}.`
                );
            } else {
                assert(
                    isIndexValid(child.id, nodes),
                    `Nó ${i} (${child.label}) referencia nó filho inexistente (${child.id}). Total de nós: ${nodes.length}.`
                );
            }
        }
    });
}
