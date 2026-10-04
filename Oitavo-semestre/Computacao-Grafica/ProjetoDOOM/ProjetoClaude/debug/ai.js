// Página de depuração da IA (etapa 18): mapa 2D do E1M1 com monstros, alvo, setores alertados e
// linhas de visão, em Canvas 2D e sem WebGPU. Usa as MESMAS funções puras do jogo (MonsterSystem,
// MonsterAI, checkSight, noiseAlert); o jogador é um ponto posicionado com o mouse.

import { WadFile } from '../src/wad/WadFile.js';
import { loadMap } from '../src/wad/MapData.js';
import { findSector } from '../src/map/bsp.js';
import { buildFlats } from '../src/map/buildFlats.js';
import { findSpriteLumps } from '../src/wad/Sprites.js';
import { buildCollisionLines } from '../src/physics/collisionData.js';
import { buildSpriteScene } from '../src/sprites/spriteLogic.js';
import { staticSolids } from '../src/physics/solids.js';
import { Rng } from '../src/game/Rng.js';
import { resolveMonsterTable, extraSpriteFrames } from '../src/game/monsterTable.js';
import { MonsterSystem } from '../src/game/MonsterSystem.js';
import { MonsterAI } from '../src/game/MonsterAI.js';
import { PlayerDamageSink } from '../src/game/PlayerDamageSink.js';
import { checkSight } from '../src/game/sight.js';
import { TICS_PER_SECOND } from '../src/game/aiTable.js';

const WAD_URL = new URL('../assets/freedoom1.wad', import.meta.url);
const MAP_NAME = 'E1M1';
const MARGIN = 20;
const STATE_COLOR = { stand: '#888', chase: '#fd3', melee: '#f33', missile: '#f33', pain: '#f3f', die: '#533', xdie: '#533', dead: '#533' };
const $ = (id) => document.getElementById(id);

function showError(text) {
  $('msg').textContent = text;
  console.error(text);
}

async function main() {
  const wad = await WadFile.fromUrl(WAD_URL);
  const map = loadMap(wad, MAP_NAME);
  const { lumps } = findSpriteLumps(wad);
  const table = resolveMonsterTable(lumps, new Set(map.things.map((t) => t.type)));
  const scene = buildSpriteScene(wad, map, { extraFrames: extraSpriteFrames(table.entries) });
  const world = { map, lines: buildCollisionLines(map), sectors: map.sectors };
  const typeOf = (o) => map.things[o.index].type;
  const fixed = staticSolids(scene.objects, typeOf);
  const polygons = buildFlats(map).subsectorInfo.filter(Boolean); // { sector, polygon } por subsector
  const start = map.things.find((t) => t.type === 1);
  const floorAt = (x, y) => map.sectors[findSector(map, x, y)]?.floorHeight ?? 0;
  const player = { x: start.x, y: start.y, z: floorAt(start.x, start.y), alive: true };
  const opts = { noTarget: false };
  const damage = new PlayerDamageSink();
  const log = [];
  let sys = null, ai = null, tics = 0;

  // Monta o sistema do zero com a semente do campo (Reiniciar).
  function build() {
    const rng = new Rng(Number($('seed').value) || 1);
    sys = new MonsterSystem(scene.objects, table.entries, typeOf, rng, {});
    ai = new MonsterAI({ world, rng, player: () => player, noTarget: () => opts.noTarget, staticSolids: fixed,
      onSound: () => {}, onPlayerDamaged: (a, s, k) => damage.onPlayerDamaged(a, s, k) }).attach(sys);
    damage.reset();
    log.length = 0;
    tics = 0;
  }
  build();

  const typeName = (thingIndex) => sys.byObject.get(thingIndex)?.entry.prefix ?? '?';
  const describe = (ev) => {
    const who = ev.thingIndex !== undefined ? `${typeName(ev.thingIndex)}#${ev.thingIndex}` : '';
    switch (ev.type) {
      case 'woke': return `${who} acordou`;
      case 'attack': return `${who} atacou (${ev.kind})`;
      case 'pain': return `${who} entrou em dor`;
      case 'died': return `${who} morreu`;
      case 'playerDamaged': return `dano ${ev.amount} (${ev.source}, ${ev.kind})`;
      default: return ev.type;
    }
  };
  function tick() {
    sys.tick();
    tics++;
    for (const ev of sys.takeEvents()) log.unshift(`[${tics}] ${describe(ev)}`);
    log.length = Math.min(log.length, 20);
  }

  // Desenho.
  const canvas = $('map');
  const ctx = canvas.getContext('2d');
  let view = null;
  function layout() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const xs = map.vertexes.map((v) => v.x), ys = map.vertexes.map((v) => v.y);
    const b = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const scale = Math.min((w - 2 * MARGIN) / (b.maxX - b.minX), (h - 2 * MARGIN) / (b.maxY - b.minY));
    const offX = (w - (b.maxX - b.minX) * scale) / 2, offY = (h - (b.maxY - b.minY) * scale) / 2;
    // O y do Doom cresce para o norte; o do canvas, para baixo.
    view = { scale, sx: (x) => offX + (x - b.minX) * scale, sy: (y) => offY + (b.maxY - y) * scale,
      mx: (px) => b.minX + (px - offX) / scale, my: (py) => b.maxY - (py - offY) / scale };
  }

  function draw() {
    const { sx, sy, scale } = view;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    // Setores alertados: preenchimento translúcido dos subsectors.
    ctx.fillStyle = 'rgba(255, 140, 0, 0.25)';
    for (const p of polygons) {
      if (!ai.alerted[p.sector]) continue;
      ctx.beginPath();
      p.polygon.forEach(([x, y], i) => (i ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y))));
      ctx.fill();
    }
    for (const oneSided of [false, true]) {
      ctx.strokeStyle = oneSided ? '#fff' : '#555';
      ctx.beginPath();
      for (const l of world.lines) {
        if (l.oneSided !== oneSided) continue;
        ctx.moveTo(sx(l.x1), sy(l.y1));
        ctx.lineTo(sx(l.x2), sy(l.y2));
      }
      ctx.stroke();
    }
    // Linhas de visão (monstros com IA vivos): verde se visível, vermelho se não.
    if ($('sight').checked) {
      for (const m of sys.monsters) {
        if (!m.aiDef || !m.shootable) continue;
        const v = checkSight(world, { x: m.x, y: m.y, z: m.floorZ + m.entry.height * 0.75 },
          { x: player.x, y: player.y, z: player.z, height: 56 });
        ctx.strokeStyle = v ? 'rgba(0, 255, 0, 0.6)' : 'rgba(255, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.moveTo(sx(m.x), sy(m.y));
        ctx.lineTo(sx(player.x), sy(player.y));
        ctx.stroke();
      }
    }
    // Monstros: círculo do raio (cor do estado), seta do ângulo e traço até o alvo.
    for (const m of sys.monsters) {
      if (m.removed) continue;
      const x = sx(m.x), y = sy(m.y), r = Math.max(3, m.entry.radius * scale);
      if (m.target === 'player' && m.shootable) {
        ctx.strokeStyle = 'rgba(255, 220, 50, 0.5)';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(sx(player.x), sy(player.y));
        ctx.stroke();
      }
      ctx.fillStyle = m.entry.isMonster ? STATE_COLOR[m.state] : '#2a6';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      if (m.aiDef) {
        const a = m.angle * Math.PI / 180; // no canvas o y é invertido
        ctx.strokeStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * (r + 6), y - Math.sin(a) * (r + 6));
        ctx.stroke();
      }
    }
    ctx.fillStyle = '#38f';
    ctx.beginPath();
    ctx.arc(sx(player.x), sy(player.y), Math.max(4, 16 * scale), 0, Math.PI * 2);
    ctx.fill();

    const ais = sys.monsters.filter((m) => m.aiDef);
    const awake = ais.filter((m) => m.shootable && ['chase', 'melee', 'missile'].includes(m.state)).length;
    const dead = sys.monsters.filter((m) => m.entry.isMonster && !m.shootable).length;
    const d = damage.byKind;
    $('counters').textContent = `tics ${tics}  (${(tics / TICS_PER_SECOND).toFixed(1)} s)\n` +
      `acordados ${awake}/${ais.length}  mortos ${dead}\n` +
      `setores alertados ${ai.alertedSectors().length}\n` +
      `dano ao jogador: hitscan ${d.hitscan}, melee ${d.melee}, explosão ${d.explosion}`;
    $('log').textContent = log.join('\n');
  }

  // Controles.
  let playing = false;
  $('play').onclick = () => { playing = !playing; $('play').textContent = playing ? 'Pause' : 'Play'; };
  $('step').onclick = () => { tick(); draw(); };
  $('noise').onclick = () => { ai.noise(findSector(map, player.x, player.y)); draw(); };
  $('reset').onclick = () => { build(); draw(); };
  $('noTarget').onchange = (e) => { opts.noTarget = e.target.checked; draw(); };
  $('sight').onchange = () => draw();
  let dragging = false;
  const place = (e) => {
    const r = canvas.getBoundingClientRect();
    player.x = view.mx(e.clientX - r.left);
    player.y = view.my(e.clientY - r.top);
    player.z = floorAt(player.x, player.y);
    draw();
  };
  canvas.addEventListener('mousedown', (e) => { dragging = true; place(e); });
  window.addEventListener('mousemove', (e) => { if (dragging) place(e); });
  window.addEventListener('mouseup', () => { dragging = false; });
  window.addEventListener('resize', () => { layout(); draw(); });

  // Relógio: 35 tics por segundo vezes a velocidade escolhida.
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
