// Estado dos monstros e barris: vida, dor, morte, corpos e ações de quadro. Puro.
// Um objeto por THING atirável do mapa (já filtrado pela dificuldade). Avança por tic (35/s).
// Estados: stand (animação de parado da etapa 11), pain, die, xdie (morte esfacelada), dead.

export const TERMINAL = -1;

export class MonsterSystem {
  // objects: objetos do mapa ({ index, x, y, base: [wx, wy, wz] }, de buildSpriteScene);
  // entries: Map tipo -> entrada resolvida (resolveMonsterTable); typeOf(obj) -> número do tipo.
  // callbacks: { onSound(nome, monstro), onKill(monstro), onExplode(monstro) }; rng: Rng.
  constructor(objects, entries, typeOf, rng, callbacks = {}) {
    this.rng = rng;
    this.cb = callbacks;
    this.monsters = [];
    this.byObject = new Map();
    this.tickCount = 0; // tics já executados (ver tick())
    this.events = [];   // etapa 16: { type: 'died', monsterType, x, y, thingIndex }, lidos com takeEvents()
    for (const obj of objects) {
      const entry = entries.get(typeOf(obj));
      if (!entry) continue;
      const m = { thingIndex: obj.index, type: entry.type, entry, x: obj.x, y: obj.y, floorZ: obj.base[1] };
      this.monsters.push(m);
      this.byObject.set(obj.index, m);
    }
    this.reset();
  }

  get totalMonsters() {
    return this.monsters.filter((m) => m.entry.isMonster).length;
  }

  reset() {
    this.events = [];
    for (const m of this.monsters) {
      // died: tipo de morte ('die' ou 'xdie'), que decide os quadros do corpo em "dead".
      Object.assign(m, { health: m.entry.health, state: 'stand', frameIndex: 0, ticsLeft: 0, shootable: true, removed: false, died: null });
    }
  }

  framesOf(m) {
    if (m.state === 'pain') return m.entry.pain;
    if (m.state === 'xdie' || (m.state === 'dead' && m.died === 'xdie')) return m.entry.xdeath;
    if (m.state === 'die' || m.state === 'dead') return m.entry.death;
    return m.entry.idle;
  }

  // Prefixo e letra do quadro atual (null em "stand": a animação de parado vem da etapa 11).
  frameOf(m) {
    if (m.state === 'stand' || m.removed) return null;
    const dying = m.state !== 'pain';
    const deathPrefix = m.died === 'die' ? m.entry.deathPrefix : null;
    return {
      prefix: (dying && deathPrefix) || m.entry.prefix,
      letter: this.framesOf(m)[m.frameIndex][0],
      fullbright: Boolean(dying && m.died === 'die' && m.entry.deathFullbright),
    };
  }

  sound(list, m) {
    if (!list || list.length === 0) return;
    const name = list.length === 1 ? list[0] : list[this.rng.next255() % list.length];
    this.cb.onSound?.(name, m);
  }

  // Entra no quadro `index` do estado atual: duração, ações e fim da sequência.
  enterFrame(m, index) {
    const frames = this.framesOf(m);
    if (index >= frames.length) {
      if (m.state === 'pain') { m.state = 'stand'; m.frameIndex = 0; return; }
      // Fim de uma morte sem quadro terminal (alma perdida, barril): o objeto é removido.
      m.state = 'dead';
      m.removed = true;
      return;
    }
    m.frameIndex = index;
    const tics = frames[index][1];
    m.ticsLeft = tics === TERMINAL ? Infinity : tics;
    if (tics === TERMINAL) m.state = 'dead'; // corpo: permanece no último quadro
    const action = (m.state === 'die' || m.state === 'xdie' || m.state === 'dead') ? m.entry.deathActions?.[index] : null;
    if (action === 'explode') this.cb.onExplode?.(m);
  }

  kill(m, xdeath) {
    m.stateTic = this.tickCount; // começa a contar no próximo tic (ver tick())
    m.state = xdeath ? 'xdie' : 'die';
    m.died = m.state;
    m.shootable = false;
    if (xdeath) this.cb.onSound?.('slop', m);
    else this.sound(m.entry.sounds.death, m); // o primeiro quadro de morte toca o som de morte
    if (m.entry.isMonster) this.cb.onKill?.(m);
    // Uma vez por morte (normal, esfacelada ou por explosão): alimenta os itens largados.
    this.events.push({ type: 'died', monsterType: m.type, x: m.x, y: m.y, thingIndex: m.thingIndex });
    this.enterFrame(m, 0);
  }

  // Devolve e esvazia a fila de eventos.
  takeEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }

  // Dano: mortos e em morte não recebem. Vida <= 0 mata (esfacelado se vida < -vidaInicial e houver
  // quadros); senão, dor com chance painChance/256 (como P_DamageMobj).
  damage(m, amount) {
    if (!m.shootable || m.removed) return { killed: false, ignored: true };
    m.health -= amount;
    if (m.health <= 0) {
      this.kill(m, m.health < -m.entry.health && Boolean(m.entry.xdeath));
      return { killed: true };
    }
    if (m.entry.pain && this.rng.next255() < m.entry.painChance) {
      m.stateTic = this.tickCount;
      m.state = 'pain';
      this.sound(m.entry.sounds.pain, m);
      this.enterFrame(m, 0);
    }
    return { killed: false };
  }

  // Mata todos os monstros (sem barris), com a morte normal (depuração).
  killAll() {
    for (const m of this.monsters) {
      if (m.entry.isMonster && m.shootable) {
        m.health = 0;
        this.kill(m, false);
      }
    }
  }

  // Um tic de jogo. Um monstro que mudou de estado DURANTE este tic (morto ou ferido pela explosão de
  // outro que vem antes na lista) só começa a contar no tic seguinte, para a duração não depender da
  // ordem da lista: um barril morto por outro explode exatamente 10 tics depois.
  tick() {
    this.tickCount++;
    for (const m of this.monsters) {
      if (m.state === 'stand' || m.removed || m.ticsLeft === Infinity) continue;
      if (m.stateTic === this.tickCount) continue;
      if (--m.ticsLeft <= 0) this.enterFrame(m, m.frameIndex + 1);
    }
  }
}
