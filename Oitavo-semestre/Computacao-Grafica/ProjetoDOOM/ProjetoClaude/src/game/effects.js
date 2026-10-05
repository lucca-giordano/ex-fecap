// Efeitos temporários de impacto: fumaça da pistola (PUFF) e sangue (BLUD). Puro.
// Coordenadas do Doom; avançam por tic (35 por segundo) junto com o relógio de jogo.

import { PUFF_FRAMES, BLOOD_FRAMES, EFFECT_PREFIXES } from './monsterTable.js';

export const MAX_EFFECTS = 256;
export const EFFECT_RISE = 35;        // u/s para cima, sem gravidade
export const PUFF_BACKOFF = 4;        // a fumaça fica 4 unidades antes do ponto de batida, ao longo do raio
export const EFFECT_Z_JITTER = 4;     // deslocamento vertical aleatório de até ±4
const TICS_PER_SECOND = 35;
// Etapa 23: névoa de teletransporte (S_TFOG do Doom), 6 tics por quadro, sempre com brilho máximo.
export const TFOG_FRAMES = [['A', 6], ['B', 6], ['A', 6], ['B', 6], ['C', 6], ['D', 6], ['E', 6], ['F', 6], ['G', 6], ['H', 6], ['I', 6], ['J', 6]];

const jitter = (rng) => rng.nextRange(-EFFECT_Z_JITTER, EFFECT_Z_JITTER);

export class EffectList {
  constructor() {
    this.items = [];
  }

  reset() {
    this.items = [];
  }

  add(effect) {
    this.items.push(effect);
    if (this.items.length > MAX_EFFECTS) this.items.shift(); // descarta o mais antigo
    return effect;
  }

  // Fumaça: o primeiro quadro dura 4 - (next255 & 3) tics (mínimo 1) e tem brilho máximo.
  // melee (etapa 17): ataque corpo a corpo começa no terceiro quadro (C), como o P_SpawnPuff do Doom
  // com alcance MELEERANGE; o número aleatório é gasto do mesmo jeito.
  spawnPuff(x, y, z, rng, { melee = false } = {}) {
    let frames = PUFF_FRAMES.map(([l, t]) => [l, t]);
    frames[0][1] = Math.max(1, 4 - (rng.next255() & 3));
    if (melee) frames = PUFF_FRAMES.slice(2).map(([l, t]) => [l, t]);
    return this.add({ type: 'puff', prefix: EFFECT_PREFIXES.puff, x, y, z: z + jitter(rng), vz: EFFECT_RISE,
      frames, frameIndex: 0, ticsLeft: frames[0][1], fullbrightFirst: !melee }); // só o quadro A tem brilho máximo
  }

  // Sangue: dano de 9 a 12 começa em B; menor que 9 começa em A; senão C, B, A.
  spawnBlood(x, y, z, damage, rng) {
    let frames = BLOOD_FRAMES;
    if (damage < 9) frames = BLOOD_FRAMES.slice(2);
    else if (damage <= 12) frames = BLOOD_FRAMES.slice(1);
    frames = frames.map(([l, t]) => [l, t]);
    return this.add({ type: 'blood', prefix: EFFECT_PREFIXES.blood, x, y, z: z + jitter(rng), vz: EFFECT_RISE,
      frames, frameIndex: 0, ticsLeft: frames[0][1], fullbrightFirst: false });
  }

  // Etapa 23: névoa no ponto (x, y) com base no chão z (respawn do Nightmare); parada, brilho máximo.
  spawnFog(x, y, z) {
    const frames = TFOG_FRAMES.map(([l, t]) => [l, t]);
    return this.add({ type: 'fog', prefix: 'TFOG', x, y, z, vz: 0, frames, frameIndex: 0, ticsLeft: frames[0][1],
      fullbrightFirst: true, fullbrightAll: true, lightnum: 15 });
  }

  // Um tic: sobe e avança os quadros; remove os que terminaram.
  tick() {
    for (const e of this.items) {
      e.z += e.vz / TICS_PER_SECOND;
      if (--e.ticsLeft <= 0) {
        e.frameIndex++;
        if (e.frameIndex < e.frames.length) e.ticsLeft = e.frames[e.frameIndex][1];
      }
    }
    this.items = this.items.filter((e) => e.frameIndex < e.frames.length);
  }
}

// Letra e brilho do quadro atual de um efeito.
export function effectFrame(e) {
  return { letter: e.frames[e.frameIndex][0], fullbright: Boolean(e.fullbrightAll) || (e.fullbrightFirst && e.frameIndex === 0) };
}
