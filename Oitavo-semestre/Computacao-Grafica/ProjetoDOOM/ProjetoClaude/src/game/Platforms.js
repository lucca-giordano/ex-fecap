// Elevadores (etapa 20), como o p_plats.c do Doom, só o tipo "desce, espera, sobe e fica"
// (downWaitUpStay). Puro. Um thinker por setor (level.thinkers).
//
// ctx: { sound(nome, setor), fits(setor, vão), onFloorMoved(setor) (alvos e itens acompanham o chão) }.

export const PLATSPEED = 4;   // unidades por tic (Doom: FRACUNIT * 4)
export const PLATWAIT = 105;  // tics embaixo (Doom: 3 * 35)

export function startPlat(level, s, ctx) {
  const floor = level.sectors[s].floorHeight;
  const p = {
    kind: 'plat', sector: s, status: 'down', speed: PLATSPEED, wait: PLATWAIT, count: 0,
    low: Math.min(level.lowestNeighborFloor(s), floor), high: floor,
  };
  level.thinkers.set(s, p);
  ctx.sound?.('pstart', s);
  return p;
}

// Ativação por tag: setores sem thinker ativo. Devolve true se acionou algum.
export function doPlat(level, tag, ctx) {
  let any = false;
  for (const s of level.tagMap.get(tag) ?? []) {
    if (level.thinkers.has(s)) continue;
    startPlat(level, s, ctx);
    any = true;
  }
  return any;
}

// Um tic. Devolve false quando termina (já removido de level.thinkers).
export function tickPlat(level, p, ctx) {
  const s = p.sector;
  const sec = level.sectors[s];
  if (p.status === 'waiting') {
    if (--p.count <= 0) {
      p.status = 'up';
      ctx.sound?.('pstart', s);
    }
    return true;
  }
  if (p.status === 'down') {
    const floor = Math.max(p.low, sec.floorHeight - p.speed);
    level.setFloor(s, floor);
    ctx.onFloorMoved?.(s);
    if (floor <= p.low) {
      ctx.sound?.('pstop', s);
      p.status = 'waiting';
      p.count = p.wait;
    }
    return true;
  }
  // Subindo: sem esmagar; se um alvo vivo não couber, volta a descer.
  const floor = Math.min(p.high, sec.floorHeight + p.speed);
  if (!ctx.fits(s, sec.ceilingHeight - floor)) {
    p.status = 'down';
    ctx.sound?.('pstart', s);
    return true;
  }
  level.setFloor(s, floor);
  ctx.onFloorMoved?.(s);
  if (floor >= p.high) {
    ctx.sound?.('pstop', s);
    level.thinkers.delete(s);
    return false;
  }
  return true;
}
