// Volume e posição estéreo dos sons, como o S_AdjustSoundParams do Doom, em unidades do mapa.
// Puro: sem Web Audio. Coordenadas do Doom (x leste, y norte, ângulos anti-horários a partir do leste).

export const S_CLOSE_DIST = 200;     // até aqui, volume máximo
export const S_CLIPPING_DIST = 1200; // além daqui, o som não toca
export const S_ATTENUATOR = S_CLIPPING_DIST - S_CLOSE_DIST; // 1000
export const S_STEREO_SWING = 0.75;  // pan máximo (no Doom, 96 de 128 = 0.75)
export const MAX_VOLUME_LEVEL = 15;

// Distância aproximada do Doom (P_AproxDistance): |dx| + |dy| - min(|dx|, |dy|) / 2.
export function aproxDist(dx, dy) {
  const ax = Math.abs(dx), ay = Math.abs(dy);
  return ax + ay - Math.min(ax, ay) / 2;
}

// Volume por distância: 1 até S_CLOSE_DIST; 0 (não toca) além de S_CLIPPING_DIST; linear entre os dois.
export function distanceVolume(d) {
  if (d <= S_CLOSE_DIST) return 1;
  if (d > S_CLIPPING_DIST) return 0;
  return (S_CLIPPING_DIST - d) / S_ATTENUATOR;
}

// Pan de -1 (esquerda) a 1 (direita): ang = ângulo do ouvinte até a fonte menos o ângulo do olhar;
// pan = -0.75 * sin(ang). Fonte à esquerda (+90) dá -0.75; à direita (-90) dá +0.75.
export function panFor(listener, source) {
  const dx = source.x - listener.x, dy = source.y - listener.y;
  if (dx === 0 && dy === 0) return 0;
  const ang = Math.atan2(dy, dx) * 180 / Math.PI - listener.angleDeg;
  return -S_STEREO_SWING * Math.sin(ang * Math.PI / 180);
}

// Volume mestre (S_SetSfxVolume do Doom): nível inteiro 0..15 -> nível * 8 / 127; mudo = 0.
export function masterGain(level, muted) {
  return muted ? 0 : (level * 8) / 127;
}

// Parâmetros de um som: sem posição (menu, jogador) -> volume 1, pan 0.
// Devolve { audible, volume, pan, dist }.
export function adjustSoundParams(listener, source) {
  if (!source || !Number.isFinite(source.x) || !Number.isFinite(source.y) || !listener) {
    return { audible: true, volume: 1, pan: 0, dist: 0 };
  }
  const dist = aproxDist(source.x - listener.x, source.y - listener.y);
  const volume = distanceVolume(dist);
  return { audible: volume > 0, volume, pan: panFor(listener, source), dist };
}
