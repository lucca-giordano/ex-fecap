// Rosto da barra de status (etapa 19), na linha do ST_updateFaceWidget do Doom. Puro.
// Avança por tic de jogo; sorteios com gerador próprio de semente fixa (não o do combate).
//
// Prioridade: morto > sorriso (arma nova, 70 tics) > atacado com atacante (35 tics: OUCH se o golpe
// tirou mais de 20, senão KILL de frente, TR à direita, TL à esquerda) > dano sem atacante (35 tics:
// OUCH ou KILL) > godMode > reto (STFST{dor}{r}, r sorteado a cada 17 tics).

export const EVIL_TICS = 70;
export const HURT_TICS = 35;
export const STRAIGHT_TICS = 17;
export const MUCH_PAIN = 20;
export const FACE_RNG_SEED = 12345;

// Nível de dor 0..4 (ST_calcPainOffset): floor((100 - min(vida, 100)) * 5 / 101), vida >= 0.
export function painLevel(health) {
  const h = Math.min(Math.max(health, 0), 100);
  return Math.min(4, Math.max(0, Math.floor((100 - h) * 5 / 101)));
}

const norm180 = (a) => ((((a + 180) % 360) + 360) % 360) - 180;

export class FaceState {
  constructor(seed = FACE_RNG_SEED) {
    this.seed = seed;
    this.reset();
  }

  reset() {
    this.rngState = this.seed >>> 0;
    this.evilTics = 0;
    this.hurtTics = 0;
    this.hurtAmount = 0;
    this.attacker = null;
    this.straight = 1;
    this.straightTics = STRAIGHT_TICS;
    this.warned = new Set();
  }

  // LCG próprio: 0..2.
  roll3() {
    this.rngState = (Math.imul(this.rngState, 1103515245) + 12345) >>> 0;
    return (this.rngState >>> 16) % 3;
  }

  // Arma que o jogador ainda não tinha.
  onWeaponGained() {
    this.evilTics = EVIL_TICS;
  }

  // Dano aplicado à vida (depois da armadura); attacker { x, y } ou null.
  onDamage(amount, attacker) {
    this.hurtTics = HURT_TICS;
    this.hurtAmount = amount;
    this.attacker = attacker ? { x: attacker.x, y: attacker.y } : null;
  }

  tick() {
    if (this.evilTics > 0) this.evilTics--;
    if (this.hurtTics > 0) this.hurtTics--;
    if (--this.straightTics <= 0) {
      this.straight = this.roll3();
      this.straightTics = STRAIGHT_TICS;
    }
  }

  // Nome desejado (sem conferir lumps). player: { x, y, angle (graus do Doom) }.
  wanted(stats, player, godMode) {
    const p = painLevel(stats.health);
    if (stats.isDead) return 'STFDEAD0';
    if (this.evilTics > 0) return `STFEVL${p}`;
    if (this.hurtTics > 0) {
      if (this.hurtAmount > MUCH_PAIN) return `STFOUCH${p}`;
      if (!this.attacker) return `STFKILL${p}`;
      const toAttacker = Math.atan2(this.attacker.y - player.y, this.attacker.x - player.x) * 180 / Math.PI;
      const diff = norm180(toAttacker - player.angle);
      if (Math.abs(diff) < 45) return `STFKILL${p}`; // de frente
      return diff < 0 ? `STFTR${p}0` : `STFTL${p}0`;  // ângulo menor = à direita (anti-horário)
    }
    if (godMode) return 'STFGOD0';
    return `STFST${p}${this.straight}`;
  }

  // Nome do lump a desenhar: o desejado, ou STFST{dor}1 se ele faltar (aviso uma vez por nome).
  lump(stats, player, godMode, patches) {
    const name = this.wanted(stats, player, godMode);
    if (patches[name]) return name;
    if (!this.warned.has(name)) {
      this.warned.add(name);
      console.warn(`Rosto: lump ${name} ausente; usando o rosto reto`);
    }
    return `STFST${painLevel(stats.health)}1`;
  }
}
