// Canais de som (como o snd_channels do Doom). Puro: sem Web Audio.
// Regras de alocação:
//   1. origem não vazia já tocando em algum canal: reutiliza esse canal (o som anterior é cortado);
//   2. senão, o primeiro canal livre;
//   3. senão, rouba o canal mais antigo (simplificação: o Doom usa prioridade por som).
// Sons sem origem (menu) nunca substituem outros pela regra 1.

export const MAX_CHANNELS = 8;

export class ChannelManager {
  constructor(count = MAX_CHANNELS) {
    this.channels = Array.from({ length: count }, () => ({ busy: false, origin: null, seq: 0 }));
    this.seq = 0;
  }

  // Devolve { index, stop }: stop é o canal a parar antes de reutilizar (ou -1).
  alloc(origin) {
    let index = -1;
    let stop = -1;
    if (origin) {
      index = this.channels.findIndex((c) => c.busy && c.origin === origin);
      if (index >= 0) stop = index;
    }
    if (index < 0) index = this.channels.findIndex((c) => !c.busy);
    if (index < 0) {
      index = this.channels.reduce((old, c, i) => (c.seq < this.channels[old].seq ? i : old), 0);
      stop = index;
    }
    this.channels[index] = { busy: true, origin: origin || null, seq: ++this.seq };
    return { index, stop };
  }

  release(index) {
    if (this.channels[index]) this.channels[index] = { busy: false, origin: null, seq: 0 };
  }

  get active() {
    return this.channels.filter((c) => c.busy).length;
  }
}
