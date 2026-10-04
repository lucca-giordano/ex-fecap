// Tabela de objetos (THINGS) com sprite e filtro de dificuldade. Puro: sem DOM e sem WebGPU.
// tipo -> { prefix, frames, tics, fullbright, fuzz }:
//   frames: letras da animação parada; tics: duração de cada quadro (35 tics por segundo).
// Tipos conferidos contra os lumps do freedoom1.wad por tools/check-sprites.mjs.

export const SKILL = 3;
export const TICS_PER_SECOND = 35;

const t = (prefix, frames = 'A', tics = 0, extra = {}) => ({ prefix, frames, tics, fullbright: false, fuzz: false, ...extra });
const lit = (prefix, frames = 'A', tics = 0) => t(prefix, frames, tics, { fullbright: true });

export const THING_TABLE = {
  // Inimigos
  3004: t('POSS', 'AB', 10),
  9: t('SPOS', 'AB', 10),
  3001: t('TROO', 'AB', 10),
  3002: t('SARG', 'AB', 10),
  58: t('SARG', 'AB', 10, { fuzz: true }),
  3005: t('HEAD', 'A', 10),
  3006: t('SKUL', 'AB', 6),
  3003: t('BOSS', 'AB', 10),
  // Armas e munição
  2001: t('SHOT'), 2002: t('MGUN'), 2003: t('LAUN'), 2004: t('PLAS'), 2005: t('CSAW'),
  2007: t('CLIP'), 2008: t('SHEL'), 2010: t('ROCK'), 2046: t('BROK'), 2047: t('CELL'), 17: t('CELP'),
  2048: t('AMMO'), 2049: t('SBOX'), 8: t('BPAK'),
  // Saúde e armadura
  2011: t('STIM'), 2012: t('MEDI'),
  2014: t('BON1', 'ABCDCB', 6), 2015: t('BON2', 'ABCDCB', 6),
  2018: t('ARM1', 'AB', 6), 2019: t('ARM2', 'AB', 6),
  // Poderes (fullbright)
  2013: lit('SOUL', 'ABCDCB', 6), 2023: lit('PSTR'), 2024: lit('PINS', 'ABCD', 6), 2025: lit('SUIT'),
  2026: lit('PMAP', 'ABCDCB', 6), 2045: lit('PVIS', 'AB', 6), 2022: lit('PINV', 'ABCD', 6),
  // Chaves
  5: t('BKEY', 'AB', 10), 6: t('YKEY', 'AB', 10), 13: t('RKEY', 'AB', 10),
  40: t('BSKU', 'AB', 10), 39: t('YSKU', 'AB', 10), 38: t('RSKU', 'AB', 10),
  // Decoração
  2035: t('BAR1', 'AB', 6), 2028: lit('COLU'), 48: t('ELEC'),
  44: lit('TBLU', 'ABCD', 4), 45: lit('TGRN', 'ABCD', 4), 46: lit('TRED', 'ABCD', 4),
  55: lit('SMBT', 'ABCD', 4), 56: lit('SMGT', 'ABCD', 4), 57: lit('SMRT', 'ABCD', 4),
  70: lit('FCAN', 'ABC', 4), 85: lit('TLMP', 'ABCD', 4), 86: lit('TLP2', 'ABCD', 4),
  43: t('TRE1'), 54: t('TRE2'), 47: t('SMIT'),
  24: t('POL5'), 26: t('POL6', 'AB', 6), 60: t('GOR4'),
  // Etapa 16: itens e decoração sólida que faltavam (conferidos contra o WAD por tools/check-items.mjs).
  2006: t('BFUG'),                        // BFG9000
  83: lit('MEGA', 'ABCD', 6),             // megasphere (sem sprite no freedoom1: fica não resolvido)
  25: t('POL1'), 27: t('POL4'), 28: t('POL2'), 29: lit('POL3', 'AB', 6), // empalados e pilhas de caveiras
  30: t('COL1'), 31: t('COL2'), 32: t('COL3'), 33: t('COL4'), 36: t('COL5', 'AB', 14), 37: t('COL6'), // pilares
  35: lit('CBRA'),                        // candelabro
  // Corpos (quadro final da morte, parado)
  10: t('PLAY', 'W'), 12: t('PLAY', 'W'), 15: t('PLAY', 'N'),
  18: t('POSS', 'L'), 19: t('SPOS', 'L'), 20: t('TROO', 'M'), 21: t('SARG', 'N'),
};

// Tipos sem sprite, ignorados em silêncio: inícios dos jogadores 1 a 4, deathmatch, destino de teletransporte.
export const IGNORED_TYPES = new Set([1, 2, 3, 4, 11, 14]);

const MTF_MULTIPLAYER = 0x0010;

// Bit de dificuldade das flags: 0x0001 (1 e 2), 0x0002 (3), 0x0004 (4 e 5).
export function skillBit(skill) {
  return skill <= 2 ? 0x0001 : skill === 3 ? 0x0002 : 0x0004;
}

// 'ok', 'multiplayer' (só multiplayer) ou 'skill' (não existe nesta dificuldade).
export function skillFilter(flags, skill = SKILL) {
  if (flags & MTF_MULTIPLAYER) return 'multiplayer';
  if (!(flags & skillBit(skill))) return 'skill';
  return 'ok';
}
