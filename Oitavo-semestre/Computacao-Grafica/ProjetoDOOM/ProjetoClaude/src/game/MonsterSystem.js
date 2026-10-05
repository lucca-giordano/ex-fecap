// Estado dos monstros e barris: vida, dor, morte, corpos, ações de quadro e (etapa 18) IA. Puro.
// Um objeto por THING atirável do mapa (já filtrado pela dificuldade). Avança por tic (35/s).
// Estados: stand (parado), chase (corrida), melee e missile (ataques), pain, die, xdie (morte
// esfacelada), dead. Sem IA (tipo sem tabela, ou IA desligada), "stand" é a animação da etapa 11.

import { NODIR, REACTION_TIME } from './aiTable.js';
import { SARG_TYPES, RESPAWN_TICS, RESPAWN_CHANCE, RESPAWN_REACTION } from './skill.js';

export const TERMINAL = -1;
export const MTF_AMBUSH = 0x0008;

export class MonsterSystem {
  // objects: objetos do mapa ({ index, x, y, angle, flags, base: [wx, wy, wz] }, de buildSpriteScene);
  // entries: Map tipo -> entrada resolvida (resolveMonsterTable); typeOf(obj) -> número do tipo.
  // callbacks: { onSound(nome, monstro), onKill(monstro), onExplode(monstro), skillParams (etapa 23, opcional),
  //   canRespawn(monstro) e onRespawn(monstro, { x, y }) (Nightmare) }; rng: Rng.
  constructor(objects, entries, typeOf, rng, callbacks = {}) {
    this.rng = rng;
    this.cb = callbacks;
    this.monsters = [];
    this.byObject = new Map();
    this.tickCount = 0; // tics já executados (ver tick())
    // Fila de eventos lida com takeEvents(): 'died' (etapa 16) e, da IA, 'woke', 'attack',
    // 'playerDamaged' e 'pain'.
    this.events = [];
    this.ai = null;          // MonsterAI ligado por attach() (etapa 18)
    this.aiEnabled = true;   // settings.monsterAI
    this.skill = callbacks.skillParams ?? null; // etapa 23
    this.respawns = 0;       // etapa 23: monstros que voltaram (Nightmare)
    for (const obj of objects) {
      const entry = entries.get(typeOf(obj));
      if (!entry) continue;
      const m = {
        thingIndex: obj.index, type: entry.type, entry, aiDef: entry.ai ?? null,
        spawn: { x: obj.x, y: obj.y, angle: obj.angle ?? 0, floorZ: obj.base[1] },
        ambushFlag: ((obj.flags ?? 0) & MTF_AMBUSH) !== 0,
      };
      this.monsters.push(m);
      this.byObject.set(obj.index, m);
    }
    this.reset();
  }

  get totalMonsters() {
    return this.monsters.filter((m) => m.entry.isMonster).length;
  }

  // IA ativa para este monstro: tipo com tabela, MonsterAI ligado e IA ligada.
  hasAI(m) {
    return Boolean(m.aiDef && this.ai && this.aiEnabled);
  }

  // Posições, ângulos, vida, estados e flags originais.
  reset() {
    this.events = [];
    for (const m of this.monsters) {
      // died: tipo de morte ('die' ou 'xdie'), que decide os quadros do corpo em "dead".
      Object.assign(m, {
        x: m.spawn.x, y: m.spawn.y, angle: m.spawn.angle, floorZ: m.spawn.floorZ,
        health: m.entry.health, state: 'stand', frameIndex: 0, shootable: true, removed: false, died: null,
        ticsLeft: m.aiDef ? m.aiDef.spawn[0][1] : 0, stateTic: -1,
        movedir: NODIR, movecount: 0, reactionTime: this.skill?.fast ? 0 : REACTION_TIME, target: null, // etapa 23
        justHit: false, justAttacked: false, ambush: m.ambushFlag, deadTics: 0,
      });
    }
    this.respawns = 0;
    this.ai?.reset();
  }

  // Liga ou desliga a IA (settings.monsterAI). Desligada: quem estava acordado volta a parado onde está.
  setAIEnabled(on) {
    this.aiEnabled = on;
    if (on) return;
    for (const m of this.monsters) {
      if (m.state === 'chase' || m.state === 'melee' || m.state === 'missile') {
        Object.assign(m, { state: 'stand', frameIndex: 0, ticsLeft: m.aiDef.spawn[0][1], target: null });
      }
    }
  }

  framesOf(m) {
    switch (m.state) {
      case 'pain': return m.entry.pain;
      case 'chase': return m.aiDef.see;
      case 'melee': return m.aiDef.melee;
      case 'missile': return m.aiDef.missile;
      case 'xdie': return m.entry.xdeath;
      case 'die': return m.entry.death;
      case 'dead': return m.died === 'xdie' ? m.entry.xdeath : m.entry.death;
      default: return this.hasAI(m) ? m.aiDef.spawn : m.entry.idle;
    }
  }

  // Prefixo e letra do quadro atual (null em "stand": a animação de parado vem da etapa 11).
  frameOf(m) {
    if (m.state === 'stand' || m.removed) return null;
    const dying = m.state === 'die' || m.state === 'xdie' || m.state === 'dead';
    const deathPrefix = m.died === 'die' ? m.entry.deathPrefix : null;
    const frame = this.framesOf(m)[m.frameIndex];
    return {
      prefix: (dying && deathPrefix) || m.entry.prefix,
      letter: frame[0],
      // Morte do barril (BEXP) e quadros de tiro marcados com brilho (POSS F, SPOS F).
      fullbright: Boolean(dying && m.died === 'die' && m.entry.deathFullbright) || Boolean(frame[3]),
    };
  }

  sound(list, m) {
    if (!list || list.length === 0) return;
    const name = list.length === 1 ? list[0] : list[this.rng.next255() % list.length];
    this.cb.onSound?.(name, m);
  }

  setState(m, state) {
    m.state = state;
    this.enterFrame(m, 0);
  }

  // Entra no quadro `index` do estado atual: duração, ações e fim da sequência. A ação do quadro roda
  // UMA vez, depois de definida a duração (como o P_SetMobjState do Doom).
  enterFrame(m, index) {
    const frames = this.framesOf(m);
    if (index >= frames.length) {
      // Fim da dor: corrida com IA (etapa 18), parado sem IA (etapa 15).
      if (m.state === 'pain') { this.setState(m, this.hasAI(m) ? 'chase' : 'stand'); return; }
      if (m.state === 'melee' || m.state === 'missile') { this.setState(m, 'chase'); return; }
      if (m.state === 'stand' || m.state === 'chase') {
        index = 0; // parado e corrida em laço
      } else {
        // Fim de uma morte sem quadro terminal (alma perdida, barril): o objeto é removido.
        m.state = 'dead';
        m.removed = true;
        return;
      }
    }
    m.frameIndex = index;
    let tics = frames[index][1];
    // Etapa 23 (Nightmare): corrida, ataque e dor do demônio e do espectro com metade dos tics.
    if (this.skill?.fast && tics > 1 && SARG_TYPES.has(m.type) && (m.state === 'chase' || m.state === 'melee' || m.state === 'pain')) tics >>= 1;
    m.ticsLeft = tics === TERMINAL ? Infinity : tics;
    if (tics === TERMINAL) m.state = 'dead'; // corpo: permanece no último quadro
    if (m.state === 'die' || m.state === 'xdie' || m.state === 'dead') {
      if (m.entry.deathActions?.[index] === 'explode') this.cb.onExplode?.(m);
      return;
    }
    // A_Pain no segundo quadro de dor (como no Doom).
    if (m.state === 'pain') {
      if (index === 1) {
        this.sound(m.entry.sounds.pain, m);
        if (m.aiDef) this.events.push({ type: 'pain', thingIndex: m.thingIndex });
      }
      return;
    }
    const action = frames[index][2];
    if (action && this.hasAI(m)) this.ai.action(m, action);
  }

  kill(m, xdeath) {
    m.stateTic = this.tickCount; // começa a contar no próximo tic (ver tick())
    m.state = xdeath ? 'xdie' : 'die';
    m.died = m.state;
    m.shootable = false;
    m.target = null;
    m.deadTics = 0; // etapa 23: tempo como corpo (Nightmare)
    if (xdeath) this.cb.onSound?.('slop', m);
    else this.sound(m.entry.sounds.death, m); // o primeiro quadro de morte toca o som de morte
    if (m.entry.isMonster) this.cb.onKill?.(m);
    // Uma vez por morte (normal, esfacelada ou por explosão): alimenta os itens largados, na posição atual.
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
  // quadros); senão, dor com chance painChance/256 (como P_DamageMobj). Com IA (etapa 18), todo dano
  // vem do jogador: zera reactionTime, marca o alvo e acorda quem estava parado (sem som de ver).
  damage(m, amount) {
    if (!m.shootable || m.removed) return { killed: false, ignored: true };
    m.health -= amount;
    if (m.health <= 0) {
      this.kill(m, m.health < -m.entry.health && Boolean(m.entry.xdeath));
      return { killed: true };
    }
    let pain = false;
    if (m.entry.pain && this.rng.next255() < m.entry.painChance) {
      m.stateTic = this.tickCount;
      this.setState(m, 'pain');
      pain = true;
    }
    if (this.hasAI(m)) {
      m.reactionTime = 0;
      m.target = 'player';
      if (pain) m.justHit = true;
      if (m.state === 'stand') {
        m.stateTic = this.tickCount;
        this.setState(m, 'chase');
      }
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

  // Etapa 23: P_NightmareRespawn. Corpo de monstro (não barril) há RESPAWN_TICS tics; testado quando
  // leveltime & 31 == 0 e P_Random <= 4; volta ao ponto de início se o lugar estiver livre, parado,
  // com reactionTime 18. Não conta de novo no total de monstros.
  respawnTick(m) {
    if (!this.skill?.respawn || !m.entry.isMonster) return;
    if (++m.deadTics < RESPAWN_TICS) return;
    if (this.tickCount & 31) return;
    if (this.rng.next255() > RESPAWN_CHANCE) return;
    if (this.cb.canRespawn && !this.cb.canRespawn(m)) return;
    const from = { x: m.x, y: m.y, floorZ: m.floorZ };
    Object.assign(m, {
      x: m.spawn.x, y: m.spawn.y, angle: m.spawn.angle, floorZ: m.spawn.floorZ,
      health: m.entry.health, state: 'stand', frameIndex: 0, shootable: true, removed: false, died: null,
      ticsLeft: m.aiDef ? m.aiDef.spawn[0][1] : 0, stateTic: this.tickCount,
      movedir: NODIR, movecount: 0, reactionTime: RESPAWN_REACTION, target: null,
      justHit: false, justAttacked: false, ambush: m.ambushFlag, deadTics: 0,
    });
    this.respawns++;
    this.ai?.placed?.(m);
    this.cb.onRespawn?.(m, from);
  }

  // Um tic de jogo, na ordem do índice do THING. Um monstro que mudou de estado DURANTE este tic
  // (morto ou ferido pela explosão de outro que vem antes na lista) só começa a contar no tic seguinte,
  // para a duração não depender da ordem da lista: um barril morto por outro explode exatamente 10
  // tics depois.
  tick() {
    this.tickCount++;
    for (const m of this.monsters) {
      if (m.ticsLeft === Infinity && !m.removed && m.state === 'dead') { this.respawnTick(m); continue; }
      if (m.removed || m.ticsLeft === Infinity) continue;
      if (m.state === 'stand' && !this.hasAI(m)) continue;
      if (m.stateTic === this.tickCount) continue;
      if (--m.ticsLeft <= 0) this.enterFrame(m, m.frameIndex + 1);
    }
  }
}
