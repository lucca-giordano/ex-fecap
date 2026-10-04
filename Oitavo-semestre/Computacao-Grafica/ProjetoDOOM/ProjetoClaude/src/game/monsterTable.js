// Monstros e objetos atiráveis: vida, tamanho, chance de dor, quadros por estado e sons. Puro.
// Valores de partida do info.c do Doom (lembrados de memória); cada letra de quadro é conferida
// contra os lumps do WAD por resolveMonsterTable. Quadros: [letra, tics]; tics -1 = permanece.
// Sons: nomes lógicos (lump sem o "DS").

import { buildFrames, frameComplete } from '../wad/Sprites.js';

const seq = (s) => s.trim().split(/\s+/).map((f) => [f[0], Number(f.slice(1))]);

const zombie = (prefix) => ({
  prefix, health: 20, radius: 20, height: 56, painChance: 200, isMonster: true,
  idle: seq('A10 B10'), pain: seq('G3 G3'),
  death: seq('H5 I5 J5 K5 L-1'), xdeath: seq('M5 N5 O5 P5 Q5 R5 S5 T5 U-1'),
  sounds: { pain: ['popain'], death: ['podth1', 'podth2', 'podth3'] },
});
const demon = {
  prefix: 'SARG', health: 150, radius: 30, height: 56, painChance: 180, isMonster: true,
  idle: seq('A10 B10'), pain: seq('H2 H2'), death: seq('I8 J8 K4 L4 M4 N-1'), xdeath: null,
  sounds: { pain: ['dmpain'], death: ['sgtdth'] },
};

export const MONSTER_TABLE = {
  3004: zombie('POSS'),                                   // zumbi
  9: { ...zombie('SPOS'), health: 30, painChance: 170 },  // zumbi com espingarda
  3001: {                                                 // diabrete
    prefix: 'TROO', health: 60, radius: 20, height: 56, painChance: 200, isMonster: true,
    idle: seq('A10 B10'), pain: seq('H2 H2'),
    death: seq('I8 J8 K6 L6 M-1'), xdeath: seq('N5 O5 P5 Q5 R5 S5 T5 U-1'),
    sounds: { pain: ['popain'], death: ['bgdth1', 'bgdth2'] },
  },
  3002: demon,                                            // demônio
  58: demon,                                              // espectro (fuzz vem do thingTable)
  3005: {                                                 // cacodemônio
    prefix: 'HEAD', health: 400, radius: 31, height: 56, painChance: 128, isMonster: true,
    idle: seq('A10'), pain: seq('E3 E3 F6'), death: seq('G8 H8 I8 J8 K8 L-1'), xdeath: null,
    sounds: { pain: ['dmpain'], death: ['cacdth'] },
  },
  3003: {                                                 // barão
    prefix: 'BOSS', health: 1000, radius: 24, height: 64, painChance: 50, isMonster: true,
    idle: seq('A10 B10'), pain: seq('H2 H2'), death: seq('I8 J8 K8 L8 M8 N8 O-1'), xdeath: null,
    sounds: { pain: ['dmpain'], death: ['brsdth'] },
  },
  3006: {                                                 // alma perdida: removida no fim da morte
    prefix: 'SKUL', health: 100, radius: 16, height: 56, painChance: 256, isMonster: true,
    idle: seq('A10 B10'), pain: seq('E3 E3'), death: seq('F6 G6 H6 I6 J6 K6'), xdeath: null,
    removeAfterDeath: true,
    sounds: { pain: ['dmpain'], death: ['firxpl'] },
  },
  2035: {                                                 // barril: morte com prefixo BEXP, brilho máximo
    prefix: 'BAR1', health: 20, radius: 10, height: 42, painChance: 0, isMonster: false,
    idle: seq('A6 B6'), pain: null, death: seq('A5 B5 C5 D10 E10'), xdeath: null,
    deathPrefix: 'BEXP', deathFullbright: true, removeAfterDeath: true,
    deathActions: { 2: 'explode' }, // no quadro C: dano em raio
    sounds: { pain: [], death: ['barexp'] },
  },
};

// Efeitos (prefixos e quadros).
export const PUFF_FRAMES = seq('A4 B4 C4 D4'); // o primeiro com brilho máximo e duração sorteada
export const BLOOD_FRAMES = seq('C8 B8 A8');
export const EFFECT_PREFIXES = { puff: 'PUFF', blood: 'BLUD' };

// Confere as letras contra os lumps: remove quadros ausentes de cada estado e lista o que saiu.
// Devolve { entries: Map tipo -> entrada resolvida, removed: [texto], unresolved: [tipo] }.
// presentTypes: tipos presentes no mapa.
export function resolveMonsterTable(spriteLumps, presentTypes) {
  const entries = new Map();
  const removed = [];
  const unresolved = [];
  const framesOf = new Map();
  const frames = (prefix) => {
    if (!framesOf.has(prefix)) framesOf.set(prefix, buildFrames(prefix, spriteLumps));
    return framesOf.get(prefix);
  };
  for (const type of presentTypes) {
    const base = MONSTER_TABLE[type];
    if (!base) continue;
    const filter = (state, prefix) => {
      if (!base[state]) return null;
      const kept = base[state].filter(([letter]) => {
        const ok = frameComplete(frames(prefix).get(letter));
        if (!ok) removed.push(`${type} ${prefix}${letter} (${state})`);
        return ok;
      });
      return kept.length ? kept : null;
    };
    const entry = {
      ...base,
      type,
      idle: filter('idle', base.prefix),
      pain: filter('pain', base.prefix),
      death: filter('death', base.deathPrefix ?? base.prefix),
      xdeath: filter('xdeath', base.prefix),
    };
    if (!entry.death) { unresolved.push(type); continue; } // sem quadros de morte: não resolvido
    entries.set(type, entry);
  }
  return { entries, removed, unresolved };
}

// Quadros extras para a textura de sprites: [{ prefix, letter, category }].
// Categorias (ordem de descarte quando faltam camadas): xdeath, pain; death e effect nunca saem.
export function extraSpriteFrames(resolvedEntries) {
  const out = [];
  for (const e of resolvedEntries.values()) {
    for (const [letter] of e.pain ?? []) out.push({ prefix: e.prefix, letter, category: 'pain' });
    for (const [letter] of e.death) out.push({ prefix: e.deathPrefix ?? e.prefix, letter, category: 'death' });
    for (const [letter] of e.xdeath ?? []) out.push({ prefix: e.prefix, letter, category: 'xdeath' });
  }
  for (const [letter] of PUFF_FRAMES) out.push({ prefix: 'PUFF', letter, category: 'effect' });
  for (const [letter] of BLOOD_FRAMES) out.push({ prefix: 'BLUD', letter, category: 'effect' });
  return out;
}
