/**
 * Módulo de navegação na árvore BSP (Binary Space Partitioning) do Doom.
 * Permite localizar o sub-setor e o setor correspondente a qualquer coordenada 2D do mapa.
 */

// Bit 15 indicando que o nó filho é um sub-setor (nó folha)
const NF_SUBSECTOR = 0x8000;

/**
 * Localiza o índice do sub-setor correspondente a uma coordenada 2D do Doom (x, y)
 * percorrendo a árvore BSP a partir da raiz (último nó do array NODES).
 * 
 * @param {Object} mapData Objeto contendo os dados do mapa
 * @param {number} x Coordenada X no sistema Doom
 * @param {number} y Coordenada Y no sistema Doom
 * @returns {number} Índice do sub-setor
 */
export function findSubsector(mapData, x, y) {
    if (!mapData.nodes || mapData.nodes.length === 0) {
        return 0;
    }

    // A raiz da árvore BSP é o último nó do array NODES
    let nodeIndex = mapData.nodes.length - 1;

    while (true) {
        const node = mapData.nodes[nodeIndex];

        // Vetor do ponto consultado até a origem da linha de partição
        const dx = x - node.x;
        const dy = y - node.y;

        // Produto vetorial 2D para determinar o lado da linha divisória
        // Um ponto está à direita quando node.dx * dy - node.dy * dx < 0
        const left = node.dy * dx;
        const right = dy * node.dx;

        // Se right < left, o ponto está à direita da partição (filho direito)
        const child = (right < left) ? node.rightChild : node.leftChild;

        // Se o bit 15 (0x8000) estiver ativo, encontramos a folha (sub-setor)
        if (child & NF_SUBSECTOR) {
            return child & 0x7FFF;
        }

        nodeIndex = child;
    }
}

/**
 * Localiza o índice do setor correspondente a uma coordenada 2D do Doom (x, y).
 * Utiliza findSubsector para encontrar a folha e recupera o setor através do primeiro seg.
 * 
 * @param {Object} mapData Objeto contendo os dados do mapa
 * @param {number} x Coordenada X no sistema Doom
 * @param {number} y Coordenada Y no sistema Doom
 * @returns {number} Índice do setor
 */
export function findSector(mapData, x, y) {
    const subsectorIndex = findSubsector(mapData, x, y);
    const subsector = mapData.ssectors[subsectorIndex];
    if (!subsector) return 0;

    const firstSeg = mapData.segs[subsector.firstSeg];
    if (!firstSeg) return 0;

    const linedef = mapData.linedefs[firstSeg.linedef];
    if (!linedef) return 0;

    // direction: 0 = mesmo sentido da linedef (lado direito), 1 = oposto (lado esquerdo)
    const sidedefIndex = (firstSeg.direction === 0) ? linedef.rightSidedef : linedef.leftSidedef;
    const sidedef = mapData.sidedefs[sidedefIndex];

    return sidedef ? sidedef.sector : 0;
}
