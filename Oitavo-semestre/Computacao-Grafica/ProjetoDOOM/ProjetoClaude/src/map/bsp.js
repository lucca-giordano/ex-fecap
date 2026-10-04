// Busca na árvore BSP do mapa (coordenadas do Doom).

import { NF_SUBSECTOR, NO_SIDE } from '../wad/MapData.js';

// Índice do subsector que contém o ponto (x, y).
export function findSubsector(map, x, y) {
  const { nodes } = map;
  if (nodes.length === 0) return 0; // mapa com um único subsector não tem nós

  let child = nodes.length - 1; // a raiz é o último nó
  for (;;) {
    const node = nodes[child];
    const dx = x - node.x;
    const dy = y - node.y;
    // Produto vetorial entre a linha de partição e o ponto (igual a R_PointOnSide do Doom).
    const left = node.dy * dx;
    const right = dy * node.dx;
    child = right < left ? node.rightChild : node.leftChild;
    if (child & NF_SUBSECTOR) return child & 0x7FFF;
  }
}

// Índice do setor que contém o ponto (x, y).
export function findSector(map, x, y) {
  const ss = map.ssectors[findSubsector(map, x, y)];
  const seg = map.segs[ss.firstSeg];
  const line = map.linedefs[seg.linedef];
  // direction 0: o seg segue a linedef, então está no lado direito; 1: lado esquerdo.
  const side = seg.direction === 0 ? line.rightSidedef : line.leftSidedef;
  if (side === NO_SIDE) return -1;
  return map.sidedefs[side].sector;
}
