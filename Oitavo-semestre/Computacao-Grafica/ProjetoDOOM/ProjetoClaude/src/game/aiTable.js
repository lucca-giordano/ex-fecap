// IA dos monstros: direções, velocidades, constantes e quadros por tipo. Puro.
// Valores do info.c e do p_enemy.c do Doom (lembrados de memória); as letras são conferidas contra os
// lumps do WAD por resolveMonsterTable (monsterTable.js). Quadros: [letra, tics, ação, brilho?].

export const MELEERANGE = 64;
export const MAX_STEP = 24;
export const REACTION_TIME = 8;
export const TICS_PER_SECOND = 35;
export const NODIR = 8;
export const PLAYER_HEIGHT = 56;
export const PLAYER_RADIUS = 16;

// Direções: 0 leste, 1 nordeste, 2 norte, 3 noroeste, 4 oeste, 5 sudoeste, 6 sul, 7 sudeste, 8 nenhuma.
export const OPPOSITE = [4, 5, 6, 7, 0, 1, 2, 3, 8];
// Índice: (deltaY < 0 ? 2 : 0) + (deltaX > 0 ? 1 : 0) -> noroeste, nordeste, sudoeste, sudeste.
export const DIAGS = [3, 1, 5, 7];
// Passo por tic na direção d, por unidade de velocidade (47000/65536 nos eixos, 32000/65536 nas diagonais).
export const XSPEED = [47000, 32000, 0, -32000, -47000, -32000, 0, 32000].map((v) => v / 65536);
export const YSPEED = [0, 32000, 47000, 32000, 0, -32000, -47000, -32000].map((v) => v / 65536);
export const dirAngle = (d) => d * 45; // graus, 0 = leste, anti-horário

// P_AproxDistance.
export function aproxDist(dx, dy) {
  const ax = Math.abs(dx), ay = Math.abs(dy);
  return ax + ay - Math.min(ax, ay) / 2;
}

// Desvio de yaw dos tiros de monstro: (P_Random() - P_Random()) << 20 em ângulos de 32 bits.
export const MONSTER_SPREAD_DEG = 0.0878;

const s = (spec) => spec.trim().split(/\s+/).map((f) => {
  // 'A10:look' ou 'F8:posAttack:bright'
  const [lt, action = null, bright] = f.split(':');
  return [lt[0], Number(lt.slice(1)), action, bright === 'bright'];
});
const stand = s('A10:look B10:look');
const run = (t) => s(`A${t}:chase A${t}:chase B${t}:chase B${t}:chase C${t}:chase C${t}:chase D${t}:chase D${t}:chase`);
const posSee = ['posit1', 'posit2', 'posit3'];

// speed: unidades por tic; spawn: parado; see: corrida; melee e missile: ataques (null se o tipo não
// tem). A dor fica em monsterTable.js (o som toca ao entrar no 2º quadro, como o A_Pain).
// sounds: see (sorteio), active, attack (ao entrar no ataque corpo a corpo, como o attacksound).
// Os sons de dor e de tiro (pistol, shotgn) e da garra (claw) são tocados pelas ações.
export const AI_TABLE = {
  3004: { speed: 8, spawn: stand, see: run(4), melee: null,
    missile: s('E10:faceTarget F8:posAttack:bright E8'),
    sounds: { see: posSee, active: 'posact', attack: null } },
  9: { speed: 8, spawn: stand, see: run(4), melee: null,
    missile: s('E10:faceTarget F10:sPosAttack:bright E10'),
    sounds: { see: posSee, active: 'posact', attack: null } },
  // Diabrete: só o ataque corpo a corpo nesta etapa (a bola de fogo é um projétil).
  3001: { speed: 8, spawn: stand, see: run(3), missile: null,
    melee: s('E8:faceTarget F8:faceTarget G6:troopAttack'),
    sounds: { see: ['bgsit1', 'bgsit2'], active: 'bgact', attack: null } },
  3002: { speed: 10, spawn: stand, see: run(2), missile: null,
    melee: s('E8:faceTarget F8:faceTarget G8:sargAttack'),
    sounds: { see: ['sgtsit'], active: 'dmact', attack: 'sgtatk' } },
};
AI_TABLE[58] = AI_TABLE[3002]; // espectro: o mesmo do demônio (o fuzz vem do thingTable)

export const AI_TYPES = Object.keys(AI_TABLE).map(Number);
