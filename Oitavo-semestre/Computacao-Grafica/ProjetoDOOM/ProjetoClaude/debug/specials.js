// Página de depuração da etapa 20: linhas do E1M1 coloridas pelo especial, setores móveis com o tom
// da altura corrente, histograma, avisos, ativação simulada (uso e cruzamento) e thinkers. Canvas 2D,
// sem WebGPU, com as MESMAS funções puras do jogo (LevelState, specials, Doors, Platforms, UseLines).

import { WadFile } from '../src/wad/WadFile.js';
import { loadMap } from '../src/wad/MapData.js';
import { readTextureDefs } from '../src/wad/Textures.js';
import { buildFlats } from '../src/map/buildFlats.js';
import { LevelState, targetsFit } from '../src/game/LevelState.js';
import { SPECIALS, analyzeSpecials, isSwitchSpecial, switchTextureOf, switchCounterpart } from '../src/game/specials.js';
import { doorTop } from '../src/game/Doors.js';
import { activateLine, tickLevel } from '../src/game/UseLines.js';
import { TICS_PER_SECOND } from '../src/game/aiTable.js';

const WAD_URL = new URL('../assets/freedoom1.wad', import.meta.url);
const MAP_NAME = 'E1M1';
const MARGIN = 20;
const KEY_COLOR = { blue: '#36f', yellow: '#ff4', red: '#f44' };
const $ = (id) => document.getElementById(id);

function showError(text) {
  $('msg').textContent = text;
  console.error(text);
}

// Cor da linha pelo especial (atual).
function lineColor(special) {
  if (!special) return null;
  const sp = SPECIALS[special];
  if (!sp) return '#f80';
  if (sp.action === 'exit') return '#fff';
  if (sp.key) return KEY_COLOR[sp.key];
  if (sp.trigger === 'cross') return '#4f4';
  if (isSwitchSpecial(sp)) return '#f8f';
  return '#4cf';
}

async function main() {
  const wad = await WadFile.fromUrl(WAD_URL);
  const map = loadMap(wad, MAP_NAME);
  const defs = readTextureDefs(wad);
  const level = new LevelState(map);
  const info = analyzeSpecials(map, level.tagMap);
  const polygons = buildFlats(map).subsectorInfo.filter(Boolean);
  const log = [];
  const ctx = {
    get keys() { return $('keys').checked ? { blueCard: true, yellowCard: true, redCard: true } : {}; },
    dead: false,
    sound: (name, s) => log.unshift(`som ${name}${s === null || s === undefined ? ' (jogador)' : ` no setor ${s}`}`),
    message: (key) => log.unshift(`mensagem ${key}`),
    textureExists: (n) => defs.has(n),
    warn: (t) => log.unshift(`aviso: ${t}`),
    fits: (s, gap) => targetsFit([], s, gap),
    onFloorMoved: () => {},
  };
  let tics = 0;

  // Histograma e avisos (uma vez).
  const hist = new Map();
  map.linedefs.forEach((l, i) => {
    if (!l.special) return;
    if (!hist.has(l.special)) hist.set(l.special, { n: 0, tags: new Set(), lines: [] });
    const h = hist.get(l.special);
    h.n++; h.tags.add(l.tag); h.lines.push(i);
  });
  const table = $('hist');
  table.innerHTML = '<tr><th>nº</th><th>qtd</th><th>descrição</th><th>tags e setores alvo</th></tr>';
  for (const [sp, h] of [...hist].sort((a, b) => a[0] - b[0])) {
    const tr = document.createElement('tr');
    const targets = [...h.tags].map((t) => (t === 0 ? 'manual (setor de trás)' : `tag ${t} -> [${(level.tagMap.get(t) ?? []).join(', ')}]`)).join('; ');
    for (const [text, cls] of [[sp], [h.n], [SPECIALS[sp] ? SPECIALS[sp].desc : 'NÃO SUPORTADO', SPECIALS[sp] ? '' : 'no'], [targets]]) {
      const td = document.createElement('td');
      td.textContent = String(text);
      if (cls) td.className = cls;
      tr.append(td);
    }
    table.append(tr);
  }
  const warnings = [...info.warnings];
  for (const s of info.movableSectors) {
    const sec = map.sectors[s];
    if (sec.ceilingHeight === sec.floorHeight && doorTop(level, s) - sec.floorHeight < 56) warnings.push(`setor ${s}: porta abre menos de 56`);
  }
  map.linedefs.forEach((l, li) => {
    const sw = l.special && switchTextureOf(map.sidedefs[l.rightSidedef]);
    if (sw && !defs.has(switchCounterpart(sw.name))) warnings.push(`linha ${li}: ${sw.name} sem contraparte`);
  });
  $('warnings').textContent = warnings.join('\n') || 'nenhum';

  // Desenho.
  const canvas = $('map');
  const g = canvas.getContext('2d');
  let view = null;
  let selected = -1;
  function layout() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const xs = map.vertexes.map((v) => v.x), ys = map.vertexes.map((v) => v.y);
    const b = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const scale = Math.min((w - 2 * MARGIN) / (b.maxX - b.minX), (h - 2 * MARGIN) / (b.maxY - b.minY));
    const offX = (w - (b.maxX - b.minX) * scale) / 2, offY = (h - (b.maxY - b.minY) * scale) / 2;
    view = { scale, sx: (x) => offX + (x - b.minX) * scale, sy: (y) => offY + (b.maxY - y) * scale,
      mx: (px) => b.minX + (px - offX) / scale, my: (py) => b.maxY - (py - offY) / scale };
  }
  function draw() {
    const { sx, sy } = view;
    g.fillStyle = '#000';
    g.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    // Setores móveis: tom proporcional à fração aberta (portas: teto; elevadores: chão).
    for (const p of polygons) {
      if (!info.movableSectors.has(p.sector)) continue;
      const sec = map.sectors[p.sector], orig = level.origHeights[p.sector];
      const isDoor = orig.ceiling === orig.floor;
      const frac = isDoor
        ? (sec.ceilingHeight - sec.floorHeight) / Math.max(1, doorTop(level, p.sector) - sec.floorHeight)
        : (orig.floor - sec.floorHeight) / Math.max(1, orig.floor - Math.min(orig.floor, level.lowestNeighborFloor(p.sector)));
      const k = Math.max(0, Math.min(1, frac));
      g.fillStyle = isDoor ? `rgba(80, 200, 255, ${0.15 + 0.6 * k})` : `rgba(120, 255, 120, ${0.15 + 0.6 * k})`;
      g.beginPath();
      p.polygon.forEach(([x, y], i) => (i ? g.lineTo(sx(x), sy(y)) : g.moveTo(sx(x), sy(y))));
      g.fill();
    }
    map.linedefs.forEach((l, li) => {
      const a = map.vertexes[l.v1], b = map.vertexes[l.v2];
      const color = lineColor(level.lineSpecial[li]) ?? (l.leftSidedef === 0xFFFF ? '#ccc' : '#444');
      g.strokeStyle = li === selected ? '#f0f' : color;
      g.lineWidth = li === selected ? 4 : level.lineSpecial[li] ? 2.5 : 1;
      g.beginPath();
      g.moveTo(sx(a.x), sy(a.y));
      g.lineTo(sx(b.x), sy(b.y));
      g.stroke();
    });
    $('thinkers').textContent = [...level.thinkers.values()].map((t) => {
      const sec = map.sectors[t.sector];
      return t.kind === 'door'
        ? `porta ${t.type} setor ${t.sector} direção ${t.direction} teto ${sec.ceilingHeight}/${t.topheight}${t.direction === 0 ? ` espera ${t.topcountdown}` : ''}`
        : `elevador setor ${t.sector} ${t.status} chão ${sec.floorHeight} (de ${t.high} a ${t.low})${t.status === 'waiting' ? ` espera ${t.count}` : ''}`;
    }).join('\n') || 'nenhum';
    $('thinkers').textContent += `\ntics ${tics} (${(tics / TICS_PER_SECOND).toFixed(1)} s); botões SR: ${level.buttons.length}` +
      `${level.finished ? '; FASE TERMINADA' : ''}`;
    log.length = Math.min(log.length, 20);
    $('log').textContent = log.join('\n');
    if (selected >= 0) {
      const l = map.linedefs[selected];
      const sp = SPECIALS[level.lineSpecial[selected]];
      $('selected').textContent = `linha ${selected}: especial ${level.lineSpecial[selected]} (${sp ? sp.desc : level.lineSpecial[selected] ? 'não suportado' : 'nenhum'}), tag ${l.tag}`;
    }
  }

  // Seleção: linha mais próxima do clique (até 12 pixels).
  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = view.mx(e.clientX - r.left), y = view.my(e.clientY - r.top);
    let best = -1, bestD = 12 / view.scale;
    map.linedefs.forEach((l, li) => {
      const a = map.vertexes[l.v1], b = map.vertexes[l.v2];
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      const d = Math.hypot(a.x + dx * t - x, a.y + dy * t - y);
      if (d < bestD) { bestD = d; best = li; }
    });
    selected = best;
    draw();
  });
  const simulate = (trigger) => {
    if (selected < 0) return;
    const sp = SPECIALS[level.lineSpecial[selected]];
    if (sp && sp.trigger !== trigger) { log.unshift(`linha ${selected}: o especial é de ${sp.trigger}, não de ${trigger}`); draw(); return; }
    const r = activateLine(level, selected, ctx, 'player');
    log.unshift(`${trigger} linha ${selected}: ${r.ok ? 'acionou' : 'nada'} (${r.reason})`);
    draw();
  };
  $('use').onclick = () => simulate('use');
  $('cross').onclick = () => simulate('cross');
  let playing = false;
  $('play').onclick = () => { playing = !playing; $('play').textContent = playing ? 'Pause' : 'Play'; };
  const tick = () => { tickLevel(level, ctx); level.advanceClock(); tics++; };
  $('step').onclick = () => { tick(); draw(); };
  $('reset').onclick = () => { level.reset(); tics = 0; log.length = 0; draw(); };
  window.addEventListener('resize', () => { layout(); draw(); });

  let last = performance.now(), acc = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (playing) {
      acc += dt * TICS_PER_SECOND * Number($('speed').value);
      while (acc >= 1) { tick(); acc -= 1; }
      draw();
    }
    requestAnimationFrame(frame);
  }
  layout();
  draw();
  requestAnimationFrame(frame);
}

main().catch((err) => showError(err.message));
