// Intermissão do Doom 1 (etapa 23), como o WI_updateStats / WI_updateShowNextLoc do wi_stuff.c. Puro.
// Fases: 'stats' (contagem de mortes, itens, segredos e tempo) e 'entering' (próximo mapa), que espera
// o jogador; done = true quando ele confirma (o main então carrega o próximo mapa).

export const TICRATE = 35;

// Porcentagem como o Doom: n * 100 / total, com total 0 tratado como 1 (WI_initVariables).
export const percent = (n, total) => Math.floor((n * 100) / Math.max(1, total));

const COUNTED = { 2: 'kills', 4: 'items', 6: 'secret' };

export class Intermission {
  // info: { episode, last, next (mapas 1 a 9), stats: levelStats() do nível que terminou, sound(nome) }.
  constructor(info) {
    this.info = info;
    this.phase = 'stats';
    this.spState = 1;         // sp_state: ímpar = pausa de 1 s; 2, 4, 6 contam; 8 tempo; 10 fim
    this.pause = TICRATE;     // cnt_pause
    this.bcnt = 0;            // tics desde o início (o "pistol" toca quando bcnt & 3 == 0)
    this.cnt = { kills: -1, items: -1, secret: -1, time: -1 }; // -1 = ainda não aparece
    const s = info.stats;
    this.target = { kills: percent(s.kills, s.totalKills), items: percent(s.items, s.totalItems),
      secret: percent(s.secrets, s.totalSecrets), time: Math.floor(s.tics / TICRATE) };
    this.accelerate = false;
    this.done = false;
  }

  // Fogo, uso, Enter, espaço ou clique (WI_checkForAccelerate: um pedido por pressionamento).
  press() {
    this.accelerate = true;
  }

  tick() {
    this.bcnt++;
    if (this.phase === 'stats') this.updateStats();
    else if (this.phase === 'entering' && this.accelerate) {
      // Diferença: o Doom troca sozinho depois de 4 s; aqui a tela espera o jogador.
      this.accelerate = false;
      this.done = true;
    }
  }

  updateStats() {
    const c = this.cnt, t = this.target, sound = (n) => this.info.sound?.(n);
    // Acelerar antes do fim: todos os valores finais de uma vez, com "barexp".
    if (this.accelerate && this.spState !== 10) {
      this.accelerate = false;
      Object.assign(c, t);
      sound('barexp');
      this.spState = 10;
      return;
    }
    const key = COUNTED[this.spState];
    if (key) {
      c[key] += 2;
      if (!(this.bcnt & 3)) sound('pistol');
      if (c[key] >= t[key]) { c[key] = t[key]; sound('barexp'); this.spState++; }
    } else if (this.spState === 8) {
      if (!(this.bcnt & 3)) sound('pistol');
      c.time += 3; // segundos por tic
      if (c.time >= t.time) { c.time = t.time; sound('barexp'); this.spState++; }
    } else if (this.spState === 10) {
      if (this.accelerate) {
        this.accelerate = false;
        sound('sgcock');
        this.phase = 'entering';
      }
    } else if (--this.pause === 0) {
      this.spState++;
      this.pause = TICRATE;
    }
  }
}
