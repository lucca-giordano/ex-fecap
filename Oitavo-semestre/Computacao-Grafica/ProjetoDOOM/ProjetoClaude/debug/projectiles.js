// Página de depuração da etapa 21: projéteis no mapa 2D do E1M1, com rastro, explosões (raio 128 do
// foguete), impactos e log. Canvas 2D, sem WebGPU, com as MESMAS funções puras do jogo (MissileSystem,
// missileTargets, radiusAttack, applyDamage, MonsterSystem).

import { WadFile } from '../src/wad/WadFile.js';
import { loadMap } from '../src/wad/MapData.js';
import { findSector } from '../src/map/bsp.js';
import { findSpriteLumps } from '../src/wad/Sprites.js';
import { buildCollisionLines } from '../src/physics/collisionData.js';
import { buildSpriteScene } from '../src/sprites/spriteLogic.js';
import { staticSolids } from '../src/physics/solids.js';
import { Rng } from '../src/game/Rng.js';
import { resolveMonsterTable } from '../src/game/monsterTable.js';
import { MonsterSystem } from '../src/game/MonsterSystem.js';
import { MissileSystem, ROCKET_BLAST, missileTargets } from '../src/game/Missiles.js';
import { radiusAttack } from '../src/game/radiusAttack.js';
import { checkSight } from '../src/game/sight.js';
import { PlayerStats } from '../src/game/PlayerStats.js';
import { applyDamage } from '../src/game/PlayerDamage.js';
import { TICS_PER_SECOND } from '../src/game/aiTable.js';

const WAD_URL = new URL('../assets/freedoom1.wad', import.meta.url);
const MAP_NAME = 'E1M1';
const MARGIN = 20;
const COLOR = { troopShot: '#f80', bruiserShot: '#4f4', rocket: '#ff4' };
const $ = (id) => document.getElementById(id);

function showError(text) {
  $('msg').textContent = text;
  console.error(text);
}

async function main() {
  const wad = await WadFile.fromUrl(WAD_URL);
  const map = loadMap(wad, MAP_NAME);
  const { lumps } = findSpriteLumps(wad);
  const table = resolveMonsterTable(lumps, new Set([...map.things.map((t) => t.type), 3003]));
  const scene = buildSpriteScene(wad, map);
  const world = { map, lines: buildCollisionLines(map), sectors: map.sectors, sectorAt: (x, y) => findSector(map, x, y) };
  const typeOf = (o) => map.things[o.index].type;
  const solids = staticSolids(scene.objects, typeOf).map((s) => ({ x: s.x, y: s.y, radius: s.radius, height: 64, z: map.sectors[findSector(map, s.x, s.y)].floorHeight }));
  const start = map.things.find((t) => t.type === 1);
  const floorAt = (x, y) => map.sectors[findSector(map, x, y)]?.floorHeight ?? 0;
  const player = { x: start.x, y: start.y, z: floorAt(start.x, start.y) };
  const log = [];
  const trails = new Map();
  const blasts = [];
  let sys, missiles, stats, tics = 0;

  const say = (text) => { log.unshift(`[${tics}] ${text}`); log.length = Math.min(log.length, 20); };
  function build() {
    const rng = new Rng(Number($('seed').value) || 1);
    sys = new MonsterSystem(scene.objects, table.entries, typeOf, rng, {});
    stats = new PlayerStats();
    trails.clear();
    blasts.length = 0;
    tics = 0;
    missiles = new MissileSystem(world, rng, {
      sectorAt: world.sectorAt,
      targets: (p) => missileTargets(p, { player: stats.isDead ? null : player, monsters: sys.monsters, solids }),
      hit: (p, t, amount) => {
        if (t.kind === 'player') {
          const r = applyDamage(stats, amount, null, p.type, rng);
          say(`${p.type} acertou o jogador: ${r.applied} (armadura ${r.savedByArmor})`);
        } else {
          sys.damage(t.ref, amount);
          say(`${p.type} acertou ${t.kind === 'barrel' ? 'barril' : 'monstro'}: ${amount}`);
        }
      },
      blast: (p) => {
        blasts.push({ x: p.x, y: p.y, life: 20 });
        const applied = radiusAttack(world, { x: p.x, y: p.y }, ROCKET_BLAST, null, sys.monsters, rng, {
          damage: (m, a) => sys.damage(m, a),
          onPlayerDamaged: (a) => applyDamage(stats, a, null, 'player', rng),
          player: { x: player.x, y: player.y, radius: 16 },
        });
        say(`explosão em raio: ${applied.map((a) => `${a.target === 'player' ? 'jogador' : a.target.entry.prefix} ${a.amount}`).join(', ') || 'ninguém'}`);
      },
      event: (ev) => {
        if (ev.type === 'fired') say(`disparo ${ev.missile} #${ev.id}`);
        if (ev.type === 'wall' || ev.type === 'plane') say(`#${ev.id} bateu em ${ev.type === 'wall' ? 'parede' : 'chão ou teto'}`);
        if (ev.type === 'solid') say(`#${ev.id} bateu em decoração`);
        if (ev.type === 'sky') say(`#${ev.id} sumiu no céu`);
      },
    });
  }
  build();

  // Monstro do tipo com visão do jogador (o mais próximo); sem visão, o mais próximo de todos.
  function shooter(type) {
    const list = sys.monsters.filter((m) => m.shootable && m.type === type);
    const eye = (m) => ({ x: m.x, y: m.y, z: m.floorZ + m.entry.height * 0.75 });
    const seen = list.filter((m) => checkSight(world, eye(m), { ...player, height: 56 }));
    const pool = seen.length ? seen : list;
    return pool.sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y))[0];
  }
  function monsterFire(type, missile) {
    const m = shooter(type);
    if (!m) { say(`nenhum monstro do tipo ${type} no mapa`); return; }
    missiles.spawnFromMonster(m, player, missile);
  }
  $('imp').onclick = () => { monsterFire(3001, 'troopShot'); draw(); };
  $('baron').onclick = () => {
    if (!sys.monsters.some((m) => m.type === 3003)) {
      // O E1M1 não tem barão: um disparo de teste a 400 unidades do jogador, na direção do ângulo.
      const a = Number($('angle').value) * Math.PI / 180;
      missiles.spawnFromMonster({ x: player.x - Math.cos(a) * 400, y: player.y - Math.sin(a) * 400, floorZ: player.z, thingIndex: -1, type: 3003 }, player, 'bruiserShot');
      say('o E1M1 não tem barão: disparo de teste a 400 unidades');
    } else monsterFire(3003, 'bruiserShot');
    draw();
  };
  $('rocket').onclick = () => { missiles.spawnFromPlayer(player, Number($('angle').value), Number($('pitch').value)); draw(); };
  $('angle').oninput = () => { $('angleV').textContent = $('angle').value; };
  $('pitch').oninput = () => { $('pitchV').textContent = $('pitch').value; };

  // Desenho.
  const canvas = $('map');
  const g = canvas.getContext('2d');
  let view = null;
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
    const { sx, sy, scale } = view;
    g.fillStyle = '#000';
    g.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    for (const l of world.lines) {
      g.strokeStyle = l.oneSided ? '#ccc' : '#444';
      g.beginPath();
      g.moveTo(sx(l.x1), sy(l.y1));
      g.lineTo(sx(l.x2), sy(l.y2));
      g.stroke();
    }
    for (const m of sys.monsters) {
      if (m.removed) continue;
      g.fillStyle = !m.entry.isMonster ? '#2a6' : m.shootable ? '#888' : '#533';
      g.beginPath();
      g.arc(sx(m.x), sy(m.y), Math.max(2, m.entry.radius * scale), 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = stats.isDead ? '#933' : '#38f';
    g.beginPath();
    g.arc(sx(player.x), sy(player.y), Math.max(3, 16 * scale), 0, Math.PI * 2);
    g.fill();
    // Rastros e projéteis.
    for (const p of missiles.list) {
      const trail = trails.get(p.id) ?? [];
      g.strokeStyle = COLOR[p.type];
      g.beginPath();
      trail.forEach(([x, y], i) => (i ? g.lineTo(sx(x), sy(y)) : g.moveTo(sx(x), sy(y))));
      g.stroke();
      g.fillStyle = p.state === 'fly' ? COLOR[p.type] : '#fff';
      g.beginPath();
      g.arc(sx(p.x), sy(p.y), p.state === 'fly' ? 3 : 5, 0, Math.PI * 2);
      g.fill();
    }
    // Explosões em raio.
    for (const b of blasts) {
      g.strokeStyle = `rgba(255, 200, 0, ${b.life / 20})`;
      g.beginPath();
      g.arc(sx(b.x), sy(b.y), ROCKET_BLAST * scale, 0, Math.PI * 2);
      g.stroke();
    }
    const fired = missiles.stats.fired;
    $('counters').textContent = `tics ${tics} (${(tics / TICS_PER_SECOND).toFixed(1)} s)\n` +
      `jogador: vida ${stats.health}, armadura ${stats.armor}${stats.isDead ? ' (MORTO)' : ''}\n` +
      `disparados: diabrete ${fired.TROO}, barão ${fired.BOSS}, jogador ${fired.player}; acertaram o jogador ${missiles.stats.hitPlayer}`;
    $('list').textContent = missiles.list.map((p) => `#${p.id} ${p.type} (${p.x.toFixed(0)}, ${p.y.toFixed(0)}) z ${p.z.toFixed(1)} ${p.state}`).join('\n') || 'nenhum';
    $('log').textContent = log.join('\n');
  }

  function tick() {
    missiles.update();
    sys.tick();
    tics++;
    for (const p of missiles.list) {
      if (!trails.has(p.id)) trails.set(p.id, []);
      const t = trails.get(p.id);
      t.push([p.x, p.y]);
      if (t.length > 12) t.shift();
    }
    for (const b of blasts) b.life--;
    while (blasts.length && blasts[0].life <= 0) blasts.shift();
  }

  let playing = false;
  $('play').onclick = () => { playing = !playing; $('play').textContent = playing ? 'Pause' : 'Play'; };
  $('step').onclick = () => { tick(); draw(); };
  $('reset').onclick = () => { build(); log.length = 0; draw(); };
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
