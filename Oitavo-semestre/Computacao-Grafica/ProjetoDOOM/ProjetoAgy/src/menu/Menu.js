import { settings } from '../core/Settings.js';

/**
 * Quantidade de itens em cada tela para controle de navegação e wrap-around.
 */
const SCREEN_ITEM_COUNTS = {
    main: 3,     // 0: NEW GAME, 1: OPTIONS, 2: READ THIS!
    options: 10, // 0: VISUAL, 1: CRT, 2: LIGHTING, 3: PARTICLES, 4: SPRITES, 5: FULLSCREEN, 6: SENSITIVITY, 7: FLY SPEED, 8: TUNING, 9: DEBUG
    debug: 6,    // 0: TEXTURES, 1: SECTOR COLORS, 2: CULLING, 3: SKY TEST, 4: HUD, 5: RESET DEFAULTS
    help: 0,     // Sem itens selecionáveis
};

/**
 * Gerenciador de estado, navegação e ações do menu estilo Doom.
 * Lógica pura desacoplada do DOM e da WebGPU.
 */
export class Menu {
    /**
     * @param {Object} [callbacks={}]
     * @param {Function} [callbacks.onNewGame]
     * @param {Function} [callbacks.onResume]
     * @param {Function} [callbacks.onToggleFullscreen]
     */
    constructor(callbacks = {}) {
        this.currentScreen = 'main';
        this.selectedItem = {
            main: 0,
            options: 0,
            debug: 0,
            help: 0,
        };

        this.started = false;
        this.resumeFailed = false;
        this.dirty = true;
        this.lastSkullIdx = 0;

        this.onNewGame = callbacks.onNewGame || (() => {});
        this.onResume = callbacks.onResume || (() => {});
        this.onToggleFullscreen = callbacks.onToggleFullscreen || (() => {});
        this.onOpenTuning = callbacks.onOpenTuning || (() => {});

        // Inscreve-se em todas as alterações de configurações para marcar imagem suja
        settings.subscribe('*', () => {
            this.dirty = true;
        });
    }

    /**
     * Retorna o estado atual completo para a função de composição de imagem.
     * @returns {Object}
     */
    getState() {
        return {
            currentScreen: this.currentScreen,
            selectedItem: { ...this.selectedItem },
            started: this.started,
            resumeFailed: this.resumeFailed,
            settings: {
                visualMode: settings.get('visualMode'),
                crt: settings.get('crt'),
                lighting: settings.get('lighting'),
                particles: settings.get('particles'),
                particleDensity: settings.get('particleDensity'),
                sprites: settings.get('sprites'),
                textured: settings.get('textured'),
                sectorColors: settings.get('sectorColors'),
                culling: settings.get('culling'),
                skyTest: settings.get('skyTest'),
                hud: settings.get('hud'),
                mouseSensitivityLevel: settings.get('mouseSensitivityLevel'),
                flySpeedLevel: settings.get('flySpeedLevel'),
            },
            isFullscreen: (typeof document !== 'undefined') ? Boolean(document.fullscreenElement) : false,
        };
    }

    /**
     * Atualiza a animação da caveira com base no tempo decorrido.
     * Marca o menu como sujo apenas quando o quadro mudar.
     * @param {number} tempo Tempo em segundos
     */
    update(tempo) {
        const skullIdx = Math.floor((tempo * 35.0) / 8.0) % 2;
        if (skullIdx !== this.lastSkullIdx) {
            this.lastSkullIdx = skullIdx;
            this.dirty = true;
        }
    }

    /**
     * Processa eventos de teclado para navegação no menu.
     * Retorna true se a tecla foi consumida pelo menu.
     * 
     * @param {KeyboardEvent} e 
     * @returns {boolean}
     */
    handleKeyDown(e) {
        // Ignora eventos com modificadores para preservar atalhos nativos do navegador
        if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) {
            return false;
        }

        const code = e.code;

        // 1. Navegação Vertical: Cima / Baixo (com wrap-around)
        if (code === 'ArrowUp' || code === 'KeyW') {
            this._navigateVertical(-1);
            return true;
        }
        if (code === 'ArrowDown' || code === 'KeyS') {
            this._navigateVertical(1);
            return true;
        }

        // 2. Navegação Horizontal: Esquerda / Direita (termômetros e alternâncias)
        if (code === 'ArrowLeft' || code === 'KeyA') {
            this._navigateHorizontal(-1);
            return true;
        }
        if (code === 'ArrowRight' || code === 'KeyD') {
            this._navigateHorizontal(1);
            return true;
        }

        // 3. Confirmação / Ação: Enter
        if (code === 'Enter' || code === 'NumpadEnter') {
            if (e.repeat) return true; // Ignora repetição no Enter
            this._activateItem();
            return true;
        }

        // 4. Retorno: Esc ou Backspace
        if (code === 'Escape' || code === 'Backspace') {
            if (e.repeat) return true;
            this._goBack();
            return true;
        }

        return false;
    }

    /**
     * Move a seleção verticalmente na tela atual com wrap-around.
     * @param {number} delta -1 ou +1
     * @private
     */
    _navigateVertical(delta) {
        const count = SCREEN_ITEM_COUNTS[this.currentScreen] || 0;
        if (count <= 1) return;

        let current = this.selectedItem[this.currentScreen] || 0;
        current = (current + delta + count) % count;
        this.selectedItem[this.currentScreen] = current;
        this.dirty = true;
    }

    /**
     * Modifica o item selecionado horizontalmente (valores e termômetros).
     * @param {number} delta -1 ou +1
     * @private
     */
    _navigateHorizontal(delta) {
        if (this.currentScreen === 'options') {
            const item = this.selectedItem.options;
            switch (item) {
                case 0: // VISUAL
                    settings.toggle('visualMode');
                    this.dirty = true;
                    break;
                case 1: // CRT
                    settings.toggle('crt');
                    this.dirty = true;
                    break;
                case 2: // LIGHTING
                    settings.toggle('lighting');
                    this.dirty = true;
                    break;
                case 3: // PARTICLES
                    settings.toggle('particles');
                    this.dirty = true;
                    break;
                case 4: // SPRITES
                    settings.toggle('sprites');
                    this.dirty = true;
                    break;
                case 5: // FULLSCREEN
                    this.onToggleFullscreen();
                    this.dirty = true;
                    break;
                case 6: // MOUSE SENSITIVITY (limite nas pontas, sem wrap)
                    settings.stepLevel('mouseSensitivityLevel', delta);
                    this.dirty = true;
                    break;
                case 7: // FLY SPEED (limite nas pontas, sem wrap)
                    settings.stepLevel('flySpeedLevel', delta);
                    this.dirty = true;
                    break;
                case 8: // PARTICLE TUNING (ação direta, não altera por setas)
                    break;
                case 9: // DEBUG (ação direta)
                    break;
            }
        } else if (this.currentScreen === 'debug') {
            const item = this.selectedItem.debug;
            switch (item) {
                case 0: settings.toggle('textured'); this.dirty = true; break;
                case 1: settings.toggle('sectorColors'); this.dirty = true; break;
                case 2: settings.toggle('culling'); this.dirty = true; break;
                case 3: settings.toggle('skyTest'); this.dirty = true; break;
                case 4: settings.toggle('hud'); this.dirty = true; break;
            }
        }
    }

    /**
     * Ativa o item selecionado (Enter).
     * @private
     */
    _activateItem() {
        if (this.currentScreen === 'main') {
            const item = this.selectedItem.main;
            if (item === 0) {
                // NEW GAME: reposiciona spawn e inicia o jogo com bloqueio de cursor
                this.started = true;
                this.resumeFailed = false;
                this.onNewGame();
            } else if (item === 1) {
                // OPTIONS
                this.currentScreen = 'options';
                this.dirty = true;
            } else if (item === 2) {
                // READ THIS!
                this.currentScreen = 'help';
                this.dirty = true;
            }
        } else if (this.currentScreen === 'options') {
            const item = this.selectedItem.options;
            if (item === 8) {
                // PARTICLE TUNING: abre o painel HTML de calibragem
                this.onOpenTuning();
            } else if (item === 9) {
                // DEBUG (abre submenu)
                this.currentScreen = 'debug';
                this.dirty = true;
            } else {
                // Itens de alternância / termômetros
                this._navigateHorizontal(1);
            }
        } else if (this.currentScreen === 'debug') {
            const item = this.selectedItem.debug;
            if (item === 5) {
                // RESET DEFAULTS
                settings.reset();
                this.dirty = true;
            } else {
                this._navigateHorizontal(1);
            }
        } else if (this.currentScreen === 'help') {
            // Enter retorna ao menu principal
            this.currentScreen = 'main';
            this.dirty = true;
        }
    }

    /**
     * Retorna à tela anterior (Esc ou Backspace).
     * @private
     */
    _goBack() {
        if (this.currentScreen === 'help' || this.currentScreen === 'options') {
            this.currentScreen = 'main';
            this.dirty = true;
        } else if (this.currentScreen === 'debug') {
            this.currentScreen = 'options';
            this.dirty = true;
        } else if (this.currentScreen === 'main') {
            // Na tela raiz: se o jogo já iniciou, tenta voltar ao jogo solicitando lock
            if (this.started) {
                this.onResume();
            }
        }
    }
}
