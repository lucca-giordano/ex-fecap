// Etapa 17: a máquina de estados das armas foi para weapons.js. Este arquivo só reexporta, e mantém
// os nomes da etapa 13 (createPistol, tickPistol, updatePistol) usados pelos testes anteriores.

import { createWeapons, tickWeapons, updateWeapons, PISTOL } from './weapons.js';

export {
  WEAPONTOP, WEAPONBOTTOM, RAISESPEED, LOWERSPEED, TICS_PER_SECOND, READY_SX, SWAY_MAX, SWAY_PERIOD, SWAY_SMOOTH,
  WEAPON_Y_ADJUST, startRaise, readyPose, updateSwayAmplitude, weaponTopLeft, weaponLightLevel,
} from './weapons.js';

// Estado de armas começando na pistola. O argumento antigo (letras de PISG presentes) é ignorado:
// agora uma arma com lumps ausentes fica indisponível inteira (availableSlots em weapons.js).
export function createPistol() {
  return createWeapons({ current: PISTOL });
}
export const tickPistol = tickWeapons;
export const updatePistol = updateWeapons;
