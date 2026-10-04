// Morte do jogador (etapa 19), como o P_DeathThink do Doom. Puro. Ângulos em graus do Doom.

export const DEATH_EYE_MIN = 6;     // o olho desce até 6 unidades do chão
export const DEATH_EYE_STEP = 1;    // 1 unidade por tic
export const DEATH_TURN_STEP = 5;   // gira até 5 graus por tic em direção ao assassino
export const RESTART_DELAY = 35;    // tics de morte antes de aceitar o reinício

const norm180 = (a) => ((((a + 180) % 360) + 360) % 360) - 180;

// Altura do olho acima dos pés em deathTics: 41 no tic 0, 6 a partir do tic 35.
export function deathEyeHeight(deathTics, eyeHeight = 41) {
  return Math.max(DEATH_EYE_MIN, eyeHeight - DEATH_EYE_STEP * deathTics);
}

// Um tic de giro: devolve { angle, locked }. A menos de 5 graus, trava na direção do assassino.
export function turnTowards(angle, targetAngle) {
  const diff = norm180(targetAngle - angle);
  if (Math.abs(diff) < DEATH_TURN_STEP) return { angle: ((targetAngle % 360) + 360) % 360, locked: true };
  const next = angle + (diff > 0 ? DEATH_TURN_STEP : -DEATH_TURN_STEP);
  return { angle: ((next % 360) + 360) % 360, locked: false };
}

export const canRestart = (deathTics) => deathTics >= RESTART_DELAY;
