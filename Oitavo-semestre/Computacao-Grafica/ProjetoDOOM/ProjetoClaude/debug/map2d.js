// Página de depuração: desenha as linedefs de um mapa em Canvas 2D e imprime estatísticas.

import { WadFile } from '../src/wad/WadFile.js';
import { loadMap } from '../src/wad/MapData.js';

const WAD_URL = new URL('../assets/freedoom1.wad', import.meta.url);
const MAP_NAME = 'E1M1';
const MARGIN = 20; // pixels

function showError(text) {
  const el = document.getElementById('msg');
  el.textContent = text;
  el.style.display = 'flex';
  console.error(text);
}

function computeBounds(vertexes) {
  const b = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (const v of vertexes) {
    b.minX = Math.min(b.minX, v.x); b.maxX = Math.max(b.maxX, v.x);
    b.minY = Math.min(b.minY, v.y); b.maxY = Math.max(b.maxY, v.y);
  }
  return b;
}

function printStats(map, bounds, start) {
  console.log(`Mapa ${map.name}: contagem de registros`);
  console.table({
    things: map.things.length,
    linedefs: map.linedefs.length,
    sidedefs: map.sidedefs.length,
    vertexes: map.vertexes.length,
    segs: map.segs.length,
    ssectors: map.ssectors.length,
    nodes: map.nodes.length,
    sectors: map.sectors.length,
  });
  console.log(`Limites: x [${bounds.minX}, ${bounds.maxX}], y [${bounds.minY}, ${bounds.maxY}]`);
  console.log(start
    ? `Início do jogador 1: (${start.x}, ${start.y}), ângulo ${start.angle}°`
    : 'Início do jogador 1: não encontrado');

  const floors = map.sectors.map((s) => s.floorHeight);
  const ceils = map.sectors.map((s) => s.ceilingHeight);
  console.log(`Altura do chão: ${Math.min(...floors)} a ${Math.max(...floors)}`);
  console.log(`Altura do teto: ${Math.min(...ceils)} a ${Math.max(...ceils)}`);

  // "-" e vazio significam sem textura, então não contam.
  const wallTex = new Set();
  for (const s of map.sidedefs) {
    for (const t of [s.upperTexture, s.lowerTexture, s.middleTexture]) {
      if (t && t !== '-') wallTex.add(t);
    }
  }
  const flatTex = new Set();
  for (const s of map.sectors) { flatTex.add(s.floorTexture); flatTex.add(s.ceilingTexture); }
  console.log(`Texturas distintas: ${wallTex.size} nas sidedefs, ${flatTex.size} nos setores`);
}

function draw(canvas, map, bounds, start) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(canvas.clientWidth * dpr);
  canvas.height = Math.floor(canvas.clientHeight * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const w = canvas.clientWidth, h = canvas.clientHeight;
  const mapW = bounds.maxX - bounds.minX, mapH = bounds.maxY - bounds.minY;
  // Mesma escala nos dois eixos para não distorcer o mapa.
  const scale = Math.min((w - 2 * MARGIN) / mapW, (h - 2 * MARGIN) / mapH);
  const offX = (w - mapW * scale) / 2, offY = (h - mapH * scale) / 2;

  // O y do Doom cresce para o norte; o do canvas cresce para baixo. Por isso usamos maxY - y.
  const sx = (x) => offX + (x - bounds.minX) * scale;
  const sy = (y) => offY + (bounds.maxY - y) * scale;

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.lineWidth = 1;

  // Desenha primeiro as de dois lados (cinza) para as de um lado (branco) ficarem por cima.
  for (const twoSided of [true, false]) {
    ctx.strokeStyle = twoSided ? '#777' : '#fff';
    ctx.beginPath();
    for (const l of map.linedefs) {
      if (l.twoSided !== twoSided) continue;
      const a = map.vertexes[l.v1], b = map.vertexes[l.v2];
      ctx.moveTo(sx(a.x), sy(a.y));
      ctx.lineTo(sx(b.x), sy(b.y));
    }
    ctx.stroke();
  }

  if (start) {
    // Seta: no canvas o y é invertido, então o seno entra com sinal negativo.
    const a = start.angle * Math.PI / 180;
    const px = sx(start.x), py = sy(start.y);
    const len = 18;
    const tip = [px + Math.cos(a) * len, py - Math.sin(a) * len];
    const side = (da) => [tip[0] - Math.cos(a + da) * 8, tip[1] + Math.sin(a + da) * 8];
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py); ctx.lineTo(...tip);
    ctx.moveTo(...side(0.5)); ctx.lineTo(...tip); ctx.lineTo(...side(-0.5));
    ctx.stroke();
    ctx.fillStyle = '#0f0';
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

async function main() {
  const wad = await WadFile.fromUrl(WAD_URL);
  console.log(`${wad.type} com ${wad.lumps.length} lumps`);

  const map = loadMap(wad, MAP_NAME);
  const bounds = computeBounds(map.vertexes);
  const start = map.things.find((t) => t.type === 1); // type 1 = início do jogador 1

  printStats(map, bounds, start);

  const canvas = document.getElementById('map');
  const redraw = () => draw(canvas, map, bounds, start);
  redraw();
  window.addEventListener('resize', redraw);
}

main().catch((err) => showError(err.message));
