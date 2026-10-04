// Armas na tela: tabela, máquina de estados em tics, troca de arma, verificação de munição, balanço e
// tiros (ângulo e dano de cada projétil). Puro: sem DOM e sem WebGPU.
// Valores de partida do info.c e do p_pspr.c do Doom (lembrados de memória); letras conferidas contra
// os lumps do freedoom1.wad por tools/check-weapons.mjs.

export const WEAPONTOP = 32;       // sy em repouso (Doom: WEAPONTOP = 32)
export const WEAPONBOTTOM = 128;   // sy fora da tela (Doom: WEAPONBOTTOM = 128)
export const RAISESPEED = 6;       // subida por tic (Doom: RAISESPEED = 6)
export const LOWERSPEED = 6;       // descida por tic (Doom: LOWERSPEED = 6)
export const TICS_PER_SECOND = 35;
export const READY_SX = 1;         // sx em repouso (Doom: psp->sx = FRACUNIT)
export const SWAY_MAX = 16;        // amplitude máxima do balanço (Doom: bob limitado a 16)
export const SWAY_PERIOD = 64;     // tics por volta do balanço (Doom: angle = 128 * leveltime, FINEANGLES = 8192 -> 64 tics)
export const SWAY_SMOOTH = 0.15;   // constante de tempo (s) da suavização da amplitude

export const FIST = 1;
export const PISTOL = 2;
export const SHOTGUN = 3;
export const CHAINGUN = 4;
export const MISSILE_RANGE = 2048;  // alcance das armas de fogo (Doom: MISSILERANGE)
export const MELEE_RANGE = 64;      // alcance do soco (Doom: MELEERANGE)
export const SHOTGUN_PELLETS = 7;
// (P_Random() - P_Random()) << 18 em ângulos de 32 bits: 2^18 / 2^32 * 360 = 0.02197 grau por unidade.
export const SPREAD_DEG = 0.02197;

// Quadro de ataque: letra, duração em tics, ação ao entrar no quadro e clarão ([letra, tics]...).
// A ação 'refire' é avaliada quando o quadro dela termina (com 0 tics, na hora).
const f = (letter, tics, action = null, flash = null) => ({ letter, tics, action, flash });

export const WEAPONS = {
  1: { slot: 1, name: 'fist', prefix: 'PUNG', flashPrefix: null, ammo: null, usable: true, ready: 'A',
    attack: [f('B', 4), f('C', 4, 'punch'), f('D', 5), f('C', 4), f('B', 5, 'refire')] }, // 22 tics
  2: { slot: 2, name: 'pistol', prefix: 'PISG', flashPrefix: 'PISF', ammo: 'clip', usable: true, ready: 'A',
    // Igual às etapas 13 e 14: o tiro sai ao entrar no primeiro quadro. 19 tics.
    attack: [f('A', 4, 'pistol', [['A', 7]]), f('B', 6), f('C', 4), f('B', 5, 'refire')] },
  3: { slot: 3, name: 'shotgun', prefix: 'SHTG', flashPrefix: 'SHTF', ammo: 'shell', usable: true, ready: 'A',
    attack: [f('A', 3), f('A', 7, 'shotgun', [['A', 4], ['B', 3]]), f('B', 5), f('C', 5), f('D', 4),
      f('C', 5), f('B', 5), f('A', 3), f('A', 7, 'refire')] }, // 44 tics
  4: { slot: 4, name: 'chaingun', prefix: 'CHGG', flashPrefix: 'CHGF', ammo: 'clip', usable: true, ready: 'A',
    // Dois tiros por ciclo de 8 tics; o clarão de cada tiro substitui o anterior.
    attack: [f('A', 4, 'chaingunShot', [['A', 5]]), f('B', 4, 'chaingunShot', [['B', 5]]), f('B', 0, 'refire')] },
  // Definidas, mas não utilizáveis nesta etapa.
  5: { slot: 5, name: 'rocketLauncher', prefix: 'MISG', flashPrefix: 'MISF', ammo: 'rocket', usable: false, ready: 'A', attack: [] },
  6: { slot: 6, name: 'plasma', prefix: 'PLSG', flashPrefix: 'PLSF', ammo: 'cell', usable: false, ready: 'A', attack: [] },
  7: { slot: 7, name: 'bfg', prefix: 'BFGG', flashPrefix: 'BFGF', ammo: 'cell', usable: false, ready: 'A', attack: [] },
};
export const USABLE_SLOTS = Object.values(WEAPONS).filter((w) => w.usable).map((w) => w.slot);
// Ordem da troca automática sem munição (P_CheckAmmo): metralhadora, espingarda, pistola, soco.
export const FALLBACK_ORDER = [CHAINGUN, SHOTGUN, PISTOL, FIST];

// Lumps de sprite que uma arma precisa (parado, ataque e clarão), como 'PUNGA0'.
export function weaponLumps(slot) {
  const w = WEAPONS[slot];
  const names = new Set([`${w.prefix}${w.ready}0`]);
  for (const fr of w.attack) {
    names.add(`${w.prefix}${fr.letter}0`);
    for (const [letter] of fr.flash ?? []) names.add(`${w.flashPrefix}${letter}0`);
  }
  return [...names];
}

// Slots utilizáveis com todos os lumps presentes. hasLump(nome) -> boolean.
export function availableSlots(hasLump) {
  return USABLE_SLOTS.filter((slot) => weaponLumps(slot).every(hasLump));
}

// Duração do ataque (soma dos tics); a metralhadora dá 2 tiros nesse tempo.
export const attackTics = (slot) => WEAPONS[slot].attack.reduce((sum, fr) => sum + fr.tics, 0);

// --- Estado ---

// available: slots utilizáveis com lumps (padrão: todos os utilizáveis); current: arma inicial.
export function createWeapons({ available = USABLE_SLOTS, current = PISTOL } = {}) {
  const w = {
    available: new Set(available), current, pending: null,
    state: 'raise', // 'lower' (descendo), 'raise' (subindo), 'ready' (parada), 'fire' (atacando)
    frame: WEAPONS[current].ready, sx: READY_SX, sy: WEAPONBOTTOM,
    fireIndex: 0, stateTics: 0, amplitude: 0,
    refire: 0, // disparos consecutivos sem soltar desde o último tiro preciso
    flash: null, flashTics: 0, // clarão atual { prefix, seq, index, tics } e tics restantes no total
  };
  return w;
}

// Começa a levantar a arma `slot` (início do jogo e NEW GAME), sem troca pendente.
export function startRaise(w, slot = w.current) {
  Object.assign(w, { current: slot, pending: null, state: 'raise', frame: WEAPONS[slot].ready, sx: READY_SX,
    sy: WEAPONBOTTOM, fireIndex: 0, stateTics: 0, refire: 0, flash: null, flashTics: 0 });
}

export const owns = (slot, stats) => stats.weaponsOwned.has(slot);
export const hasAmmo = (slot, stats) => !WEAPONS[slot].ammo || stats.ammo[WEAPONS[slot].ammo] >= 1;
// Pode ser escolhida: utilizável, com lumps e possuída.
export const canSelect = (w, slot, stats) => Boolean(WEAPONS[slot]?.usable) && w.available.has(slot) && owns(slot, stats);

// Primeira arma da ordem de troca que pode ser escolhida e tem munição (o soco sempre tem).
export function fallbackWeapon(w, stats) {
  return FALLBACK_ORDER.find((slot) => canSelect(w, slot, stats) && hasAmmo(slot, stats)) ?? FIST;
}

function startLower(w) {
  w.state = 'lower';
  w.frame = WEAPONS[w.current].ready;
}

// Pedido de troca: devolve true se aceito. Ignorado para a arma ativa, não possuída, não utilizável ou
// sem lumps. Parada: começa a descer na hora; atacando: espera o fim do ataque.
export function requestWeapon(w, slot, stats) {
  if (slot === w.current || !canSelect(w, slot, stats)) return false;
  w.pending = slot;
  if (w.state === 'ready') startLower(w);
  return true;
}

// Ciclo da roda: armas que podem ser escolhidas, em ordem crescente, com volta. dir = +1 avança.
export function cycleTarget(w, stats, dir) {
  const list = Object.keys(WEAPONS).map(Number).filter((slot) => canSelect(w, slot, stats));
  if (list.length === 0) return null;
  const base = list.indexOf(w.pending ?? w.current);
  if (base < 0) return list[0];
  return list[(base + dir + list.length) % list.length];
}

export function cycleWeapon(w, stats, dir) {
  const target = cycleTarget(w, stats, dir);
  return target !== null && requestWeapon(w, target, stats);
}

// Troca automática ao pegar itens (não muda as regras de coleta).
// info: { weaponGained: slot | null, ammoFromZero: ['clip', 'shell', ...] } (do evento do ItemSystem).
export function autoSwitchOnPickup(w, info, stats) {
  const fromZero = info.ammoFromZero ?? [];
  if (fromZero.includes('clip') && w.current === FIST) {
    requestWeapon(w, canSelect(w, CHAINGUN, stats) ? CHAINGUN : PISTOL, stats);
  }
  if (fromZero.includes('shell') && (w.current === FIST || w.current === PISTOL) && canSelect(w, SHOTGUN, stats)) {
    requestWeapon(w, SHOTGUN, stats);
  }
  // Arma nova utilizável vira a pendente (vale sobre as regras de munição).
  if (info.weaponGained) requestWeapon(w, info.weaponGained, stats);
}

// --- Balanço ---

// Pose de repouso com o balanço do tic atual.
export function readyPose(amplitude, tic) {
  const a = 2 * Math.PI * (((tic % SWAY_PERIOD) + SWAY_PERIOD) % SWAY_PERIOD) / SWAY_PERIOD;
  return { sx: READY_SX + amplitude * Math.cos(a), sy: WEAPONTOP + amplitude * Math.abs(Math.sin(a)) };
}

// Amplitude do balanço, suavizada com decaimento exponencial (constante SWAY_SMOOTH segundos).
// speed: velocidade horizontal real; baseSpeed: velocidade base; active: andando no chão.
export function updateSwayAmplitude(w, speed, baseSpeed, active, dt) {
  const target = active ? SWAY_MAX * Math.min(1, Math.max(0, speed / baseSpeed)) : 0;
  w.amplitude += (target - w.amplitude) * (1 - Math.exp(-dt / SWAY_SMOOTH));
  return w.amplitude;
}

// --- Máquina de estados ---

function flashRemaining(flash) {
  if (!flash) return 0;
  let total = flash.tics;
  for (let i = flash.index + 1; i < flash.seq.length; i++) total += flash.seq[i][1];
  return total;
}

function tickFlash(w) {
  const fl = w.flash;
  if (fl && --fl.tics <= 0) {
    fl.index++;
    if (fl.index < fl.seq.length) fl.tics = fl.seq[fl.index][1];
    else w.flash = null;
  }
  w.flashTics = flashRemaining(w.flash);
}

// Ação de disparo: gasta 1 de munição (exceto o soco); sem munição, não dispara (A_FireCGun).
function fireAction(w, fr, ctx) {
  const def = WEAPONS[w.current];
  if (def.ammo && !ctx.stats.spendAmmo(1, def.ammo)) return;
  ctx.events.push({ type: 'fire', weapon: w.current, action: fr.action, refire: w.refire, flash: Boolean(fr.flash) });
  if (fr.flash) {
    w.flash = { prefix: def.flashPrefix, seq: fr.flash, index: 0, tics: fr.flash[0][1] };
    w.flashTics = flashRemaining(w.flash);
  }
}

function enterFrame(w, index, ctx) {
  const fr = WEAPONS[w.current].attack[index];
  w.fireIndex = index;
  w.frame = fr.letter;
  w.stateTics = fr.tics;
  if (fr.action && fr.action !== 'refire') fireAction(w, fr, ctx);
  if (fr.tics === 0) finishFrame(w, ctx);
}

// Fim do ataque: verificação de munição (sem munição, escolhe a próxima e desce).
function endAttack(w, ctx) {
  w.refire = 0; // soltou: o próximo tiro volta a ser preciso
  w.state = 'ready';
  w.frame = WEAPONS[w.current].ready;
  if (w.pending === null && !hasAmmo(w.current, ctx.stats)) {
    const next = fallbackWeapon(w, ctx.stats);
    if (next !== w.current) w.pending = next;
  }
  if (w.pending !== null) startLower(w);
}

function finishFrame(w, ctx) {
  const attack = WEAPONS[w.current].attack;
  const fr = attack[w.fireIndex];
  if (fr.action === 'refire') {
    if (ctx.input.fire && w.pending === null && hasAmmo(w.current, ctx.stats)) {
      w.refire++; // segurando: disparo contínuo, com espalhamento
      enterFrame(w, 0, ctx);
    } else {
      endAttack(w, ctx);
    }
  } else if (w.fireIndex + 1 < attack.length) {
    enterFrame(w, w.fireIndex + 1, ctx);
  } else {
    endAttack(w, ctx);
  }
}

// Avança um tic. input: { fire }; stats: PlayerStats; tic: número do tic (balanço).
// Eventos acrescentados em `events` (também devolvida): { type: 'fire', weapon, action, refire, flash }
// no tic da ação de disparo e { type: 'weaponChanged', slot } quando a arma atual muda.
export function tickWeapons(w, input, stats, tic, events = []) {
  tickFlash(w);
  const ctx = { input, stats, events };

  if (w.state === 'lower') {
    w.sy += LOWERSPEED;
    if (w.sy >= WEAPONBOTTOM) {
      w.sy = WEAPONBOTTOM;
      if (w.pending !== null && w.pending !== w.current) {
        w.current = w.pending;
        events.push({ type: 'weaponChanged', slot: w.current });
      }
      w.pending = null;
      w.state = 'raise';
      w.frame = WEAPONS[w.current].ready;
    }
    return events;
  }

  if (w.state === 'raise') {
    w.sy -= RAISESPEED;
    if (w.sy <= WEAPONTOP) {
      w.sy = WEAPONTOP;
      w.state = 'ready';
    }
    return events;
  }

  if (w.state === 'ready') {
    if (w.pending !== null) {
      startLower(w);
      return events;
    }
    if (input.fire && WEAPONS[w.current].attack.length > 0) {
      if (hasAmmo(w.current, stats)) {
        // sx e sy ficam congelados nos últimos valores calculados em PARADA.
        w.state = 'fire';
        w.refire = 0; // primeiro disparo depois de parada: tiro preciso
        enterFrame(w, 0, ctx);
        return events;
      }
      const next = fallbackWeapon(w, stats); // sem munição: troca, sem som de arma vazia
      if (next !== w.current) {
        w.pending = next;
        startLower(w);
        return events;
      }
    }
    w.frame = WEAPONS[w.current].ready;
    const pose = readyPose(w.amplitude, tic);
    w.sx = pose.sx;
    w.sy = pose.sy;
    return events;
  }

  // Atacando.
  w.stateTics--;
  if (w.stateTics <= 0) finishFrame(w, ctx);
  return events;
}

// Avança de fromTic (exclusivo) até toTic (inclusivo), um tic por vez. Devolve os eventos dos tics.
export function updateWeapons(w, input, stats, fromTic, toTic) {
  const events = [];
  for (let t = fromTic + 1; t <= toTic; t++) tickWeapons(w, input, stats, t, events);
  return events;
}

// --- Tiros ---

// Projéteis de um evento "fire": [{ yaw (graus), damage, range, melee }]. rng: { next255() }.
// A ordem das chamadas ao rng segue o Doom: dano primeiro, depois o desvio.
export function shotsFor(slot, refire, baseYaw, rng) {
  const spread = () => (rng.next255() - rng.next255()) * SPREAD_DEG;
  const bullet = () => 5 * (rng.next255() % 3 + 1); // 5, 10 ou 15
  if (slot === FIST) {
    const damage = (rng.next255() % 10 + 1) * 2; // 2 a 20
    return [{ yaw: baseYaw + spread(), damage, range: MELEE_RANGE, melee: true }];
  }
  if (slot === SHOTGUN) {
    const out = [];
    for (let i = 0; i < SHOTGUN_PELLETS; i++) {
      const damage = bullet();
      out.push({ yaw: baseYaw + spread(), damage, range: MISSILE_RANGE, melee: false }); // sempre com desvio
    }
    return out;
  }
  const damage = bullet();
  return [{ yaw: refire > 0 ? baseYaw + spread() : baseYaw, damage, range: MISSILE_RANGE, melee: false }];
}

// --- Desenho ---

// Coluna esquerda e linha de cima do sprite na camada de 320x200 (visão de 168 linhas do Doom):
// x = round(sx - leftOffset); y = floor(sy - topOffset - 16.5).
export const WEAPON_Y_ADJUST = 16.5;
export function weaponTopLeft(patch, sx, sy) {
  return { x: Math.round(sx - patch.leftOffset), y: Math.floor(sy - patch.topOffset - WEAPON_Y_ADJUST) };
}

// Nível de luz da arma: clamp((15 - lightnum) * 4 - 23, 0, 31); 0 com a iluminação desligada.
export function weaponLightLevel(lightnum, lighting) {
  if (!lighting) return 0;
  return Math.min(31, Math.max(0, (15 - lightnum) * 4 - 23));
}

// O que a camada de HUD desenha: { prefix, frame, sx, sy, flash: { prefix, letter } | null, ammo }.
export function weaponView(w) {
  const def = WEAPONS[w.current];
  const fl = w.flash;
  return { prefix: def.prefix, frame: w.frame, sx: w.sx, sy: w.sy, ammo: def.ammo,
    flash: fl ? { prefix: fl.prefix, letter: fl.seq[fl.index][0] } : null };
}
