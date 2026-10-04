// Gera chão e teto de cada subsector.
// Função pura (sem WebGPU) para poder ser testada isoladamente.
//
// Um subsector é convexo, mas os SEGS só listam os lados que coincidem com linedefs. Os outros
// lados vêm das linhas de partição dos NODES ancestrais. Por isso o polígono é obtido recortando
// um retângulo grande contra todos esses semiplanos (Sutherland-Hodgman).
//
// Vértice: layout de vertexLayout.js, igual ao de buildWalls.

import { NF_SUBSECTOR } from '../wad/MapData.js';
import { doomToWorld } from './coords.js';
import { packVertices, KIND } from './vertexLayout.js';

const SKY = 'F_SKY1';
const SKY_COLOR = [0.35, 0.60, 0.95];
const CEIL_DIM = 0.8;
const BOX_MARGIN = 256;
const ON_LINE_EPS = 1e-7;
const DUP_EPS = 0.001;
const MIN_AREA = 0.01;

// Normal (0,0,0) avisa o shader para não sombrear (usada no céu).
const NO_SHADE = [0, 0, 0];

// ---------- Geometria 2D (coordenadas do Doom) ----------

// Semiplano "à direita" da linha (x, y) + t*(dx, dy). Distância com sinal: < 0 = à direita.
function signedDist(h, px, py) {
  return (h.dx * (py - h.y) - h.dy * (px - h.x)) / h.len;
}

function halfPlane(x, y, dx, dy) {
  return { x, y, dx, dy, len: Math.hypot(dx, dy) };
}

// Sutherland-Hodgman contra um semiplano: mantém o que está à direita (ou sobre a linha).
function clip(poly, h) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const da = signedDist(h, a[0], a[1]);
    const db = signedDist(h, b[0], b[1]);
    const aIn = da < ON_LINE_EPS, bIn = db < ON_LINE_EPS;
    if (aIn) out.push(a);
    if (aIn !== bIn) {
      // A aresta cruza a linha: insere o ponto de interseção.
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

function removeDuplicates(poly) {
  const out = [];
  for (const p of poly) {
    const q = out[out.length - 1];
    if (!q || Math.abs(p[0] - q[0]) > DUP_EPS || Math.abs(p[1] - q[1]) > DUP_EPS) out.push(p);
  }
  // O último pode repetir o primeiro (polígono fechado).
  while (out.length > 1) {
    const a = out[0], z = out[out.length - 1];
    if (Math.abs(a[0] - z[0]) > DUP_EPS || Math.abs(a[1] - z[1]) > DUP_EPS) break;
    out.pop();
  }
  return out;
}

// Área com sinal (shoelace): positiva = anti-horário no sistema do Doom (y para o norte).
function signedArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

// ---------- Cores ----------

// Hash FNV-1a de 32 bits: estável e simples.
function hashString(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

// Matiz a partir do hash; saturação e brilho variam um pouco para separar cores vizinhas.
function hashColor(key) {
  const h = hashString(String(key));
  const hue = (h % 360) / 60;
  const sat = 0.45 + ((h >>> 9) % 30) / 100;
  const val = 0.55 + ((h >>> 17) % 35) / 100;
  const c = val * sat, x = c * (1 - Math.abs((hue % 2) - 1)), m = val - c;
  const [r, g, b] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(hue) % 6];
  return [r + m, g + m, b + m];
}

const dim = (c, k) => c.map((v) => v * k);

// Vértices do chão e do teto de um polígono de subsector, nas alturas correntes do setor (etapa 20:
// reutilizada pela geometria dinâmica). Devolve { floor, ceiling }, cada um { flat, sector }: as mesmas
// posições com a cor por flat ou por setor. O chão segue o polígono (anti-horário, face para cima) e
// o teto, a ordem inversa.
export function flatVertices(sector, sectorIndex, poly, flatLayers = new Map()) {
  const isSky = sector.ceilingTexture === SKY;
  const floorFlatColor = hashColor(sector.floorTexture);
  const ceilFlatColor = isSky ? SKY_COLOR : dim(hashColor(sector.ceilingTexture), CEIL_DIM);
  const secColor = hashColor(`sector${sectorIndex}`);
  const ceilSecColor = isSky ? SKY_COLOR : dim(secColor, CEIL_DIM);

  // A conversão para o mundo é uma rotação (det = +1), então o anti-horário do Doom visto de
  // cima continua anti-horário visto de +Y: o chão usa essa ordem (face para cima) e o teto a
  // inversa (face para baixo).
  //
  // UV dos flats: u = x e v = -y do Doom, calculados na posição ORIGINAL do vértice (antes de
  // doomToWorld). O shader faz floor() e módulo 64, então o flat fica ancorado ao mundo e o
  // padrão é contínuo entre subsectors vizinhos. O -y deixa a linha 0 do flat ao norte, como no Doom.
  // lightnum dos flats: luz do setor / 16, sem o contraste das paredes.
  const light = Math.min(15, Math.max(0, Math.floor(sector.lightLevel / 16)));
  const emit = (z, normal, flatColor, sectorColor, order, layer, kind) => {
    const flat = [], sec = [];
    for (const p of order) {
      const pos = doomToWorld(p[0], p[1], z);
      const uv = [p[0], -p[1]];
      flat.push({ pos, normal, color: flatColor, uv, layer, kind, light });
      sec.push({ pos, normal, color: sectorColor, uv, layer, kind, light });
    }
    return { flat, sector: sec };
  };

  const flatLayer = (name) => flatLayers.get(name)?.layer ?? 0; // 0 = fallback
  return {
    floor: emit(sector.floorHeight, [0, 1, 0], floorFlatColor, secColor, poly,
      flatLayer(sector.floorTexture), KIND.flat),
    ceiling: emit(sector.ceilingHeight, isSky ? NO_SHADE : [0, -1, 0], ceilFlatColor, ceilSecColor,
      poly.slice().reverse(), isSky ? 0 : flatLayer(sector.ceilingTexture), isSky ? KIND.sky : KIND.flat),
  };
}

// ---------- Construção ----------

// flatLayers: Map nome -> { layer } (vem de TextureSet). Flat ausente usa a camada 0 (fallback).
// exclude (etapa 20): { sectors: Set } de setores desenhados pela geometria dinâmica (padrão: nenhum).
// subsectorInfo continua com todos os subsectors (inclusive os excluídos).
export function buildFlats(map, flatLayers = new Map(), exclude = { sectors: new Set() }) {
  const { nodes, ssectors, segs, linedefs, sidedefs, sectors, vertexes } = map;

  // Retângulo inicial: limites do mapa com margem.
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const v of vertexes) {
    minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
    minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
  }
  minX -= BOX_MARGIN; maxX += BOX_MARGIN; minY -= BOX_MARGIN; maxY += BOX_MARGIN;
  const box = [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]];

  const polygons = new Array(ssectors.length).fill(null);

  // Percurso em profundidade guardando os semiplanos dos ancestrais.
  function visit(child, planes) {
    if (child & NF_SUBSECTOR) {
      polygons[child & 0x7FFF] = planes.slice();
      return;
    }
    const n = nodes[child];
    planes.push(halfPlane(n.x, n.y, n.dx, n.dy));        // filho direito: lado direito
    visit(n.rightChild, planes);
    planes.pop();
    planes.push(halfPlane(n.x, n.y, -n.dx, -n.dy));      // filho esquerdo: inverter = lado esquerdo
    visit(n.leftChild, planes);
    planes.pop();
  }
  if (nodes.length === 0) polygons[0] = [];
  else visit(nodes.length - 1, []);

  const flatVerts = [];
  const sectorVerts = [];
  const indices = [];
  const subsectorInfo = new Array(ssectors.length).fill(null);
  const stats = { subsectors: ssectors.length, polygons: 0, discarded: [], triangles: 0, totalArea: 0 };

  ssectors.forEach((ss, i) => {
    let poly = box;
    for (const h of polygons[i] ?? []) poly = clip(poly, h);
    // Segs: o interior do subsector fica à direita de v1 -> v2 (como estão no lump).
    for (let k = 0; k < ss.segCount; k++) {
      const s = segs[ss.firstSeg + k];
      const a = vertexes[s.v1], b = vertexes[s.v2];
      poly = clip(poly, halfPlane(a.x, a.y, b.x - a.x, b.y - a.y));
    }
    poly = removeDuplicates(poly);

    let area = poly.length >= 3 ? signedArea(poly) : 0;
    if (poly.length < 3 || Math.abs(area) < MIN_AREA) {
      stats.discarded.push(i);
      return;
    }
    // Garante sentido anti-horário no Doom (área positiva).
    if (area < 0) { poly.reverse(); area = -area; }

    // Setor: primeiro seg -> linedef -> sidedef do lado indicado por direction -> setor.
    const seg = segs[ss.firstSeg];
    const line = linedefs[seg.linedef];
    const sectorIndex = sidedefs[seg.direction === 0 ? line.rightSidedef : line.leftSidedef].sector;
    const sector = sectors[sectorIndex];
    const isSky = sector.ceilingTexture === SKY;

    subsectorInfo[i] = {
      sector: sectorIndex,
      floorFlat: sector.floorTexture,
      ceilFlat: sector.ceilingTexture,
      polygon: poly,
      area,
      isSky,
    };
    stats.polygons++;
    stats.totalArea += area;

    if (exclude.sectors?.has(sectorIndex)) return; // etapa 20: desenhado pela geometria dinâmica
    const fv = flatVertices(sector, sectorIndex, poly, flatLayers);
    // Leque: (v0, vi, vi+1), válido porque o polígono é convexo.
    for (const plane of [fv.floor, fv.ceiling]) {
      const base = flatVerts.length;
      flatVerts.push(...plane.flat);
      sectorVerts.push(...plane.sector);
      for (let k = 1; k < plane.flat.length - 1; k++) indices.push(base, base + k, base + k + 1);
      stats.triangles += plane.flat.length - 2;
    }
  });

  return {
    vertices: packVertices(flatVerts),
    sectorColorVertices: packVertices(sectorVerts), // mesmos vértices, cor por setor (tecla V)
    vertexCount: flatVerts.length,
    indices: new Uint32Array(indices),
    subsectorInfo,
    stats,
  };
}

// Distância com sinal até a borda de um polígono anti-horário: >= 0 = dentro ou na borda.
// Exportada para as validações.
export function distanceInside(poly, px, py) {
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ex = b[0] - a[0], ey = b[1] - a[1];
    // Num polígono anti-horário o interior fica à esquerda de cada aresta.
    d = Math.min(d, (ex * (py - a[1]) - ey * (px - a[0])) / Math.hypot(ex, ey));
  }
  return d;
}
