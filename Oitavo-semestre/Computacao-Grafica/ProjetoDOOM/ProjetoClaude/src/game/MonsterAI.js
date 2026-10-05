// IA dos monstros no estilo do Doom (A_Look, A_Chase, P_NewChaseDir, P_TryMove, ataques). Puro.
// Coordenadas do Doom; ângulos em graus (0 = leste, anti-horário). Avança junto com o MonsterSystem,
// que chama action() ao ENTRAR em cada quadro que tem ação.

import { findSector } from '../map/bsp.js';
import { shoot, MISSILE_RANGE } from './hitscan.js';
import { checkSight } from './sight.js';
import { buildSoundGraph, noiseAlert } from './sound.js';
import {
  MELEERANGE, MAX_STEP, NODIR, OPPOSITE, DIAGS, XSPEED, YSPEED, PLAYER_HEIGHT, PLAYER_RADIUS,
  MONSTER_SPREAD_DEG, aproxDist, dirAngle,
} from './aiTable.js';

export const ML_BLOCKING = 0x0001;
export const ML_BLOCKMONSTERS = 0x0002;
export const MONSTER_EYE = 32;      // altura do tiro do monstro acima dos pés (Doom: altura/2 + 8 = 36)
export const PLAYER_AIM = 28;       // mira vertical: centro do jogador (pés + 28)

const norm360 = (a) => ((a % 360) + 360) % 360;
// Setor de um ponto: BSP do mapa, ou world.sectorAt(x, y) (mapas sintéticos das verificações).
export const sectorAt = (world, x, y) => (world.sectorAt ? world.sectorAt(x, y) : findSector(world.map, x, y));
const norm180 = (a) => norm360(a + 180) - 180; // [-180, 180)
export const angleTo = (fromX, fromY, toX, toY) => norm360(Math.atan2(toY - fromY, toX - fromX) * 180 / Math.PI);

// --- Colisão em caixa (P_CheckPosition) ---

// A linha cruza a caixa (P_BoxOnLineSide == -1): cantos dos dois lados da reta infinita.
function lineCrossesBox(l, x0, y0, x1, y1) {
  if (x1 <= l.minX || x0 >= l.maxX || y1 <= l.minY || y0 >= l.maxY) return false;
  const dx = l.x2 - l.x1, dy = l.y2 - l.y1;
  let front = 0, back = 0;
  for (const [px, py] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) {
    if (dx * (py - l.y1) - dy * (px - l.x1) < 0) front++; else back++;
  }
  return front > 0 && back > 0;
}

// Posição (x, y) para uma caixa de meia-largura `radius`. solids: [{ x, y, radius, ref }] (o próprio,
// ref === self, é ignorado). Devolve { ok, floor, ceiling, dropoff, spechit }; spechit (etapa 20):
// linedefs de dois lados cruzadas pela caixa com especial diferente de 0 (world.lineSpecial), como o
// spechit do Doom (usado pelos monstros para abrir portas).
export function checkPosition(world, x, y, radius, solids = [], self = null) {
  const sec = world.sectors[sectorAt(world, x, y)];
  const spechit = [];
  if (!sec) return { ok: false, floor: 0, ceiling: 0, dropoff: 0, spechit };
  let floor = sec.floorHeight, ceiling = sec.ceilingHeight, dropoff = sec.floorHeight;
  const x0 = x - radius, x1 = x + radius, y0 = y - radius, y1 = y + radius;
  for (const l of world.lines) {
    if (!lineCrossesBox(l, x0, y0, x1, y1)) continue;
    if (l.oneSided || (l.flags & (ML_BLOCKING | ML_BLOCKMONSTERS))) return { ok: false, floor, ceiling, dropoff, spechit };
    const f = world.sectors[l.front], b = world.sectors[l.back];
    ceiling = Math.min(ceiling, Math.min(f.ceilingHeight, b.ceilingHeight));
    floor = Math.max(floor, Math.max(f.floorHeight, b.floorHeight));
    dropoff = Math.min(dropoff, Math.min(f.floorHeight, b.floorHeight));
    if (world.lineSpecial?.[l.index]) spechit.push(l.index);
  }
  for (const s of solids) {
    if (s.ref === self && self !== null) continue;
    const r = s.radius + radius;
    if (Math.abs(s.x - x) < r && Math.abs(s.y - y) < r) return { ok: false, floor, ceiling, dropoff, spechit };
  }
  return { ok: true, floor, ceiling, dropoff, spechit };
}

// P_TryMove para um monstro { x, y, floorZ } com raio e altura. Move e devolve true se puder.
// out (opcional) recebe spechit (linhas com especial que a caixa cruzou), para abrir portas.
export function tryMove(world, m, nx, ny, radius, height, solids = [], out = null) {
  const p = checkPosition(world, nx, ny, radius, solids, m);
  if (out) out.spechit = p.spechit;
  if (!p.ok) return false;
  if (p.ceiling - p.floor < height) return false;          // não cabe
  if (p.ceiling - m.floorZ < height) return false;         // bate a cabeça
  if (p.floor - m.floorZ > MAX_STEP) return false;         // degrau alto demais
  if (p.floor - p.dropoff > MAX_STEP) return false;        // não desce de beiradas altas
  m.x = nx;
  m.y = ny;
  m.floorZ = p.floor;
  return true;
}

// --- P_NewChaseDir ---

// m: { movedir }; dx, dy: até o alvo; tryWalk(m) tenta andar em m.movedir; rng: { next255() }.
export function newChaseDir(m, dx, dy, tryWalk, rng) {
  const olddir = m.movedir;
  const turnaround = OPPOSITE[olddir];
  let d1 = dx > 10 ? 0 : dx < -10 ? 4 : NODIR;
  let d2 = dy < -10 ? 6 : dy > 10 ? 2 : NODIR;
  // (a) Diagonal direta.
  if (d1 !== NODIR && d2 !== NODIR) {
    m.movedir = DIAGS[(dy < 0 ? 2 : 0) + (dx > 0 ? 1 : 0)];
    if (m.movedir !== turnaround && tryWalk(m)) return;
  }
  // (b) Às vezes (ou se o eixo y domina), tenta o outro eixo primeiro.
  if (rng.next255() > 200 || Math.abs(dy) > Math.abs(dx)) [d1, d2] = [d2, d1];
  if (d1 === turnaround) d1 = NODIR;
  if (d2 === turnaround) d2 = NODIR;
  // (c), (d) Direções cardinais.
  if (d1 !== NODIR) { m.movedir = d1; if (tryWalk(m)) return; }
  if (d2 !== NODIR) { m.movedir = d2; if (tryWalk(m)) return; }
  // (e) Direção antiga.
  if (olddir !== NODIR) { m.movedir = olddir; if (tryWalk(m)) return; }
  // (f) Qualquer outra, em ordem aleatória (crescente ou decrescente).
  const order = rng.next255() & 1 ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  for (const tdir of order) {
    if (tdir === turnaround) continue;
    m.movedir = tdir;
    if (tryWalk(m)) return;
  }
  // (g) Meia-volta.
  if (turnaround !== NODIR) { m.movedir = turnaround; if (tryWalk(m)) return; }
  m.movedir = NODIR; // (h) preso
}

// Desvio e dano dos tiros de monstro (para verificação): mesmo uso do rng que posAttack.
export function monsterShots(pellets, baseYaw, rng) {
  const out = [];
  for (let i = 0; i < pellets; i++) {
    const yaw = baseYaw + (rng.next255() - rng.next255()) * MONSTER_SPREAD_DEG;
    out.push({ yaw, damage: ((rng.next255() % 5) + 1) * 3 });
  }
  return out;
}

// --- IA ---

export class MonsterAI {
  // ctx: { world: { map, lines, sectors }, rng, player() -> { x, y, z (pés), alive },
  //   noTarget() -> boolean, staticSolids: [{ x, y, radius }], useDoor(monstro, linedef) (etapa 20),
  //   spawnMissile(monstro, tipo) (etapa 21),
  //   onSound(nome, monstro), onPlayerDamaged(valor, origem, tipo, atacante { x, y }) }.
  constructor(ctx) {
    this.ctx = ctx;
    this.world = ctx.world;
    this.rng = ctx.rng;
    this.graph = buildSoundGraph(ctx.world);
    this.alerted = new Array(ctx.world.sectors.length).fill(false);
    this.system = null;
  }

  // Liga ao MonsterSystem (que chama action() nos quadros).
  attach(system) {
    this.system = system;
    system.ai = this;
    for (const m of system.monsters) m.sector = sectorAt(this.world, m.x, m.y);
    return this;
  }

  // Etapa 23: monstro reposto (Nightmare): recalcula o setor.
  placed(m) {
    m.sector = sectorAt(this.world, m.x, m.y);
  }

  reset() {
    this.alerted.fill(false);
    if (this.system) for (const m of this.system.monsters) m.sector = sectorAt(this.world, m.x, m.y);
  }

  // Disparo do jogador no setor `sector`: alerta os setores alcançados pelo som.
  noise(sector) {
    noiseAlert(this.graph, sector, this.alerted);
  }

  alertedSectors() {
    return this.alerted.flatMap((a, i) => (a ? [i] : []));
  }

  event(ev) {
    this.system?.events.push(ev);
  }

  // --- Sentidos ---

  targetAvailable() {
    return this.ctx.player().alive && !this.ctx.noTarget();
  }

  canSee(m) {
    const p = this.ctx.player();
    return checkSight(this.world, { x: m.x, y: m.y, z: m.floorZ + m.entry.height * 0.75 },
      { x: p.x, y: p.y, z: p.z, height: PLAYER_HEIGHT });
  }

  // P_LookForPlayers: vivo, visível e (à frente, dentro de 180 graus, ou a até MELEERANGE).
  lookForPlayer(m, allAround) {
    if (!this.targetAvailable() || !this.canSee(m)) return false;
    const p = this.ctx.player();
    if (!allAround) {
      const an = norm360(angleTo(m.x, m.y, p.x, p.y) - m.angle);
      if (an > 90 && an < 270 && aproxDist(p.x - m.x, p.y - m.y) > MELEERANGE) return false; // de costas
    }
    m.target = 'player';
    return true;
  }

  checkMeleeRange(m) {
    const p = this.ctx.player();
    if (aproxDist(p.x - m.x, p.y - m.y) >= MELEERANGE - 20 + PLAYER_RADIUS) return false;
    return this.canSee(m);
  }

  checkMissileRange(m) {
    if (!this.canSee(m)) return false;
    if (m.justHit) {
      m.justHit = false;
      return true;
    }
    if (m.reactionTime > 0) return false;
    const p = this.ctx.player();
    let dist = aproxDist(p.x - m.x, p.y - m.y) - 64;
    if (!m.aiDef.melee) dist -= 128;
    dist = Math.min(dist, 200);
    return this.rng.next255() >= dist;
  }

  // --- Movimento ---

  solidsFor() {
    const p = this.ctx.player();
    const out = this.ctx.staticSolids.slice();
    if (p.alive) out.push({ x: p.x, y: p.y, radius: PLAYER_RADIUS });
    for (const o of this.system.monsters) {
      if (o.shootable && !o.removed) out.push({ x: o.x, y: o.y, radius: o.entry.radius, ref: o });
    }
    return out;
  }

  // P_Move: um passo em movedir (sem mudar o ângulo).
  move(m) {
    if (m.movedir === NODIR) return false;
    const speed = m.aiDef.speed;
    const out = {};
    const ok = tryMove(this.world, m, m.x + speed * XSPEED[m.movedir], m.y + speed * YSPEED[m.movedir],
      m.entry.radius, m.entry.height, this.solidsFor(), out);
    if (ok) {
      m.sector = sectorAt(this.world, m.x, m.y);
      return true;
    }
    // Etapa 20: encostou numa porta comum (especial 1)? Tenta abrir; acionada ou já abrindo, o passo
    // conta como feito sem andar, e o monstro tenta de novo (P_Move com spechit do Doom).
    let good = false;
    for (const li of out.spechit ?? []) if (this.ctx.useDoor?.(m, li)) good = true;
    return good;
  }

  // P_TryWalk: anda e sorteia movecount.
  tryWalk(m) {
    if (!this.move(m)) return false;
    m.movecount = this.rng.next255() % 16;
    return true;
  }

  newChaseDir(m) {
    const p = this.ctx.player();
    newChaseDir(m, p.x - m.x, p.y - m.y, (mm) => this.tryWalk(mm), this.rng);
  }

  // --- Ações dos quadros ---

  action(m, name) {
    switch (name) {
      case 'look': return this.look(m);
      case 'chase': return this.chase(m);
      case 'faceTarget': return this.faceTarget(m);
      case 'posAttack': return this.posAttack(m, 1, 'POSS', 'pistol');
      case 'sPosAttack': return this.posAttack(m, 3, 'SPOS', 'shotgn');
      case 'troopAttack': return this.meleeAttack(m, 'TROO', () => ((this.rng.next255() % 8) + 1) * 3, 'claw', 'troopShot');
      case 'bruisAttack': return this.meleeAttack(m, 'BOSS', () => ((this.rng.next255() % 8) + 1) * 10, 'claw', 'bruiserShot');
      case 'sargAttack': return this.meleeAttack(m, 'SARG', () => ((this.rng.next255() % 10) + 1) * 4, null);
      default: return undefined;
    }
  }

  wake(m, withSound) {
    m.target = 'player';
    if (withSound) {
      const list = m.aiDef.sounds.see;
      const name = list.length === 1 ? list[0] : list[this.rng.next255() % list.length];
      this.ctx.onSound?.(name, m);
    }
    this.event({ type: 'woke', thingIndex: m.thingIndex, x: m.x, y: m.y });
    this.system.setState(m, 'chase');
  }

  // A_Look: som (setor alertado) ou visão.
  look(m) {
    if (this.targetAvailable() && this.alerted[m.sector]) {
      if (!m.ambush || this.canSee(m)) { this.wake(m, true); return; }
    }
    if (this.lookForPlayer(m, false)) this.wake(m, true);
  }

  // A_Chase, na ordem do Doom.
  chase(m) {
    if (m.reactionTime > 0) m.reactionTime--;
    // Gira 45 graus por vez em direção a movedir.
    m.angle = Math.floor(norm360(m.angle) / 45) * 45;
    if (m.movedir < NODIR) {
      const diff = norm180(m.angle - dirAngle(m.movedir));
      if (diff > 0) m.angle = norm360(m.angle - 45);
      else if (diff < 0) m.angle = norm360(m.angle + 45);
    }
    if (!this.targetAvailable()) {
      if (this.lookForPlayer(m, true)) return; // ainda tem alvo: continua perseguindo
      m.target = null;
      this.system.setState(m, 'stand');
      return;
    }
    const fast = Boolean(this.ctx.skillParams?.fast); // etapa 23: Nightmare
    if (m.justAttacked) {
      m.justAttacked = false;
      if (!fast) this.newChaseDir(m); // abaixo de Nightmare
      return;
    }
    if (m.aiDef.melee && this.checkMeleeRange(m)) {
      if (m.aiDef.sounds.attack) this.ctx.onSound?.(m.aiDef.sounds.attack, m);
      this.event({ type: 'attack', thingIndex: m.thingIndex, kind: 'melee' });
      this.system.setState(m, 'melee');
      return;
    }
    if (m.aiDef.missile && (fast || m.movecount === 0) && this.checkMissileRange(m)) {
      this.event({ type: 'attack', thingIndex: m.thingIndex, kind: 'missile' });
      this.system.setState(m, 'missile');
      m.justAttacked = true;
      return;
    }
    m.movecount--;
    if (m.movecount < 0 || !this.move(m)) this.newChaseDir(m);
    if (m.aiDef.sounds.active && this.rng.next255() < 3) this.ctx.onSound?.(m.aiDef.sounds.active, m);
  }

  faceTarget(m) {
    const p = this.ctx.player();
    m.angle = angleTo(m.x, m.y, p.x, p.y);
  }

  // Tiro de monstro: hitscan do olho (pés + 32) com mira no centro do jogador; só o jogador é alvo.
  monsterShot(m, yaw, damage, source) {
    const p = this.ctx.player();
    const origin = { x: m.x, y: m.y, z: m.floorZ + MONSTER_EYE };
    const dist = Math.max(1, Math.hypot(p.x - m.x, p.y - m.y));
    const pitch = Math.atan2(p.z + PLAYER_AIM - origin.z, dist) * 180 / Math.PI;
    const target = { shootable: true, x: p.x, y: p.y, floorZ: p.z, entry: { radius: PLAYER_RADIUS, height: PLAYER_HEIGHT } };
    const r = shoot(this.world, origin, yaw, pitch, MISSILE_RANGE, [target]);
    if (r.kind !== 'monster') return false;
    this.damagePlayer(m, damage, source, 'hitscan');
    return true;
  }

  // Etapa 19: o atacante ({ x, y } do monstro) vai junto, para o rosto e a câmera na morte.
  damagePlayer(m, amount, source, kind) {
    const attacker = { x: m.x, y: m.y };
    this.ctx.onPlayerDamaged?.(amount, source, kind, attacker);
    this.event({ type: 'playerDamaged', amount, source, kind, x: m.x, y: m.y, thingIndex: m.thingIndex });
  }

  // A_PosAttack (1 projétil) e A_SPosAttack (3): desvio (P_Random - P_Random) << 20 e dano (%5 + 1) * 3.
  posAttack(m, pellets, source, sound) {
    if (m.target !== 'player') return;
    this.faceTarget(m);
    this.ctx.onSound?.(sound, m);
    for (const shot of monsterShots(pellets, m.angle, this.rng)) this.monsterShot(m, shot.yaw, shot.damage, source);
  }

  // A_TroopAttack, A_BruisAttack e A_SargAttack: de perto, golpe; de longe (etapa 21), projétil
  // (missileType; o demônio não tem). O projétil é criado pelo MissileSystem via ctx.spawnMissile.
  meleeAttack(m, source, rollDamage, sound, missileType = null) {
    if (m.target !== 'player') return;
    this.faceTarget(m);
    if (!this.checkMeleeRange(m)) {
      if (!missileType) return;
      this.ctx.spawnMissile?.(m, missileType);
      this.event({ type: 'monsterMissileFired', thingIndex: m.thingIndex, missile: missileType, source });
      return;
    }
    if (sound) this.ctx.onSound?.(sound, m);
    this.damagePlayer(m, rollDamage(), source, 'melee');
  }
}
