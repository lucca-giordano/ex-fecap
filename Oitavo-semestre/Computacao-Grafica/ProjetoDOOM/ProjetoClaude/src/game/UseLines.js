// Uso (tecla E), cruzamento de linhas, interruptores, monstros abrindo portas e o tic dos thinkers
// (etapa 20). Puro. Como o P_UseLines / PTR_UseTraverse, P_CrossSpecialLine, P_UseSpecialLine e
// P_ChangeSwitchTexture do Doom.
//
// ctx: {
//   keys: PlayerStats.keys, dead: boolean,
//   sound(nome, setor | null)   (setor null = origem do jogador),
//   message(chave)              (needBlueKey, needYellowKey, needRedKey),
//   textureExists(nome), warn(texto),
//   fits(setor, vão), onFloorMoved(setor)
// }

import { rayLineIntersection } from './hitscan.js';
import { SPECIALS, isSwitchSpecial, hasKeyColor, switchTextureOf, switchCounterpart } from './specials.js';
import { doDoor, verticalDoor, startDoor, tickDoor } from './Doors.js';
import { doPlat, tickPlat } from './Platforms.js';

export const USERANGE = 64;     // alcance do uso (Doom: USERANGE = 64)
export const BUTTONTIME = 35;   // tics até um interruptor SR voltar (Doom: BUTTONTIME = 35)

const KEY_MESSAGE = { blue: 'needBlueKey', yellow: 'needYellowKey', red: 'needRedKey' };

// Lado da frente (direito) de um ponto em relação à linha, como o P_PointOnLineSide.
export function onFrontSide(line, x, y) {
  return (line.x2 - line.x1) * (y - line.y1) - (line.y2 - line.y1) * (x - line.x1) < 0;
}

function frontSectorOf(level, li) {
  return level.map.sidedefs[level.map.linedefs[li].rightSidedef].sector;
}

// Interruptor: troca SW1 <-> SW2 na sidedef da frente; SR volta depois de BUTTONTIME tics.
function changeSwitch(level, li, repeat, exit, ctx) {
  const sd = level.map.linedefs[li].rightSidedef;
  const sw = switchTextureOf(level.map.sidedefs[sd]);
  const s = frontSectorOf(level, li);
  ctx.sound?.(exit ? 'swtchx' : 'swtchn', s);
  if (!sw) return;
  const other = switchCounterpart(sw.name);
  if (!ctx.textureExists?.(other)) {
    ctx.warn?.(`Interruptor ${sw.name}: contraparte ${other} não existe; a textura não muda`);
  } else {
    level.setSideTexture(sd, sw.where, other);
  }
  if (repeat) level.buttons.push({ line: li, sidedef: sd, where: sw.where, original: sw.name, timer: BUTTONTIME, sector: s });
}

// Ativa o especial da linha li. by: 'player' | 'monster'. Devolve { ok, reason }.
export function activateLine(level, li, ctx, by = 'player') {
  const special = level.lineSpecial[li];
  const sp = SPECIALS[special];
  if (!sp) {
    if (special) level.unsupportedUses++;
    return { ok: false, reason: 'unsupported' };
  }
  if (by === 'monster' && !sp.monsters) return { ok: false, reason: 'monster' };
  if (level.buttons.some((b) => b.line === li)) return { ok: false, reason: 'busy' }; // SR ainda apertado
  if (sp.key && by === 'player' && !hasKeyColor(ctx.keys ?? {}, sp.key)) {
    ctx.sound?.('oof', null);
    ctx.message?.(KEY_MESSAGE[sp.key]);
    return { ok: false, reason: 'key' };
  }
  const tag = level.map.linedefs[li].tag;
  let ok = false;
  if (sp.action === 'door' && sp.manual) ok = verticalDoor(level, li, sp.door, ctx, by === 'player');
  else if (sp.action === 'door') ok = tag !== 0 && doDoor(level, tag, sp.door, ctx);
  else if (sp.action === 'plat') ok = tag !== 0 && doPlat(level, tag, ctx);
  else if (sp.action === 'exit') {
    if (ctx.dead) return { ok: false, reason: 'dead' };
    level.finish(sp.secret);
    ok = true;
  }
  if (!ok) return { ok: false, reason: 'busy' };
  if (isSwitchSpecial(sp)) changeSwitch(level, li, sp.repeat, sp.action === 'exit', ctx);
  if (!sp.repeat) level.lineSpecial[li] = 0; // S1, W1 e portas de uma vez
  return { ok: true, reason: sp.desc };
}

// Uso: raio de 64 unidades na direção do olhar (só a horizontal). player: { x, y, angle (graus) }.
// world.lines: dados de linhas da física (com index = número da linedef).
// Devolve { kind: 'none' | 'oof' | 'back' | 'activated' | 'failed' | 'notUse' | 'unsupported', line }.
export function useLines(level, world, player, ctx) {
  const a = player.angle * Math.PI / 180;
  const dx = Math.cos(a), dy = Math.sin(a);
  const hits = [];
  for (const line of world.lines) {
    const h = rayLineIntersection(player.x, player.y, dx, dy, line, USERANGE);
    if (h) hits.push({ ...h, line });
  }
  hits.sort((p, q) => p.t - q.t);
  for (const { line, fromFront } of hits) {
    const special = level.lineSpecial[line.index];
    if (special) {
      // Uma ativação por tecla: a primeira linha com especial encerra o raio.
      if (!fromFront) return done(level, 'back', line.index);
      const sp = SPECIALS[special];
      if (!sp) { level.unsupportedUses++; return done(level, 'unsupported', line.index); }
      if (sp.trigger !== 'use') return done(level, 'notUse', line.index);
      const r = activateLine(level, line.index, ctx, 'player');
      return done(level, r.ok ? 'activated' : 'failed', line.index, r.reason);
    }
    const f = world.sectors[line.front], b = line.oneSided ? null : world.sectors[line.back];
    const open = b ? Math.min(f.ceilingHeight, b.ceilingHeight) - Math.max(f.floorHeight, b.floorHeight) : 0;
    if (line.oneSided || open <= 0) {
      ctx.sound?.('oof', null); // parede lisa (o Doom 1.9 toca "noway")
      return done(level, 'oof', line.index);
    }
  }
  return done(level, 'none', -1);
}

function done(level, kind, line, reason = '') {
  level.lastUse = line >= 0 ? `${kind} (linha ${line}${reason ? `, ${reason}` : ''})` : kind;
  return { kind, line, reason };
}

// Cruzamento: o movimento de `from` a `to` (pontos { x, y }) cruza cada linha com especial de
// cruzamento suportado? Dispara na ordem do percurso, nos dois sentidos. Devolve as linhas ativadas.
export function crossLines(level, world, from, to, ctx) {
  const crossed = [];
  const mdx = to.x - from.x, mdy = to.y - from.y;
  if (mdx === 0 && mdy === 0) return crossed;
  for (const line of world.lines) {
    const sp = SPECIALS[level.lineSpecial[line.index]];
    if (!sp || sp.trigger !== 'cross') continue;
    if (Math.max(from.x, to.x) < line.minX || Math.min(from.x, to.x) > line.maxX ||
        Math.max(from.y, to.y) < line.minY || Math.min(from.y, to.y) > line.maxY) continue;
    if (onFrontSide(line, from.x, from.y) === onFrontSide(line, to.x, to.y)) continue;
    // Interseção dentro do segmento da linha (u em [0, 1]) e ao longo do movimento (t).
    const ex = line.x2 - line.x1, ey = line.y2 - line.y1;
    const denom = mdx * ey - mdy * ex;
    if (denom === 0) continue;
    const wx = line.x1 - from.x, wy = line.y1 - from.y;
    const t = (wx * ey - wy * ex) / denom;
    const u = (wx * mdy - wy * mdx) / denom;
    if (u < 0 || u > 1) continue;
    crossed.push({ t, li: line.index });
  }
  crossed.sort((p, q) => p.t - q.t);
  const activated = [];
  for (const { li } of crossed) {
    if (activateLine(level, li, ctx, 'player').ok) activated.push(li);
  }
  return activated;
}

// Monstro encostado numa linha com especial 1 voltada para ele: tenta abrir a porta (sem chave e sem
// poder fechar). Devolve true se a porta foi acionada ou já está abrindo (o passo conta como feito).
export function monsterUseDoor(level, li, monster, ctx) {
  if (level.lineSpecial[li] !== 1) return false;
  const line = level.map.linedefs[li];
  const a = level.map.vertexes[line.v1], b = level.map.vertexes[line.v2];
  if (!onFrontSide({ x1: a.x, y1: a.y, x2: b.x, y2: b.y }, monster.x, monster.y)) return false;
  if (activateLine(level, li, ctx, 'monster').ok) return true;
  const back = line.leftSidedef === 0xFFFF ? -1 : level.map.sidedefs[line.leftSidedef].sector;
  const d = level.thinkers.get(back);
  return Boolean(d && d.kind === 'door' && d.direction !== -1);
}

// OPEN ALL DOORS (depuração): toda porta manual ou por tag vira "abre e fica" (setores sem thinker).
export function openAllDoors(level, ctx) {
  const sectors = new Set();
  level.map.linedefs.forEach((line, li) => {
    const sp = SPECIALS[level.lineSpecial[li]];
    if (!sp || sp.action !== 'door') return;
    if (sp.manual && line.leftSidedef !== 0xFFFF) sectors.add(level.map.sidedefs[line.leftSidedef].sector);
    else if (!sp.manual && line.tag !== 0) for (const s of level.tagMap.get(line.tag) ?? []) sectors.add(s);
  });
  let n = 0;
  for (const s of sectors) {
    const d = level.thinkers.get(s);
    if (d?.kind === 'door') { d.type = 'open'; d.direction = 1; n++; continue; }
    if (d) continue;
    startDoor(level, s, 'open', ctx);
    n++;
  }
  return n;
}

// Posição anterior do jogador para o cruzamento: só no modo andar e só entre estados contínuos.
// invalidate() nas trocas discretas (troca de modo, NEW GAME, reinício).
export class CrossTracker {
  constructor() {
    this.prev = null;
  }

  invalidate() {
    this.prev = null;
  }

  // Devolve [de, para] para crossLines, ou null (primeiro passo, voando ou depois de invalidate).
  step(pos, walking) {
    if (!walking) { this.prev = null; return null; }
    const from = this.prev;
    this.prev = { x: pos.x, y: pos.y };
    return from ? [from, this.prev] : null;
  }
}

// Um tic da fase: portas, elevadores (na ordem de criação) e interruptores SR voltando.
export function tickLevel(level, ctx) {
  for (const t of [...level.thinkers.values()]) {
    if (t.kind === 'door') tickDoor(level, t, ctx);
    else tickPlat(level, t, ctx);
  }
  for (const b of level.buttons) {
    if (--b.timer > 0) continue;
    level.setSideTexture(b.sidedef, b.where, b.original);
    ctx.sound?.('swtchn', b.sector);
  }
  level.buttons = level.buttons.filter((b) => b.timer > 0);
}
