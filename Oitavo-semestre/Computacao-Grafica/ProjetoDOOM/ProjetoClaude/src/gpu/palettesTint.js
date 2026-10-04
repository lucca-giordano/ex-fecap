// Flashes de tela (etapa 19): escolha da paleta (ST_doPaletteStuff do Doom) e aproximação de cada
// paleta do PLAYPAL por uma mistura mix(c0, T, t) com a paleta 0. Puro.
//
// O Doom troca a paleta inteira (14 no PLAYPAL: 0 normal, 1-8 vermelhas de dano, 9-12 douradas de
// coleta, 13 traje). Aqui a imagem já está em RGB, então o blit mistura cada pixel com a cor alvo T.

export const PLAYPAL_COUNT = 14;
export const DAMAGE_TARGET = [255, 0, 0];      // paletas 1 a 8
export const BONUS_TARGET = [215, 186, 69];    // paletas 9 a 12 (valor de partida)
export const TINT_ERROR_WARN = 6;              // erro médio por canal acima disso gera aviso

// Paleta do flash: dano tem prioridade sobre o bônus.
export function flashPalette(damageCount, bonusCount) {
  if (damageCount > 0) return Math.min(7, Math.floor((damageCount + 7) / 8)) + 1; // 2..8
  if (bonusCount > 0) return Math.min(3, Math.floor((bonusCount + 7) / 8)) + 9;   // 10..12
  return 0;
}

export const targetOf = (k) => (k >= 1 && k <= 8 ? DAMAGE_TARGET : k >= 9 && k <= 12 ? BONUS_TARGET : null);

// playpal: bytes do lump PLAYPAL (14 x 768). Devolve [{ palette, target, t, error }] para k = 0..13:
// t ajustado por mínimos quadrados (soma de (ck - c0)(T - c0) / soma de (T - c0)^2, limitado a 0..1) e
// error = erro médio absoluto por canal entre a paleta real e mix(c0, T, t).
export function computeTintTable(playpal) {
  const count = Math.min(PLAYPAL_COUNT, Math.floor(playpal.length / 768));
  const out = [];
  for (let k = 0; k < PLAYPAL_COUNT; k++) {
    const target = targetOf(k);
    if (!target || k >= count) {
      out.push({ palette: k, target: target ?? [0, 0, 0], t: 0, error: 0 });
      continue;
    }
    let num = 0, den = 0;
    for (let i = 0; i < 768; i++) {
      const c0 = playpal[i], ck = playpal[k * 768 + i], tc = target[i % 3];
      num += (ck - c0) * (tc - c0);
      den += (tc - c0) * (tc - c0);
    }
    const t = den > 0 ? Math.min(1, Math.max(0, num / den)) : 0;
    let err = 0;
    for (let i = 0; i < 768; i++) {
      const c0 = playpal[i], tc = target[i % 3];
      err += Math.abs(playpal[k * 768 + i] - (c0 + (tc - c0) * t));
    }
    out.push({ palette: k, target, t, error: err / 768 });
  }
  return out;
}

// Uniform do tint (vec4): rgb = T / 255, a = t; zero com a paleta 0 ou com os flashes desligados.
export function tintFor(table, palette, enabled = true) {
  const e = table[palette];
  if (!enabled || !e || e.t <= 0) return [0, 0, 0, 0];
  return [e.target[0] / 255, e.target[1] / 255, e.target[2] / 255, e.t];
}
