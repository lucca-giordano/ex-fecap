// Estado e navegação do menu. Lógica pura: sem DOM e sem WebGPU.
// As configurações são alteradas só por settings.set / settings.toggle; o menu não guarda cópia.

import { helpPages } from './helpPages.js';
import { MENU_TEXT, MENU_LANG } from './menuText.js';

// Itens de cada tela (tipo e configuração ligada). O desenho de cada tela fica em composeMenu.
//   action: executa algo; submenu: abre `target`; toggle: alterna `setting`;
//   thermo: nível de `setting` entre `min` e `max` (padrão 1..10), com `cells` células (padrão 10);
//   fullscreen: alterna a tela cheia do documento.
export const SCREENS = {
  main: {
    parent: null,
    items: [
      { id: 'newGame', type: 'action' },
      { id: 'options', type: 'submenu', target: 'options' },
      { id: 'readThis', type: 'submenu', target: 'help' },
    ],
  },
  options: {
    parent: 'main',
    items: [
      { id: 'visualMode', type: 'toggle', setting: 'visualMode' },
      { id: 'crt', type: 'toggle', setting: 'crt' },
      { id: 'lighting', type: 'toggle', setting: 'lighting' },
      { id: 'fullscreen', type: 'fullscreen' },
      // Etapa 14: volume dos efeitos, 0 a 15 (como o S_SetSfxVolume do Doom), termômetro de 16 células.
      { id: 'sfxVolumeLevel', type: 'thermo', setting: 'sfxVolumeLevel', min: 0, max: 15, cells: 16 },
      { id: 'mouseSensitivityLevel', type: 'thermo', setting: 'mouseSensitivityLevel' },
      { id: 'flySpeedLevel', type: 'thermo', setting: 'flySpeedLevel' },
      { id: 'extras', type: 'submenu', target: 'extras' },
      { id: 'debug', type: 'submenu', target: 'debug' },
    ],
  },
  // Etapa 14: itens que saíram das opções para caber o SFX VOLUME, com o mesmo comportamento.
  extras: {
    parent: 'options',
    items: [
      { id: 'particles', type: 'toggle', setting: 'particles' },
      { id: 'sprites', type: 'toggle', setting: 'sprites' },
      { id: 'moveMode', type: 'toggle', setting: 'moveMode' },
      { id: 'screenFlashes', type: 'toggle', setting: 'screenFlashes' }, // etapa 19
      { id: 'particleTuning', type: 'action' },
    ],
  },
  debug: {
    parent: 'options',
    items: [
      { id: 'textured', type: 'toggle', setting: 'textured' },
      { id: 'sectorColors', type: 'toggle', setting: 'sectorColors' },
      { id: 'culling', type: 'toggle', setting: 'culling' },
      { id: 'skyTest', type: 'toggle', setting: 'skyTest' },
      { id: 'hud', type: 'toggle', setting: 'hud' },
      { id: 'reset', type: 'action' },
      { id: 'gameDebug', type: 'submenu', target: 'gameDebug' }, // etapa 15
      { id: 'monsterDebug', type: 'submenu', target: 'monsterDebug' }, // etapa 18
    ],
  },
  // Etapa 15: ações sobre o estado do jogo (antes no DEBUG) e sobre os monstros.
  gameDebug: {
    parent: 'debug',
    items: [
      { id: 'healthUp', type: 'action', stats: true },
      // Etapa 19: dano pela regra do jogo (armadura incluída), modo deus e morte.
      { id: 'damage10', type: 'action', stats: true },
      { id: 'damage25', type: 'action', stats: true },
      { id: 'godMode', type: 'toggle', setting: 'godMode' },
      { id: 'killPlayer', type: 'action', stats: true },
      { id: 'armorUp', type: 'action', stats: true },
      { id: 'ammoUp', type: 'action', stats: true },
      { id: 'resetStats', type: 'action', stats: true },
      { id: 'giveKeys', type: 'action', stats: true },    // etapa 16
      { id: 'giveWeapons', type: 'action', stats: true }, // etapa 16
      { id: 'giveAmmo', type: 'action', stats: true },    // etapa 17
    ],
  },
  // Etapa 18: IA dos monstros (RESET MONSTERS e KILL ALL MONSTERS vieram do GAME DEBUG).
  monsterDebug: {
    parent: 'debug',
    items: [
      { id: 'monsterAI', type: 'toggle', setting: 'monsterAI' },
      { id: 'noTarget', type: 'toggle', setting: 'noTarget' },
      { id: 'resetMonsters', type: 'action', stats: true },
      { id: 'killAll', type: 'action', stats: true },
    ],
  },
  help: { parent: 'main', items: [] },
};

// Teclas do menu (event.code). Nenhuma usa modificadores.
const MENU_KEYS = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Enter: 'enter', NumpadEnter: 'enter',
  Escape: 'back', Backspace: 'back',
};

// Faixa padrão dos termômetros (sensibilidade e velocidade).
export const LEVEL_MIN = 1;
export const LEVEL_MAX = 10;

// Sons do menu, como o m_menu.c do Doom.
export const MENU_SOUNDS = {
  move: 'pstop',     // cursor para cima ou para baixo
  change: 'stnmov',  // mudar um valor (termômetro ou alternância)
  confirm: 'pistol', // Enter numa ação ou num submenu
  back: 'swtchn',    // voltar uma tela; também ao abrir o menu com o jogo começado
  close: 'swtchx',   // fechar o menu para retomar o jogo (tocado pelo main ao recuperar o mouse)
};

export class Menu {
  // callbacks: { newGame(), resume(), toggleFullscreen(), isFullscreen(), openTuning(), statsAction(id),
  //   onSound(nome) (opcional) }
  constructor(settings, callbacks) {
    this.settings = settings;
    this.cb = callbacks;
    this.sound = callbacks.onSound ?? (() => {});
    this.screen = 'main';
    this.selected = { main: 0, options: 0, extras: 0, debug: 0, gameDebug: 0, monsterDebug: 0, help: 0 }; // último item de cada tela
    this.started = false;
    this.resumeFailed = false;
    this.helpPage = 0; // página da tela READ THIS! (etapa 17)
    this.dirty = true;
    settings.subscribe('*', () => { this.dirty = true; });
  }

  // Abre o menu na tela principal (ao perder o pointer lock). Com o jogo começado, toca "swtchn",
  // exceto com { silent: true } (quando o menu não vai aparecer, como ao abrir a calibragem).
  open({ silent = false } = {}) {
    this.screen = 'main';
    this.dirty = true;
    if (this.started && !silent) this.sound(MENU_SOUNDS.back);
  }

  setResumeFailed(value) {
    if (this.resumeFailed !== value) {
      this.resumeFailed = value;
      this.dirty = true;
    }
  }

  get currentItem() {
    return SCREENS[this.screen].items[this.selected[this.screen]];
  }

  // Devolve true se a tecla foi consumida pelo menu.
  handleKey(e) {
    if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return false; // atalhos do navegador
    const key = MENU_KEYS[e.code];
    if (!key) return false;
    if ((key === 'enter' || key === 'back') && e.repeat) return true; // consome, mas não repete

    const screen = SCREENS[this.screen];
    const item = this.currentItem;
    const n = screen.items.length;

    switch (key) {
      case 'up':
      case 'down':
        // Volta ao início e ao fim, como no original.
        if (n > 0) {
          this.selected[this.screen] = (this.selected[this.screen] + (key === 'up' ? n - 1 : 1)) % n;
          this.sound(MENU_SOUNDS.move);
        }
        break;
      case 'left':
      case 'right':
        if (this.screen === 'help') { this.turnHelpPage(key === 'left' ? -1 : 1); break; }
        if (!item) break;
        if (item.type === 'thermo') {
          // Termômetro: limite nas pontas, sem volta.
          const min = item.min ?? LEVEL_MIN, max = item.max ?? LEVEL_MAX;
          const level = this.settings.get(item.setting) + (key === 'left' ? -1 : 1);
          this.settings.set(item.setting, Math.min(max, Math.max(min, level)));
          this.sound(MENU_SOUNDS.change);
        } else if (item.type === 'toggle') {
          this.settings.toggle(item.setting);
          this.sound(MENU_SOUNDS.change);
        } else if (item.type === 'fullscreen') {
          this.cb.toggleFullscreen();
          this.sound(MENU_SOUNDS.change);
        }
        break;
      case 'enter':
        // Ajuda: Enter vai para a próxima página; na última, volta.
        if (this.screen === 'help') {
          if (this.helpPage + 1 < this.helpPageCount()) this.turnHelpPage(1);
          else this.back();
          break;
        }
        if (item) this.activate(item);
        break;
      case 'back':
        this.back();
        break;
    }
    this.dirty = true;
    return true;
  }

  activate(item) {
    switch (item.type) {
      case 'toggle':
        this.settings.toggle(item.setting);
        this.sound(MENU_SOUNDS.change);
        break;
      case 'fullscreen':
        this.cb.toggleFullscreen();
        this.sound(MENU_SOUNDS.change);
        break;
      case 'submenu':
        this.screen = item.target;
        if (item.target === 'help') this.helpPage = 0;
        this.sound(MENU_SOUNDS.confirm);
        break;
      case 'action':
        this.sound(MENU_SOUNDS.confirm);
        if (item.id === 'newGame') {
          this.started = true;
          this.cb.newGame(); // pede o pointer lock dentro do handler do teclado (gesto do usuário)
        } else if (item.id === 'reset') {
          this.settings.reset();
        } else if (item.stats) {
          this.cb.statsAction(item.id);
        } else if (item.id === 'particleTuning') {
          this.cb.openTuning(); // só funciona com o jogo iniciado (o main decide)
        }
        break;
    }
  }

  helpPageCount() {
    return helpPages(MENU_TEXT[MENU_LANG]).length;
  }

  // Muda de página da ajuda, parando nas pontas.
  turnHelpPage(delta) {
    const next = Math.min(this.helpPageCount() - 1, Math.max(0, this.helpPage + delta));
    if (next !== this.helpPage) {
      this.helpPage = next;
      this.sound(MENU_SOUNDS.move);
    }
  }

  back() {
    const parent = SCREENS[this.screen].parent;
    if (parent) {
      this.screen = parent;
      this.sound(MENU_SOUNDS.back);
    } else if (this.started) {
      this.cb.resume(); // raiz: tenta voltar ao jogo ("swtchx" toca quando o mouse volta, no main)
    }
  }

  // Dados que composeMenu precisa para desenhar a tela atual.
  snapshot() {
    const s = this.settings;
    return {
      screen: this.screen,
      selected: this.selected[this.screen],
      helpPage: this.helpPage,
      started: this.started,
      resumeFailed: this.resumeFailed,
      values: {
        visualMode: s.get('visualMode'),
        crt: s.get('crt'),
        lighting: s.get('lighting'),
        fullscreen: this.cb.isFullscreen(),
        sfxVolumeLevel: s.get('sfxVolumeLevel'),
        mouseSensitivityLevel: s.get('mouseSensitivityLevel'),
        flySpeedLevel: s.get('flySpeedLevel'),
        textured: s.get('textured'),
        sectorColors: s.get('sectorColors'),
        culling: s.get('culling'),
        skyTest: s.get('skyTest'),
        hud: s.get('hud'),
        particles: s.get('particles'),
        sprites: s.get('sprites'),
        moveMode: s.get('moveMode'),
        monsterAI: s.get('monsterAI'),
        noTarget: s.get('noTarget'),
        screenFlashes: s.get('screenFlashes'),
        godMode: s.get('godMode'),
      },
    };
  }
}
