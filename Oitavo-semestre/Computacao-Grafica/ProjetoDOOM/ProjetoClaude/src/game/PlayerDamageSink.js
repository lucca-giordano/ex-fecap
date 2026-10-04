// Contadores do dano ao jogador, por tipo e por origem (etapa 18). Desde a etapa 19, a vida muda em
// PlayerDamage.applyDamage; aqui fica o dano aplicado e o absorvido pela armadura, para o HUD de texto.
// kind: 'hitscan' | 'melee' | 'explosion' | 'debug'; source: 'POSS', 'SPOS', 'TROO', 'SARG' ou 'BAR1'.

export class PlayerDamageSink {
  constructor() {
    this.reset();
  }

  reset() {
    this.byKind = { hitscan: 0, melee: 0, explosion: 0 };
    this.bySource = {};
    this.hits = 0;
    this.absorbed = 0;
  }

  // absorbed: parte do golpe que a armadura segurou (etapa 19).
  onPlayerDamaged(amount, source, kind, absorbed = 0) {
    this.absorbed += absorbed;
    this.byKind[kind] = (this.byKind[kind] ?? 0) + amount;
    this.bySource[source] = (this.bySource[source] ?? 0) + amount;
    this.hits++;
  }
}
