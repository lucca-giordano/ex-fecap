// Objetos sólidos que bloqueiam o jogador no modo andar. Puro. Coordenadas do Doom.
// Colisão em caixa, sem altura, como o PIT_CheckThing do Doom: o jogador colide com o sólido s se
// |x - s.x| < s.radius + PLAYER_RADIUS e |y - s.y| < s.radius + PLAYER_RADIUS.

// Decoração sólida fixa: tipo -> raio (valores do mobjinfo do Doom, lembrados de memória).
// Objetos pendurados no teto ficam de fora (simplificação).
export const SOLID_DECORATION = {
  2028: 16, // lâmpada de chão
  48: 16,   // coluna eletrônica alta
  85: 16, 86: 16, // lâmpadas técnicas
  44: 16, 45: 16, 46: 16, // candelabros altos (tochas)
  55: 16, 56: 16, 57: 16, // candelabros baixos
  47: 16,   // toco marrom (SMIT)
  43: 16,   // árvore queimada
  54: 32,   // árvore grande
  30: 16, 31: 16, 32: 16, 33: 16, 36: 16, 37: 16, // pilares
  35: 16,   // candelabro
  25: 16, 26: 16, 27: 16, 28: 16, 29: 16, // empalados e pilhas de caveiras
  70: 10,   // barril em chamas
};

const PUSH_EPSILON = 0.01;

// Sólidos fixos do mapa: objetos (já resolvidos e filtrados) cujo tipo está na tabela.
export function staticSolids(objects, typeOf) {
  const out = [];
  for (const obj of objects) {
    const radius = SOLID_DECORATION[typeOf(obj)];
    if (radius) out.push({ x: obj.x, y: obj.y, radius });
  }
  return out;
}

// Lista do frame (reaproveita `out`): monstros e barris vivos (shootable) com o raio da tabela, e a
// decoração fixa.
export function getSolids(out, monsters, fixed) {
  out.length = 0;
  for (const m of monsters) if (m.shootable && !m.removed) out.push({ x: m.x, y: m.y, radius: m.entry.radius });
  for (const s of fixed) out.push(s);
  return out;
}

// Empurra o centro do jogador para fora dos sólidos pelo eixo de menor penetração (+0.01).
// Com dx (ou dy) exatamente zero, usa o lado de onde o jogador veio (prevX, prevY).
// Devolve true se moveu o jogador.
export function pushOutSolids(state, solids, playerRadius, prevX, prevY) {
  let moved = false;
  for (const s of solids) {
    const r = s.radius + playerRadius;
    const dx = state.x - s.x, dy = state.y - s.y;
    if (Math.abs(dx) >= r || Math.abs(dy) >= r) continue;
    const px = r - Math.abs(dx), py = r - Math.abs(dy);
    if (px < py) {
      const sign = dx !== 0 ? Math.sign(dx) : (Math.sign(prevX - s.x) || 1);
      state.x += sign * (px + PUSH_EPSILON);
    } else {
      const sign = dy !== 0 ? Math.sign(dy) : (Math.sign(prevY - s.y) || 1);
      state.y += sign * (py + PUSH_EPSILON);
    }
    moved = true;
  }
  return moved;
}

// Maior sobreposição (em unidades, no eixo de menor penetração) com algum sólido; 0 sem colisão.
// Usada nas verificações.
export function solidOverlap(state, solids, playerRadius) {
  let worst = 0;
  for (const s of solids) {
    const r = s.radius + playerRadius;
    const px = r - Math.abs(state.x - s.x), py = r - Math.abs(state.y - s.y);
    if (px > 0 && py > 0) worst = Math.max(worst, Math.min(px, py));
  }
  return worst;
}
