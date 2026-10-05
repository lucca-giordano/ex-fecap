// Dificuldade (etapa 23): os efeitos do gameskill do Doom 1. Puro.
// 1 I'm too young to die, 2 Hey, not too rough, 3 Hurt me plenty, 4 Ultra-Violence, 5 Nightmare!

export const SKILL_MIN = 1;
export const SKILL_MAX = 5;
export const NIGHTMARE = 5;

// Nightmare (G_InitNew com sk_nightmare): projéteis do diabrete e do barão a 20 unidades por tic.
const FAST_MISSILE_SPEED = { troopShot: 20, bruiserShot: 20 };
// Tipos que usam os estados S_SARG_* (demônio e espectro): corrida, ataque e dor com metade dos tics.
export const SARG_TYPES = new Set([3002, 58]);
// P_NightmareRespawn: corpo parado há 12 segundos, testado quando leveltime & 31 == 0 e P_Random <= 4.
export const RESPAWN_TICS = 12 * 35;
export const RESPAWN_CHANCE = 4;
export const RESPAWN_REACTION = 18;

export function clampSkill(skill) {
  return Math.min(SKILL_MAX, Math.max(SKILL_MIN, Math.trunc(skill) || 3));
}

// Dano ao jogador depois da dificuldade (P_DamageMobj: damage >>= 1 em sk_baby, antes da armadura).
export const scaleDamage = (amount, params) => amount >> params.damageShift;

// Parâmetros de cada dificuldade:
//   ammoScale    munição recebida x2 em 1 e 5 (P_GiveAmmo);
//   damageShift  dano ao jogador >> 1 em 1, antes da armadura (P_DamageMobj);
//   fast         Nightmare: reactionTime 0, ataque à distância sem esperar o movecount, sem nova direção
//                depois do ataque e estados do demônio com metade dos tics;
//   respawn      Nightmare: monstros mortos voltam (P_NightmareRespawn);
//   missileSpeed(tipo) -> velocidade ou undefined (a da tabela).
export function skillParams(skill) {
  const s = clampSkill(skill);
  const fast = s === NIGHTMARE;
  return {
    skill: s,
    ammoScale: s === 1 || s === NIGHTMARE ? 2 : 1,
    damageShift: s === 1 ? 1 : 0,
    fast,
    respawn: fast,
    missileSpeed: fast ? (type) => FAST_MISSILE_SPEED[type] : null,
  };
}
