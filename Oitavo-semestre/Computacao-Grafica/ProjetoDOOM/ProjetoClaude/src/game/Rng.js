// Gerador pseudoaleatório com semente (mulberry32). Puro.
// NÃO é a tabela de 256 números do Doom (M_Random/P_Random): os resultados não reproduzem o original,
// só a distribuição (inteiros de 0 a 255). O jogo usa Date.now() como semente; os testes, semente fixa.

export class Rng {
  constructor(seed = Date.now()) {
    this.state = seed >>> 0;
  }

  // Próximo inteiro de 32 bits sem sinal (mulberry32).
  nextUint32() {
    this.state = (this.state + 0x6D2B79F5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  next255() { return this.nextUint32() & 255; }               // inteiro de 0 a 255
  nextFloat() { return this.nextUint32() / 0x100000000; }      // [0, 1)
  nextRange(a, b) { return a + (b - a) * this.nextFloat(); }   // [a, b)
}
