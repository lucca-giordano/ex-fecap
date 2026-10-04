// Dados de colisão das linhas do mapa, calculados uma vez ao carregar. Puro: sem DOM e sem WebGPU.
// Coordenadas do Doom (x leste, y norte).

import { NO_SIDE } from '../wad/MapData.js';

// Para cada linedef válida: vértices, caixa delimitadora, setor da frente (sidedef direito), setor de
// trás (sidedef esquerdo, ou -1), se tem um lado só e as flags brutas.
export function buildCollisionLines(map) {
  const { linedefs, sidedefs, vertexes, sectors } = map;
  const validSide = (s) => s !== NO_SIDE && s < sidedefs.length && sidedefs[s].sector < sectors.length;
  const lines = [];
  linedefs.forEach((l, index) => {
    const a = vertexes[l.v1], b = vertexes[l.v2];
    if (!a || !b || !validSide(l.rightSidedef)) return;
    const back = l.leftSidedef !== NO_SIDE && validSide(l.leftSidedef) ? sidedefs[l.leftSidedef].sector : -1;
    lines.push({
      index,
      x1: a.x, y1: a.y, x2: b.x, y2: b.y,
      minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x),
      minY: Math.min(a.y, b.y), maxY: Math.max(a.y, b.y),
      front: sidedefs[l.rightSidedef].sector,
      back,
      oneSided: back < 0,
      flags: l.flags,
    });
  });
  return lines;
}
