// Entrada: teclado (por event.code, posição física da tecla) e mouse com pointer lock.
// O jogo não usa Shift, Ctrl nem Alt: são atalhos do navegador ou do sistema (Ctrl+W fecha a aba,
// Shift repetido abre as Teclas de Aderência do Windows, Alt ativa a barra de menus).

// ÚNICO lugar onde as teclas são definidas. HUD e painel de ajuda leem daqui.
// kind: 'hold' (vale enquanto segura), 'toggle' (alterna, ignora repetição), 'press' (ação, aceita repetição).
export const ACTION_KEYS = {
  forward: { code: 'KeyW', label: 'W', desc: 'andar para frente', kind: 'hold' },
  back: { code: 'KeyS', label: 'S', desc: 'andar para trás', kind: 'hold' },
  left: { code: 'KeyA', label: 'A', desc: 'andar para a esquerda', kind: 'hold' },
  right: { code: 'KeyD', label: 'D', desc: 'andar para a direita', kind: 'hold' },
  up: { code: 'Space', label: 'Espaço', desc: 'subir (só no modo voar)', kind: 'hold' },
  down: { code: 'KeyC', label: 'C', desc: 'descer (só no modo voar)', kind: 'hold' },
  run: { code: 'KeyR', label: 'R', desc: 'correr (liga/desliga)', kind: 'toggle' },
  fullscreen: { code: 'KeyF', label: 'F', desc: 'tela cheia', kind: 'toggle' },
  help: { code: 'KeyH', label: 'H', desc: 'ajuda', kind: 'toggle' },
  // Etapa 17: texturas, cor por setor, culling e teste do céu ficaram só no menu (DEBUG); os dígitos
  // 1 a 7 escolhem armas.
  lighting: { code: 'KeyL', label: 'L', desc: 'iluminação', kind: 'toggle' },
  crt: { code: 'KeyX', label: 'X', desc: 'efeito CRT', kind: 'toggle' },
  visualMode: { code: 'KeyV', label: 'V', desc: 'visual retro / moderno', kind: 'toggle' },
  hud: { code: 'Digit0', label: '0', desc: 'HUD', kind: 'toggle' },
  // group 'weapons': a tela READ THIS! e o painel de ajuda mostram os sete numa linha só.
  // 6 e 7 são aceitos, mas não trocam (armas não utilizáveis; o 5 é utilizável desde a etapa 21).
  weapon1: { code: 'Digit1', label: '1', desc: 'soco', kind: 'press', group: 'weapons', slot: 1 },
  weapon2: { code: 'Digit2', label: '2', desc: 'pistola', kind: 'press', group: 'weapons', slot: 2 },
  weapon3: { code: 'Digit3', label: '3', desc: 'espingarda', kind: 'press', group: 'weapons', slot: 3 },
  weapon4: { code: 'Digit4', label: '4', desc: 'metralhadora', kind: 'press', group: 'weapons', slot: 4 },
  weapon5: { code: 'Digit5', label: '5', desc: 'lança-foguetes', kind: 'press', group: 'weapons', slot: 5 }, // etapa 21
  weapon6: { code: 'Digit6', label: '6', desc: 'plasma (não utilizável)', kind: 'press', group: 'weapons', slot: 6 },
  weapon7: { code: 'Digit7', label: '7', desc: 'BFG (não utilizável)', kind: 'press', group: 'weapons', slot: 7 },
  // Roda do mouse: códigos 'WheelUp' e 'WheelDown' nunca vêm do teclado; tratados no evento wheel.
  weaponNext: { code: 'WheelUp', label: 'Roda do mouse', desc: 'próxima arma (para cima)', kind: 'press', group: 'wheel', wheel: -1 },
  weaponPrev: { code: 'WheelDown', label: 'Roda do mouse', desc: 'arma anterior (para baixo)', kind: 'press', group: 'wheel', wheel: 1 },
  sensDown: { code: 'Comma', label: ',', desc: 'sensibilidade do mouse -', kind: 'press' },
  sensUp: { code: 'Period', label: '.', desc: 'sensibilidade do mouse +', kind: 'press' },
  speedDown: { code: 'Minus', label: '-', desc: 'velocidade -', kind: 'press' },
  speedUp: { code: 'Equal', label: '=', desc: 'velocidade +', kind: 'press' },
  particles: { code: 'KeyP', label: 'P', desc: 'partículas', kind: 'toggle' },
  tuning: { code: 'KeyT', label: 'T', desc: 'painel de calibragem das partículas', kind: 'toggle' },
  sprites: { code: 'KeyO', label: 'O', desc: 'sprites dos objetos', kind: 'toggle' },
  toggleMoveMode: { code: 'KeyG', label: 'G', desc: 'andar / voar', kind: 'toggle' },
  fire: { code: 'KeyJ', label: 'J', desc: 'atirar', kind: 'hold' },
  // Entrada de mouse: o código 'Mouse0' nunca vem do teclado; o botão é tratado em mousedown/mouseup.
  fireMouse: { code: 'Mouse0', label: 'Mouse esquerdo', desc: 'atirar', kind: 'hold', mouseButton: 0 },
  toggleMute: { code: 'KeyM', label: 'M', desc: 'som ligado / mudo', kind: 'toggle' },
  // Etapa 19: "usar"; por enquanto só reinicia depois da morte (portas ainda não existem).
  use: { code: 'KeyE', label: 'E', desc: 'usar / reiniciar', kind: 'press' },
  // Etapa 22: automapa (dentro dele, F, G, + e -, 0 e as setas têm função própria).
  toggleAutomap: { code: 'Tab', label: 'Tab', desc: 'automapa', kind: 'toggle' },
  // Setas: giram a câmera só no modo de calibragem (o mouse fica livre para o painel).
  // group 'tuning': a tela READ THIS! mostra as quatro numa linha só.
  lookLeft: { code: 'ArrowLeft', label: '←', desc: 'girar à esquerda (calibragem)', kind: 'hold', group: 'tuning' },
  lookRight: { code: 'ArrowRight', label: '→', desc: 'girar à direita (calibragem)', kind: 'hold', group: 'tuning' },
  lookUp: { code: 'ArrowUp', label: '↑', desc: 'olhar para cima (calibragem)', kind: 'hold', group: 'tuning' },
  lookDown: { code: 'ArrowDown', label: '↓', desc: 'olhar para baixo (calibragem)', kind: 'hold', group: 'tuning' },
};

const ACTION_BY_CODE = new Map(Object.entries(ACTION_KEYS).map(([action, k]) => [k.code, action]));
const MAX_MOUSE_DELTA = 400; // picos espúrios de movementX/Y acima disso são ignorados

export const WHEEL_STEP = 100;        // deslocamento acumulado (deltaY em pixels) por troca de arma
export const WHEEL_MIN_INTERVAL = 120; // ms mínimos entre trocas (o trackpad não dispara uma sequência)
const WHEEL_LINE = 40;   // deltaMode 1 (linhas, ex.: Firefox): pixels por linha
const WHEEL_PAGE = 800;  // deltaMode 2 (páginas)

// Acumulador da roda. push devolve +1 (para cima: próxima arma), -1 (para baixo: anterior) ou 0.
// Dentro do intervalo mínimo, o deslocamento é descartado.
export class WheelStepper {
  constructor(step = WHEEL_STEP, minInterval = WHEEL_MIN_INTERVAL) {
    this.step = step;
    this.minInterval = minInterval;
    this.acc = 0;
    this.last = -Infinity;
  }

  push(deltaY, deltaMode, nowMs) {
    if (nowMs - this.last < this.minInterval) {
      this.acc = 0;
      return 0;
    }
    this.acc += deltaY * (deltaMode === 1 ? WHEEL_LINE : deltaMode === 2 ? WHEEL_PAGE : 1);
    if (Math.abs(this.acc) < this.step) return 0;
    const dir = this.acc < 0 ? 1 : -1; // deltaY negativo = roda para cima
    this.acc = 0;
    this.last = nowMs;
    return dir;
  }
}

export class Controls {
  // onAction(nome): chamada para ações 'toggle' e 'press' (exceto 'run', tratada aqui).
  // onLook(dx, dy): movimento do mouse em pixels, só com o pointer lock ativo.
  // onLockChange(travado): pointer lock ganho ou perdido.
  // onLockError(): pedido de pointer lock recusado (evento pointerlockerror ou promise rejeitada).
  // onClick(): clique no canvas sem o pointer lock (padrão: pedir o lock).
  // isBlocked(): true enquanto o menu está aberto; as teclas do jogo são ignoradas.
  // onKey(e) (etapa 22): chamado em toda tecla do jogo ANTES do despacho; devolvendo true, a tecla não
  // dispara ações de alternância nem de pressão (as de segurar, como andar, continuam).
  constructor(canvas, { onAction, onLook, onLockChange, onLockError, onClick, isBlocked, onKey }) {
    this.canvas = canvas;
    this.held = new Set(); // ações 'hold' pressionadas
    this.running = false;
    this.onAction = onAction;
    this.onLook = onLook;
    this.onLockChange = onLockChange;
    this.onLockError = onLockError;
    this.isBlocked = isBlocked;
    this.onKey = onKey;
    this.lockModeLogged = false;

    window.addEventListener('keydown', (e) => this.keyDown(e));
    window.addEventListener('keyup', (e) => {
      // keyup sempre processado (mesmo com modificadores), para liberar a tecla.
      const action = ACTION_BY_CODE.get(e.code);
      if (action) this.held.delete(action);
    });

    // Evita a câmera "presa" andando quando o foco sai da página.
    window.addEventListener('blur', () => this.clear());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.clear(); });

    canvas.addEventListener('click', () => {
      if (this.locked) return;
      if (onClick) onClick();
      else this.requestLock();
    });
    document.addEventListener('pointerlockchange', () => {
      if (!this.locked) this.clear();
      this.onLockChange?.(this.locked);
    });
    document.addEventListener('pointerlockerror', () => {
      console.warn('Pointer lock recusado pelo navegador');
      this.onLockError?.();
    });

    // Botões do mouse mapeados em ACTION_KEYS (mouseButton), só com o pointer lock ativo.
    // A perda do lock, blur e aba oculta limpam o estado (clear()).
    const mouseAction = (button) => Object.keys(ACTION_KEYS).find((a) => ACTION_KEYS[a].mouseButton === button);
    document.addEventListener('mousedown', (e) => {
      const action = mouseAction(e.button);
      if (action && this.locked) this.held.add(action);
    });
    document.addEventListener('mouseup', (e) => {
      const action = mouseAction(e.button);
      if (action) this.held.delete(action);
    });

    // Roda do mouse (etapa 17): só com o pointer lock ativo e o menu oculto; listener não passivo para
    // o preventDefault valer (a página não rola). O main ignora a ação se o jogo não começou.
    this.wheel = new WheelStepper();
    document.addEventListener('wheel', (e) => {
      if (!this.locked || this.isBlocked?.()) return;
      e.preventDefault();
      const dir = this.wheel.push(e.deltaY, e.deltaMode, e.timeStamp);
      if (dir !== 0) this.onAction?.(dir > 0 ? 'weaponNext' : 'weaponPrev');
    }, { passive: false });

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      if (Math.abs(e.movementX) > MAX_MOUSE_DELTA || Math.abs(e.movementY) > MAX_MOUSE_DELTA) return;
      this.onLook?.(e.movementX, e.movementY);
    });
  }

  get locked() {
    return document.pointerLockElement === this.canvas;
  }

  keyDown(e) {
    // Com Ctrl, Alt, Meta ou Shift a tecla é do navegador: não registra e não chama preventDefault.
    if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
    // Menu aberto: o jogo não recebe teclas (o menu trata e consome as dele).
    if (this.isBlocked?.()) return;
    // Seletor de cor do painel de calibragem com foco: a tecla é dele.
    if (e.target?.tagName === 'INPUT' && e.target.type === 'color') return;
    const consumed = this.onKey?.(e) === true; // códigos de trapaça em andamento
    const action = ACTION_BY_CODE.get(e.code);
    if (!action) return;
    e.preventDefault(); // Space não rola a página; demais teclas mapeadas foram tratadas pelo jogo

    const { kind } = ACTION_KEYS[action];
    if (kind === 'hold') {
      this.held.add(action);
      return;
    }
    if (consumed) return;
    if (kind === 'toggle' && e.repeat) return; // segurar não fica ligando e desligando
    if (action === 'run') {
      this.running = !this.running;
      return;
    }
    this.onAction?.(action);
  }

  clear() {
    this.held.clear();
  }

  // Entrada bruta (sem aceleração do sistema) quando suportada; senão, pointer lock simples.
  // Deve ser chamada dentro de um gesto do usuário (clique ou Enter). Devolve true se conseguiu.
  async requestLock() {
    let ok = true;
    try {
      await this.canvas.requestPointerLock({ unadjustedMovement: true });
      if (!this.lockModeLogged) console.log('Pointer lock: unadjustedMovement aceito');
    } catch (err) {
      if (!this.lockModeLogged) console.log(`Pointer lock: unadjustedMovement recusado (${err.name}), usando fallback`);
      try {
        await this.canvas.requestPointerLock();
      } catch (err2) {
        console.warn('Pointer lock falhou:', err2.message);
        ok = false;
        this.onLockError?.();
      }
    }
    this.lockModeLogged = true;
    return ok;
  }

  // Disparo pressionado (tecla J ou botão esquerdo).
  get firing() {
    return this.held.has('fire') || this.held.has('fireMouse');
  }

  // Rotação pelas setas: yaw (+ direita) e pitch (+ cima), em -1..1.
  lookVector() {
    const h = (a) => (this.held.has(a) ? 1 : 0);
    return { yaw: h('lookRight') - h('lookLeft'), pitch: h('lookUp') - h('lookDown') };
  }

  // Vetor de movimento: f (frente), s (direita), u (subida). f e s normalizados juntos, para a
  // diagonal não ser mais rápida que a linha reta; u é independente.
  moveVector() {
    const h = (a) => (this.held.has(a) ? 1 : 0);
    let f = h('forward') - h('back');
    let s = h('right') - h('left');
    const u = h('up') - h('down');
    const len = Math.hypot(f, s);
    if (len > 0) { f /= len; s /= len; }
    return { f, s, u };
  }
}
