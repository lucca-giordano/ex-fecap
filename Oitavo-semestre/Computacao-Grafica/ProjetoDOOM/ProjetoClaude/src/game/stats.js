// Contadores de combate. Puro.
// totalMonsters: monstros do mapa (sem barris), já filtrados pela dificuldade.
// hits: tiros que atingiram monstro ou barril.

export class CombatStats {
  constructor(totalMonsters = 0) {
    this.totalMonsters = totalMonsters;
    this.reset();
  }

  reset() {
    this.kills = 0;
    this.shots = 0;
    this.hits = 0;
  }
}
