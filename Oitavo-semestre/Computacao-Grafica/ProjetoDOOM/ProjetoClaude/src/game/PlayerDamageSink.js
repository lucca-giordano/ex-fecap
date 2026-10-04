// Destino do dano ao jogador (etapa 18): só CONTA, por tipo e por origem. A vida não muda nesta etapa.
// kind: 'hitscan' | 'melee' | 'explosion'; source: 'POSS', 'SPOS', 'TROO', 'SARG' ou 'BAR1'.

export class PlayerDamageSink {
  constructor() {
    this.reset();
  }

  reset() {
    this.byKind = { hitscan: 0, melee: 0, explosion: 0 };
    this.bySource = {};
    this.hits = 0;
  }

  onPlayerDamaged(amount, source, kind) {
    this.byKind[kind] = (this.byKind[kind] ?? 0) + amount;
    this.bySource[source] = (this.bySource[source] ?? 0) + amount;
    this.hits++;
  }
}
