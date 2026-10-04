// Geometria dos setores móveis (etapa 20). Puro: sem WebGPU (o main envia os bytes aos buffers).
//
// As linhas que tocam um setor móvel e as linhas de interruptor saem da geometria estática e são
// desenhadas aqui, com as mesmas funções (linedefWallQuads, flatVertices), as mesmas texturas e o
// mesmo layout de vértice. Cada linha tem 5 quads em posições fixas (direita baixa, alta e central,
// esquerda baixa e alta); um quad que não se aplica no estado corrente fica zerado (degenerado).
// Depois das paredes vêm os planos: um polígono de chão e um de teto por subsector de setor móvel.
// Os índices são fixos; só os vértices mudam (writeBuffer do buffer inteiro quando sujo).

import { linedefWallQuads, WALL_SLOT_COUNT } from './buildWalls.js';
import { flatVertices } from './buildFlats.js';
import { WORDS_PER_VERTEX, VERTEX_STRIDE, writeVertex, clearVertex } from './vertexLayout.js';

export class DynamicGeometry {
  // map: mapa (alturas e texturas correntes); lines e sectors: conjuntos dinâmicos; subsectorInfo:
  // de buildFlats (polígonos de todos os subsectors); wallLayers e flatLayers: de TextureSet.
  constructor(map, { lines, sectors }, subsectorInfo, wallLayers, flatLayers) {
    this.map = map;
    this.wallLayers = wallLayers;
    this.flatLayers = flatLayers;
    this.lines = [...lines].sort((a, b) => a - b);
    this.sectors = [...sectors].sort((a, b) => a - b);
    this.lineSlot = new Map(this.lines.map((li, i) => [li, i]));

    // Polígonos dos setores móveis, com a posição do primeiro vértice de cada plano.
    let vertex = this.lines.length * WALL_SLOT_COUNT * 4;
    this.wallVertexCount = vertex;
    this.planes = new Map(this.sectors.map((s) => [s, []]));
    for (const info of subsectorInfo) {
      if (!info || !this.planes.has(info.sector)) continue;
      const n = info.polygon.length;
      this.planes.get(info.sector).push({ polygon: info.polygon, floorAt: vertex, ceilAt: vertex + n });
      vertex += 2 * n;
    }
    this.vertexCount = vertex;

    // Dois conjuntos de vértices com as mesmas posições: cor por flat e cor por setor (como os flats).
    this.vertices = new Float32Array(vertex * WORDS_PER_VERTEX);
    this.sectorVertices = new Float32Array(vertex * WORDS_PER_VERTEX);
    this.u32 = new Uint32Array(this.vertices.buffer);
    this.sectorU32 = new Uint32Array(this.sectorVertices.buffer);

    // Índices fixos: quads (0, 1, 2, 0, 2, 3), como o estático; planos em leque.
    const indices = [];
    for (let q = 0; q < this.lines.length * WALL_SLOT_COUNT; q++) {
      const b = q * 4;
      indices.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    for (const list of this.planes.values()) {
      for (const p of list) {
        for (const base of [p.floorAt, p.ceilAt]) {
          for (let k = 1; k < p.polygon.length - 1; k++) indices.push(base, base + k, base + k + 1);
        }
      }
    }
    this.indices = new Uint32Array(indices);
    this.byteLength = this.vertices.byteLength;
    this.dirty = true;
    this.markAll();
  }

  get stride() {
    return VERTEX_STRIDE;
  }

  // Recalcula os 5 quads da linha li.
  updateLinedef(li) {
    const slot = this.lineSlot.get(li);
    if (slot === undefined) return;
    const first = slot * WALL_SLOT_COUNT * 4;
    for (let v = first; v < first + WALL_SLOT_COUNT * 4; v++) {
      clearVertex(this.vertices, v);
      clearVertex(this.sectorVertices, v);
    }
    for (const q of linedefWallQuads(this.map, li, this.wallLayers)) {
      q.verts.forEach((vert, k) => {
        const at = first + q.slot * 4 + k;
        writeVertex(this.vertices, this.u32, at, vert);
        writeVertex(this.sectorVertices, this.sectorU32, at, vert); // paredes iguais nos dois modos
      });
    }
    this.dirty = true;
  }

  // Recalcula os planos do setor s e as linhas que o tocam.
  updateSector(s, sectorLines = null) {
    const list = this.planes.get(s);
    if (list) {
      const sector = this.map.sectors[s];
      for (const p of list) {
        const fv = flatVertices(sector, s, p.polygon, this.flatLayers);
        for (const [plane, at] of [[fv.floor, p.floorAt], [fv.ceiling, p.ceilAt]]) {
          plane.flat.forEach((v, k) => writeVertex(this.vertices, this.u32, at + k, v));
          plane.sector.forEach((v, k) => writeVertex(this.sectorVertices, this.sectorU32, at + k, v));
        }
      }
    }
    for (const li of sectorLines ?? []) this.updateLinedef(li);
    this.dirty = true;
  }

  markAll() {
    for (const li of this.lines) this.updateLinedef(li);
    for (const s of this.sectors) this.updateSector(s);
    this.dirty = true;
  }
}

// Conjuntos dinâmicos: setores móveis e linhas que os tocam, mais as linhas de interruptor.
export function dynamicSets(level, movableSectors, switchLines) {
  const lines = new Set(switchLines);
  for (const s of movableSectors) for (const li of level.sectorLines[s]) lines.add(li);
  return { lines, sectors: new Set(movableSectors) };
}
