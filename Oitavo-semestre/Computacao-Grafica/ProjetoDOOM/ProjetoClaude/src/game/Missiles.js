// Projéteis (etapa 21): bola de fogo do diabrete, bola do barão e foguete do jogador. Puro.
// Como o P_SpawnMissile, P_SpawnPlayerMissile, P_CheckMissileSpawn, P_XYMovement, P_ZMovement e
// P_ExplodeMissile do Doom (valores do info.c, lembrados de memória; letras conferidas contra o WAD).
// Coordenadas do Doom; z é a BASE do projétil. Unidades por tic (35 tics por segundo).

import { aproxDist } from './aiTable.js';

export const MAX_MISSILES = 128;
export const MAX_MISSILE_TICS = 700;
export const SKY = 'F_SKY1';
export const MISSILE_Z = 32;           // altura de saída acima dos pés (Doom: z + 32)
export const SPLIT_SPEED = 15;         // acima disso o passo xy é dividido em duas metades (MAXMOVE / 2)
export const ROCKET_BLAST = 128;       // dano máximo do A_Explode

// Quadros [letra, tics]; tics -1 = permanece. explodeAt: índice do quadro de morte que executa o dano em
// raio ao ENTRAR (só o foguete).
export const MISSILE_TYPES = {
  troopShot: { speed: 10, radius: 6, height: 8, mult: 3, prefix: 'BAL1',
    fly: [['A', 4], ['B', 4]], death: [['C', 6], ['D', 6], ['E', 6]], spawnSound: 'firsht', deathSound: 'firxpl', explodeAt: -1 },
  bruiserShot: { speed: 15, radius: 6, height: 8, mult: 8, prefix: 'BAL7',
    fly: [['A', 4], ['B', 4]], death: [['C', 6], ['D', 6], ['E', 6]], spawnSound: 'firsht', deathSound: 'firxpl', explodeAt: -1 },
  rocket: { speed: 20, radius: 11, height: 8, mult: 20, prefix: 'MISL',
    fly: [['A', -1]], death: [['B', 8], ['C', 6], ['D', 4]], spawnSound: 'rlaunc', deathSound: 'barexp', explodeAt: 0 },
};

// Quadros para a textura de sprites: [{ prefix, letter }] de voo e de explosão de todos os tipos.
export function missileSpriteFrames() {
  const out = [];
  for (const t of Object.values(MISSILE_TYPES)) {
    for (const [letter] of [...t.fly, ...t.death]) out.push({ prefix: t.prefix, letter });
  }
  return out;
}

// Alvos candidatos de um projétil. player: { x, y, z (pés) } ou null (morto); monsters: lista do
// MonsterSystem; solids: decoração [{ x, y, radius, z, height }].
// Projétil de monstro: jogador e barris vivos (monstros, corpos e o dono não colidem: sem infighting).
// Projétil do jogador: monstros e barris vivos (o jogador nunca). Os dois: decoração sólida.
export function missileTargets(p, { player = null, monsters = [], solids = [] }) {
  const out = [];
  const byPlayer = p.owner === 'player';
  if (!byPlayer && player) out.push({ kind: 'player', x: player.x, y: player.y, z: player.z, radius: 16, height: 56 });
  for (const m of monsters) {
    if (!m.shootable || m.removed) continue;
    if (!byPlayer && m.entry.isMonster) continue;
    out.push({ kind: m.entry.isMonster ? 'monster' : 'barrel', x: m.x, y: m.y, z: m.floorZ, radius: m.entry.radius, height: m.entry.height, ref: m });
  }
  for (const s of solids) out.push({ kind: 'solid', ...s });
  return out;
}

// Dano direto: ((P_Random() % 8) + 1) * multiplicador.
export const directDamage = (type, rng) => ((rng.next255() % 8) + 1) * MISSILE_TYPES[type].mult;

// Interseção de segmentos (p1-p2 com q1-q2), inclusive nas pontas.
function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const o = (px, py, qx, qy, rx, ry) => Math.sign((qx - px) * (ry - py) - (qy - py) * (rx - px));
  const o1 = o(ax, ay, bx, by, cx, cy), o2 = o(ax, ay, bx, by, dx, dy);
  const o3 = o(cx, cy, dx, dy, ax, ay), o4 = o(cx, cy, dx, dy, bx, by);
  if (o1 !== o2 && o3 !== o4) return true;
  const on = (px, py, qx, qy, rx, ry) => Math.min(px, qx) <= rx && rx <= Math.max(px, qx) && Math.min(py, qy) <= ry && ry <= Math.max(py, qy);
  return (o1 === 0 && on(ax, ay, bx, by, cx, cy)) || (o2 === 0 && on(ax, ay, bx, by, dx, dy)) ||
    (o3 === 0 && on(cx, cy, dx, dy, ax, ay)) || (o4 === 0 && on(cx, cy, dx, dy, bx, by));
}

// O segmento da linha toca o quadrado [x0, x1] x [y0, y1]?
function segmentTouchesBox(l, x0, y0, x1, y1) {
  if (l.maxX < x0 || l.minX > x1 || l.maxY < y0 || l.minY > y1) return false;
  const inside = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  if (inside(l.x1, l.y1) || inside(l.x2, l.y2)) return true;
  return segmentsIntersect(l.x1, l.y1, l.x2, l.y2, x0, y0, x1, y0) || segmentsIntersect(l.x1, l.y1, l.x2, l.y2, x1, y0, x1, y1) ||
    segmentsIntersect(l.x1, l.y1, l.x2, l.y2, x1, y1, x0, y1) || segmentsIntersect(l.x1, l.y1, l.x2, l.y2, x0, y1, x0, y0);
}

// Teste de um (sub)passo de (proj.x, proj.y) até (nx, ny). world: { lines, sectors } (alturas correntes);
// targets: [{ kind: 'player' | 'monster' | 'barrel' | 'solid', x, y, z (pés), radius, height, ref }].
// Devolve { blocked, kind: 'thing' | 'line' | 'sky' | null, hit (alvo), line }.
export function checkMissileMove(world, proj, nx, ny, targets) {
  const t = MISSILE_TYPES[proj.type];
  const r = t.radius, z0 = proj.z, z1 = proj.z + t.height;
  // 1. Coisas (caixa), a mais próxima ao longo do caminho.
  let best = null, bestD = Infinity;
  for (const tg of targets) {
    const reach = tg.radius + r;
    if (Math.abs(nx - tg.x) >= reach || Math.abs(ny - tg.y) >= reach) continue;
    if (z0 > tg.z + tg.height || z1 < tg.z) continue; // por cima ou por baixo
    const d = Math.hypot(tg.x - proj.x, tg.y - proj.y);
    if (d < bestD) { bestD = d; best = tg; }
  }
  if (best) return { blocked: true, kind: 'thing', hit: best, line: null };
  // 2. Linhas: tocam o quadrado do destino ou cruzam o segmento do movimento.
  const x0 = nx - r, x1 = nx + r, y0 = ny - r, y1 = ny + r;
  for (const l of world.lines) {
    if (!segmentTouchesBox(l, x0, y0, x1, y1) &&
        !segmentsIntersect(proj.x, proj.y, nx, ny, l.x1, l.y1, l.x2, l.y2)) continue;
    if (l.oneSided) return { blocked: true, kind: 'line', hit: null, line: l };
    const f = world.sectors[l.front], b = world.sectors[l.back];
    const openBottom = Math.max(f.floorHeight, b.floorHeight), openTop = Math.min(f.ceilingHeight, b.ceilingHeight);
    if (z0 >= openBottom && z1 <= openTop) continue; // cabe na abertura (0x0001 e 0x0002 não bloqueiam projéteis)
    // Bloqueado pela parte de cima com céu do outro lado: some sem explodir (hack do céu do Doom).
    const fromFront = (l.x2 - l.x1) * (proj.y - l.y1) - (l.y2 - l.y1) * (proj.x - l.x1) < 0;
    const other = fromFront ? b : f;
    if (z1 > openTop && other.ceilingTexture === SKY) return { blocked: true, kind: 'sky', hit: null, line: l };
    return { blocked: true, kind: 'line', hit: null, line: l };
  }
  return { blocked: false, kind: null, hit: null, line: null };
}

export class MissileSystem {
  // world: { map, lines, sectors, sectorAt? }; rng: { next255() }; ctx: {
  //   targets(proj) -> alvos candidatos (ver checkMissileMove; o main monta conforme o dono),
  //   sectorAt(x, y) -> índice do setor,
  //   hit(proj, alvo, dano)  (dano direto; o projétil explode em seguida),
  //   blast(proj)            (dano em raio do foguete, ao entrar no quadro B),
  //   sound(nome, proj), event(ev) (opcional, para a depuração) }.
  constructor(world, rng, ctx) {
    this.world = world;
    this.rng = rng;
    this.ctx = ctx;
    this.nextId = 1;
    this.reset();
  }

  reset() {
    this.list = [];
    this.stats = { fired: { TROO: 0, BOSS: 0, player: 0 }, hitPlayer: 0, splits: 0 };
  }

  // P_SpawnMissile: do monstro m (x, y, floorZ) até o alvo (pés: target.z).
  spawnFromMonster(m, target, type) {
    const t = MISSILE_TYPES[type];
    const angle = Math.atan2(target.y - m.y, target.x - m.x) * 180 / Math.PI;
    const dist = Math.max(1, aproxDist(target.x - m.x, target.y - m.y) / t.speed);
    const vz = (target.z - m.floorZ) / dist;
    this.stats.fired[type === 'bruiserShot' ? 'BOSS' : 'TROO']++;
    return this.spawn(type, m.x, m.y, m.floorZ + MISSILE_Z, angle, vz, m.thingIndex, m.type);
  }

  // P_SpawnPlayerMissile: ângulo e pitch da câmera (sem mira automática).
  spawnFromPlayer(player, angleDeg, pitchDeg, type = 'rocket') {
    const t = MISSILE_TYPES[type];
    this.stats.fired.player++;
    return this.spawn(type, player.x, player.y, player.z + MISSILE_Z, angleDeg, t.speed * Math.tan(pitchDeg * Math.PI / 180), 'player', 'player');
  }

  spawn(type, x, y, z, angleDeg, vz, owner, ownerType) {
    const t = MISSILE_TYPES[type];
    const a = angleDeg * Math.PI / 180;
    const p = { id: this.nextId++, type, x, y, z, vx: t.speed * Math.cos(a), vy: t.speed * Math.sin(a), vz,
      angle: ((angleDeg % 360) + 360) % 360, owner, ownerType, state: 'fly', frameIndex: 0, ticsLeft: 0, ticsAlive: 0, removed: false };
    this.list.push(p);
    if (this.list.length > MAX_MISSILES) this.list.shift(); // descarta o mais antigo
    this.ctx.sound?.(t.spawnSound, p);
    // P_CheckMissileSpawn: primeiro quadro mais curto, meio passo e teste de colisão.
    const cut = this.rng.next255() & 3;
    const first = t.fly[0][1];
    p.ticsLeft = first < 0 ? Infinity : Math.max(1, first - cut);
    this.tryStep(p, p.x + p.vx / 2, p.y + p.vy / 2);
    if (p.state === 'fly') p.z += p.vz / 2;
    this.ctx.event?.({ type: 'fired', missile: p.type, id: p.id, owner });
    return p;
  }

  // Um (sub)passo xy; bloqueado, aplica o dano (se houver alvo) e explode ou some. Devolve true se andou.
  tryStep(p, nx, ny) {
    const r = checkMissileMove(this.world, p, nx, ny, this.ctx.targets(p));
    if (!r.blocked) {
      p.x = nx;
      p.y = ny;
      return true;
    }
    if (r.kind === 'sky') {
      p.removed = true;
      this.ctx.event?.({ type: 'sky', id: p.id });
      return false;
    }
    if (r.kind === 'thing' && r.hit.kind !== 'solid') {
      const dmg = directDamage(p.type, this.rng);
      if (r.hit.kind === 'player') this.stats.hitPlayer++;
      this.ctx.hit?.(p, r.hit, dmg);
    } else {
      this.ctx.event?.({ type: r.kind === 'thing' ? 'solid' : 'wall', id: p.id, x: p.x, y: p.y });
    }
    this.explode(p);
    return false;
  }

  // P_ExplodeMissile: para, primeiro quadro de morte mais curto, som; o foguete faz o dano em raio.
  explode(p) {
    const t = MISSILE_TYPES[p.type];
    p.vx = 0; p.vy = 0; p.vz = 0;
    p.state = 'dying';
    p.frameIndex = 0;
    p.ticsLeft = Math.max(1, t.death[0][1] - (this.rng.next255() & 3));
    this.ctx.sound?.(t.deathSound, p);
    if (t.explodeAt === 0) this.ctx.blast?.(p);
  }

  // Um tic de todos os projéteis: xy, z e animação.
  update() {
    for (const p of this.list) {
      if (p.removed) continue;
      const t = MISSILE_TYPES[p.type];
      if (p.state === 'fly') {
        if (++p.ticsAlive > MAX_MISSILE_TICS) { p.removed = true; continue; }
        // xy: um passo, ou duas metades se a velocidade passar de 15 por eixo.
        const split = Math.abs(p.vx) > SPLIT_SPEED || Math.abs(p.vy) > SPLIT_SPEED;
        if (split) this.stats.splits++;
        const parts = split ? 2 : 1;
        for (let i = 0; i < parts && p.state === 'fly' && !p.removed; i++) this.tryStep(p, p.x + p.vx / parts, p.y + p.vy / parts);
        if (p.state !== 'fly' || p.removed) continue;
        // z: chão ou teto do setor do centro (sem o hack do céu, como no Doom).
        p.z += p.vz;
        const sec = this.world.sectors[this.ctx.sectorAt(p.x, p.y)];
        if (sec && (p.z <= sec.floorHeight || p.z + t.height > sec.ceilingHeight)) {
          this.ctx.event?.({ type: 'plane', id: p.id, x: p.x, y: p.y });
          this.explode(p);
          continue;
        }
        if (--p.ticsLeft <= 0) {
          p.frameIndex = (p.frameIndex + 1) % t.fly.length;
          const tics = t.fly[p.frameIndex][1];
          p.ticsLeft = tics < 0 ? Infinity : tics;
        }
        continue;
      }
      // Explodindo: avança os quadros de morte; no fim, some.
      if (--p.ticsLeft <= 0) {
        p.frameIndex++;
        if (p.frameIndex >= t.death.length) { p.removed = true; continue; }
        p.ticsLeft = t.death[p.frameIndex][1];
        if (p.frameIndex === t.explodeAt) this.ctx.blast?.(p);
      }
    }
    this.list = this.list.filter((p) => !p.removed);
  }

  // Quadro atual { prefix, letter } (sempre em brilho máximo).
  frameOf(p) {
    const t = MISSILE_TYPES[p.type];
    return { prefix: t.prefix, letter: (p.state === 'fly' ? t.fly : t.death)[p.frameIndex][0], fullbright: true };
  }
}
