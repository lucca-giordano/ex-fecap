// Gera a geometria das paredes a partir de LINEDEFS + SIDEDEFS + SECTORS.
// Função pura (sem WebGPU) para poder ser testada isoladamente.
//
// Vértice: layout de vertexLayout.js (posição, normal, cor, uv, layer, kind).

import { NO_SIDE } from '../wad/MapData.js';
import { doomToWorld } from './coords.js';
import { packVertices, NO_TEXTURE, KIND } from './vertexLayout.js';

const COLORS = {
  middle: [0.76, 0.62, 0.45], // marrom-claro
  lower: [0.50, 0.10, 0.10],  // vermelho-escuro
  upper: [0.45, 0.52, 0.62],  // azul-acinzentado
};

const SKY = 'F_SKY1';

// Textura de parede não encontrada: camada 0 (xadrez de fallback, 64x64).
const FALLBACK = { layer: 0, width: 64, height: 64 };

const hasTexture = (name) => name !== '' && name !== '-';

// lightnum (0..15) da parede, como no Doom: luz do setor / 16, com contraste por eixo.
// Linha horizontal no mapa (y1 == y2) fica um nível mais escura; vertical (x1 == x2), um mais clara.
function wallLight(sector, a, b) {
  let light = Math.floor(sector.lightLevel / 16);
  if (a.y === b.y) light -= 1;
  else if (a.x === b.x) light += 1;
  return Math.min(15, Math.max(0, light));
}

// Contadores do relatório de buildWalls.
export function emptyWallStats() {
  return {
    quads: { middle: 0, lower: 0, upper: 0 },
    skippedLinedefs: [],      // { linedef, reason }
    ignoredMiddle2s: 0,       // texturas centrais em linedefs de dois lados
    skyUpperOmitted: 0,       // paredes superiores omitidas por F_SKY1 nos dois setores
    zeroHeightOmitted: 0,
    untextured: 0,            // peças com nome "-" (layer NO_TEXTURE)
  };
}

// Posições fixas das peças de uma linedef na geometria dinâmica (etapa 20).
export const WALL_SLOTS = { rightLower: 0, rightUpper: 1, rightMiddle: 2, leftLower: 3, leftUpper: 4 };
export const WALL_SLOT_COUNT = 5;

// Peças de parede de UMA linedef, com as alturas correntes dos setores (etapa 20: reutilizada pela
// geometria dinâmica). Devolve [{ slot, kind, info, verts: [4 vértices] }] na ordem do buildWalls
// estático (um lado: central; dois lados: direito inferior e superior, esquerdo inferior e superior).
// stats (opcional) recebe os mesmos contadores do buildWalls.
export function linedefWallQuads(map, li, wallLayers = new Map(), stats = emptyWallStats()) {
  const { linedefs, sidedefs, vertexes, sectors } = map;
  const out = [];
  const validSide = (s) => s !== NO_SIDE && s < sidedefs.length && sidedefs[s].sector < sectors.length;
  const texInfo = (name) => (hasTexture(name) ? wallLayers.get(name) ?? FALLBACK : null);

  // Quad vertical de a até b (Doom), de zBottom até zTop.
  // Ordem a-baixo, b-baixo, b-cima, a-cima: com front face CCW, a face visível é a que
  // fica à DIREITA de quem anda de a para b, com normal (dy, -dx) no Doom.
  // `a` é sempre o vértice onde o lado começa (v1 no direito, v2 no esquerdo), então
  // u = xOffset em a e xOffset + comprimento em b: o texto não sai espelhado.
  // v = base + yOffset - altura (linha 0 da textura no topo, v cresce para baixo).
  // `sector` é o setor F do lado de onde a parede é vista (fonte da luz).
  function addQuad(slot, a, b, zBottom, zTop, kind, info, texName, base, side, sector) {
    if (zTop <= zBottom) { stats.zeroHeightOmitted++; return; }

    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const normal = doomToWorld(dy / len, -dx / len, 0);
    const color = COLORS[kind];
    const tex = texInfo(texName);
    const layer = tex ? tex.layer : NO_TEXTURE;
    const light = wallLight(sector, a, b);
    if (!tex) stats.untextured++;

    const u0 = side.xOffset, u1 = side.xOffset + len;
    const v = (z) => base + side.yOffset - z;
    const verts = [];
    for (const [p, z, u] of [[a, zBottom, u0], [b, zBottom, u1], [b, zTop, u1], [a, zTop, u0]]) {
      verts.push({ pos: doomToWorld(p.x, p.y, z), normal, color, uv: [u, v(z)], layer, kind: KIND.wall, light });
    }
    out.push({ slot, kind, info, verts });
    stats.quads[kind]++;
  }

  // Altura da textura (para o pegging); "-" não importa porque a peça não é desenhada.
  const texHeight = (name) => texInfo(name)?.height ?? 0;

  // Peças de dois lados vistas do lado S (setor F) contra o lado oposto (setor B).
  function twoSidedPieces(slots, a, b, line, sIndex, F, B, info, bothSky) {
    const side = sidedefs[sIndex];
    if (B.floorHeight > F.floorHeight) {
      // Inferior: lower unpegged ancora no TETO de F (peculiaridade do Doom original).
      const base = line.lowerUnpegged ? F.ceilingHeight : B.floorHeight;
      addQuad(slots[0], a, b, F.floorHeight, B.floorHeight, 'lower', info, side.lowerTexture, base, side, F);
    }
    if (B.ceilingHeight < F.ceilingHeight) {
      if (bothSky) { stats.skyUpperOmitted++; return; }
      // Superior: upper unpegged ancora no teto de F; senão a textura "pendura" do teto de B.
      const base = line.upperUnpegged ? F.ceilingHeight : B.ceilingHeight + texHeight(side.upperTexture);
      addQuad(slots[1], a, b, B.ceilingHeight, F.ceilingHeight, 'upper', info, side.upperTexture, base, side, F);
    }
  }

  const line = linedefs[li];
  const v1 = vertexes[line.v1], v2 = vertexes[line.v2];
  if (!v1 || !v2) {
    stats.skippedLinedefs.push({ linedef: li, reason: 'vértice inválido' });
    return out;
  }
  if (!validSide(line.rightSidedef)) {
    stats.skippedLinedefs.push({ linedef: li, reason: 'sem lado direito válido' });
    return out;
  }
  if (line.leftSidedef !== NO_SIDE && !validSide(line.leftSidedef)) {
    stats.skippedLinedefs.push({ linedef: li, reason: 'lado esquerdo inválido' });
    return out;
  }

  const rs = line.rightSidedef;
  const rSide = sidedefs[rs];
  const F = sectors[rSide.sector];

  // 1) Um lado só: parede central do chão ao teto, voltada para a direita.
  if (line.leftSidedef === NO_SIDE) {
    const base = line.lowerUnpegged ? F.floorHeight + texHeight(rSide.middleTexture) : F.ceilingHeight;
    addQuad(WALL_SLOTS.rightMiddle, v1, v2, F.floorHeight, F.ceilingHeight, 'middle',
      { linedef: li, sidedef: rs, sector: rSide.sector }, rSide.middleTexture, base, rSide, F);
    return out;
  }

  // 2) Dois lados.
  const ls = line.leftSidedef;
  const lSide = sidedefs[ls];
  const B = sectors[lSide.sector];

  if (hasTexture(rSide.middleTexture)) stats.ignoredMiddle2s++;
  if (hasTexture(lSide.middleTexture)) stats.ignoredMiddle2s++;

  // 3) Regra do céu: com F_SKY1 nos dois tetos não há parede superior.
  const bothSky = F.ceilingTexture === SKY && B.ceilingTexture === SKY;

  // Lado direito usa v1 -> v2; lado esquerdo inverte (v2 -> v1) e troca F e B.
  twoSidedPieces([WALL_SLOTS.rightLower, WALL_SLOTS.rightUpper], v1, v2, line, rs, F, B,
    { linedef: li, sidedef: rs, sector: rSide.sector }, bothSky);
  twoSidedPieces([WALL_SLOTS.leftLower, WALL_SLOTS.leftUpper], v2, v1, line, ls, B, F,
    { linedef: li, sidedef: ls, sector: lSide.sector }, bothSky);
  return out;
}

// wallLayers: Map nome -> { layer, width, height } (vem de TextureSet).
// exclude (etapa 20): { linedefs: Set } de linhas desenhadas pela geometria dinâmica (padrão: nenhuma).
export function buildWalls(map, wallLayers = new Map(), exclude = { linedefs: new Set() }) {
  const verts = [];
  const indices = [];
  const quadInfo = [];
  const stats = emptyWallStats();
  map.linedefs.forEach((line, li) => {
    if (exclude.linedefs?.has(li)) return;
    for (const q of linedefWallQuads(map, li, wallLayers, stats)) {
      const base0 = verts.length;
      verts.push(...q.verts);
      indices.push(base0, base0 + 1, base0 + 2, base0, base0 + 2, base0 + 3);
      quadInfo.push({ ...q.info, kind: q.kind });
    }
  });

  return {
    vertices: packVertices(verts),
    vertexCount: verts.length,
    indices: new Uint32Array(indices),
    quadInfo,
    stats,
  };
}
