// Códigos de trapaça (etapa 22). Puro. Reconhecimento por event.code (KeyA a KeyZ): um buffer com as
// últimas 12 letras, casando o final com as sequências. Como o m_cheat.c do Doom, sem IDBEHOLD,
// IDCHOPPERS nem IDMUS. Etapa 23: IDCLEV espera dois dígitos (episódio e mapa) por até 105 tics.

import { AMMO_TYPES, KEY_NAMES, MAX_HEALTH } from './PlayerStats.js';

export const CHEAT_BUFFER = 12;
export const CHEATS = {
  iddqd: 'IDDQD', idkfa: 'IDKFA', idfa: 'IDFA', idclip: 'IDCLIP', idspispopd: 'IDSPISPOPD', iddt: 'IDDT', idmypos: 'IDMYPOS',
  idclev: 'IDCLEV', // etapa 23: seguido de dois dígitos
};
export const CLEV_WAIT_TICS = 105;
// Dígito de event.code (linha de cima ou teclado numérico) ou null.
export const digitOf = (code) => /^(?:Digit|Numpad)([0-9])$/.exec(code)?.[1] ?? null;
const SEQUENCES = Object.entries(CHEATS);
export const MIN_PREFIX = 2; // "ID" em diante: a tecla não dispara atalhos de alternância

export class CheatReader {
  constructor() {
    this.buffer = '';
    this.pending = null; // etapa 23: { name: 'idclev', digits, tics } enquanto espera os dígitos
  }

  // Esvazia o buffer e cancela a espera de dígitos. Devolve true se havia uma espera.
  clear() {
    this.buffer = '';
    const had = Boolean(this.pending);
    this.pending = null;
    return had;
  }

  // Um tic de jogo: a espera dos dígitos acaba em CLEV_WAIT_TICS. Devolve true quando expira.
  tick() {
    if (!this.pending) return false;
    if (--this.pending.tics > 0) return false;
    this.pending = null;
    return true;
  }

  // Uma tecla (event.code). Devolve { cheat: nome | null, consume: boolean }. A tecla é consumida se o buffer ANTES dela já terminava num prefixo de 2 letras ou mais ("ID"...),
  // se o buffer DEPOIS dela termina num prefixo assim, ou se ela completou um código.
  // Etapa 23: durante a espera do IDCLEV, os dígitos são consumidos (não trocam de arma); o segundo
  // devolve { cheat: 'idclev', arg: 'EM' }; Esc devolve { cheat: 'idclevCancel' }.
  push(code, repeat = false) {
    if (this.pending) {
      if (code === 'Escape') { this.pending = null; return { cheat: 'idclevCancel', consume: true }; }
      const d = digitOf(code);
      if (d === null) return { cheat: null, consume: false };
      if (repeat) return { cheat: null, consume: true };
      this.pending.digits += d;
      if (this.pending.digits.length < 2) return { cheat: null, consume: true };
      const arg = this.pending.digits;
      this.pending = null;
      return { cheat: 'idclev', arg, consume: true };
    }
    if (repeat || !/^Key[A-Z]$/.test(code)) return { cheat: null, consume: false };
    const before = endsInPrefix(this.buffer);
    this.buffer = (this.buffer + code[3]).slice(-CHEAT_BUFFER);
    for (const [name, seq] of SEQUENCES) {
      if (this.buffer.endsWith(seq)) {
        this.clear();
        if (name === 'idclev') { this.pending = { name, digits: '', tics: CLEV_WAIT_TICS }; return { cheat: 'idclevStart', consume: true }; }
        return { cheat: name, consume: true };
      }
    }
    return { cheat: null, consume: before || endsInPrefix(this.buffer) };
  }
}

// O final do texto (2 letras ou mais) é o começo de algum código?
function endsInPrefix(text) {
  for (let n = Math.min(text.length, CHEAT_BUFFER); n >= MIN_PREFIX; n--) {
    const tail = text.slice(-n);
    if (SEQUENCES.some(([, seq]) => seq.startsWith(tail))) return true;
  }
  return false;
}

// IDKFA e IDFA: armas 1 a 7, mochila, munição no máximo, armadura 200 azul; IDKFA também as chaves.
export function giveAll(stats, withKeys) {
  for (let slot = 1; slot <= 7; slot++) stats.weaponsOwned.add(slot);
  stats.hasBackpack = true;
  for (const t of AMMO_TYPES) stats.ammo[t] = stats.maxAmmoOf(t);
  stats.armor = 200;
  stats.armorType = 2;
  if (withKeys) for (const k of KEY_NAMES) stats.keys[k] = true;
}

// IDDQD: alterna o modo deus; ao ligar, vida 100 se estiver abaixo. Devolve o novo estado.
export function toggleGod(stats, current) {
  const on = !current;
  if (on && stats.health < 100) stats.health = Math.min(MAX_HEALTH, 100);
  return on;
}

// IDMYPOS: "ANG=90 X=1056 Y=-3616" (decimais, coordenadas do Doom).
export function myPosText(angleDeg, x, y) {
  const a = ((Math.round(angleDeg) % 360) + 360) % 360;
  return `ANG=${a} X=${Math.round(x)} Y=${Math.round(y)}`;
}
