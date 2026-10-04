// Portas (etapa 20), como o p_doors.c do Doom (T_VerticalDoor, EV_DoDoor, EV_VerticalDoor). Puro.
// Um thinker por setor (level.thinkers). Avança por tic de jogo (35/s).
//
// ctx: { sound(nome, setor), fits(setor, vão) -> true se todos os alvos vivos do setor cabem }.

export const VDOORSPEED = 2;    // unidades por tic (Doom: FRACUNIT * 2)
export const VDOORBLAZE = 8;    // portas rápidas (Doom: VDOORSPEED * 4)
export const VDOORWAIT = 150;   // tics aberta antes de fechar
export const TOPOFFSET = 4;     // o topo fica 4 abaixo do menor teto vizinho

// normal: abre, espera, fecha; open: abre e fica; close: fecha; blazeRaise e blazeOpen: rápidas.
const BLAZE = new Set(['blazeRaise', 'blazeOpen']);
const WAITS = new Set(['normal', 'blazeRaise']);
const soundsOf = (type) => (BLAZE.has(type) ? { open: 'bdopn', close: 'bdcls' } : { open: 'doropn', close: 'dorcls' });

// Altura de topo: menor teto vizinho - 4, nunca abaixo do chão do setor.
export function doorTop(level, s) {
  return Math.max(level.sectors[s].floorHeight, level.lowestNeighborCeiling(s) - TOPOFFSET);
}

// Cria a porta no setor s (sem conferir thinker existente) e toca o som.
export function startDoor(level, s, type, ctx) {
  const d = {
    kind: 'door', type, sector: s, speed: BLAZE.has(type) ? VDOORBLAZE : VDOORSPEED,
    topheight: doorTop(level, s), topwait: VDOORWAIT, topcountdown: 0,
    direction: type === 'close' ? -1 : 1,
  };
  level.thinkers.set(s, d);
  const snd = soundsOf(type);
  ctx.sound?.(d.direction === -1 ? snd.close : snd.open, s);
  return d;
}

// EV_DoDoor: todos os setores da tag sem thinker ativo. Devolve true se acionou algum.
export function doDoor(level, tag, type, ctx) {
  let any = false;
  for (const s of level.tagMap.get(tag) ?? []) {
    if (level.thinkers.has(s)) continue;
    startDoor(level, s, type, ctx);
    any = true;
  }
  return any;
}

// Especiais de porta manual que reabrem ou fecham uma porta já em movimento.
const REVERSIBLE = new Set([1, 26, 27, 28, 117]);

// EV_VerticalDoor: setor de trás da linha li. byPlayer: só o jogador fecha uma porta aberta.
// Devolve true se a porta foi criada ou mudou de direção.
export function verticalDoor(level, li, type, ctx, byPlayer = true) {
  const line = level.map.linedefs[li];
  if (line.leftSidedef === 0xFFFF) return false;
  const s = level.map.sidedefs[line.leftSidedef].sector;
  const d = level.thinkers.get(s);
  if (d) {
    if (d.kind !== 'door' || !REVERSIBLE.has(level.lineSpecial[li])) return false;
    if (d.direction === -1) {
      d.direction = 1; // descendo: volta a subir
      return true;
    }
    if (!byPlayer) return false; // monstros nunca fecham portas
    d.direction = -1; // subindo ou esperando: começa a descer na hora
    return true;
  }
  startDoor(level, s, type, ctx);
  return true;
}

// Um tic de uma porta. Devolve false quando o thinker termina (já removido de level.thinkers).
export function tickDoor(level, d, ctx) {
  const s = d.sector;
  const sec = level.sectors[s];
  const snd = soundsOf(d.type);
  if (d.direction === 0) {
    if (--d.topcountdown <= 0) {
      d.direction = -1;
      ctx.sound?.(snd.close, s);
    }
    return true;
  }
  if (d.direction === 1) {
    const ceil = Math.min(d.topheight, sec.ceilingHeight + d.speed);
    level.setCeiling(s, ceil);
    if (ceil >= d.topheight) {
      if (WAITS.has(d.type)) {
        d.direction = 0;
        d.topcountdown = d.topwait;
      } else {
        level.thinkers.delete(s); // open e blazeOpen terminam abertas
        return false;
      }
    }
    return true;
  }
  // Descendo: o passo é desfeito se deixar algum alvo vivo sem espaço.
  const ceil = Math.max(sec.floorHeight, sec.ceilingHeight - d.speed);
  if (!ctx.fits(s, ceil - sec.floorHeight)) {
    if (WAITS.has(d.type)) {
      d.direction = 1; // normal e rápida: reabre
      ctx.sound?.(snd.open, s);
    }
    return true; // close: espera e tenta de novo no tic seguinte
  }
  level.setCeiling(s, ceil);
  if (ceil <= sec.floorHeight) {
    level.thinkers.delete(s); // normal, blazeRaise e close terminam fechadas
    return false;
  }
  return true;
}
