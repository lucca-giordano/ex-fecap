import { settings } from '../core/Settings.js';

/**
 * Tabela única de mapeamento de ações, códigos físicos de teclas (event.code) e rótulos.
 * É a fonte de verdade para controles do jogo, lida pelo HUD e pelo painel de ajuda.
 */
export const ACTION_KEYS = Object.freeze({
    // Ações de jogo
    moveForward:      { code: 'KeyW',   label: 'W',      group: 'game',     desc: 'Mover para frente' },
    moveBackward:     { code: 'KeyS',   label: 'S',      group: 'game',     desc: 'Mover para trás' },
    strafeLeft:       { code: 'KeyA',   label: 'A',      group: 'game',     desc: 'Passo lateral esquerdo' },
    strafeRight:      { code: 'KeyD',   label: 'D',      group: 'game',     desc: 'Passo lateral direito' },
    flyUp:            { code: 'Space',  label: 'Espaço', group: 'game',     desc: 'Subir livremente' },
    flyDown:          { code: 'KeyC',   label: 'C',      group: 'game',     desc: 'Descer livremente' },
    toggleRun:        { code: 'KeyR',   label: 'R',      group: 'game',     desc: 'Alternar corrida (2x velocidade)' },
    toggleFullscreen: { code: 'KeyF',   label: 'F',      group: 'game',     desc: 'Alternar tela cheia' },
    toggleHelp:       { code: 'KeyH',   label: 'H',      group: 'game',     desc: 'Exibir / ocultar painel de ajuda' },

    // Configurações provisórias (substituídas por menu na Etapa 9)
    toggleTextured:   { code: 'Digit1', label: '1',      group: 'settings', desc: 'Alternar texturas / cores sólidas' },
    toggleSectorColors: { code: 'Digit2', label: '2',    group: 'settings', desc: 'Alternar cores dos flats por setor' },
    toggleCulling:    { code: 'Digit3', label: '3',      group: 'settings', desc: 'Alternar Backface Culling' },
    toggleLighting:   { code: 'Digit4', label: '4',      group: 'settings', desc: 'Alternar iluminação (COLORMAP)' },
    toggleSkyTest:    { code: 'Digit5', label: '5',      group: 'settings', desc: 'Alternar teste do céu em todos os tetos' },
    toggleCrt:        { code: 'Digit6', label: '6',      group: 'settings', desc: 'Alternar pós-processamento CRT' },
    toggleVisualMode: { code: 'Digit7', label: '7',      group: 'settings', desc: 'Alternar modo visual (Retro 4:3 / Moderno)' },
    toggleHud:        { code: 'Digit0', label: '0',      group: 'settings', desc: 'Exibir / ocultar HUD' },
    particles:        { code: 'KeyP',   label: 'P',      group: 'settings', desc: 'Alternar partículas (poeira e brasas)' },
    sprites:          { code: 'KeyO',   label: 'O',      group: 'settings', desc: 'Alternar sprites 3D dos objetos' },
    tuning:           { code: 'KeyT',   label: 'T',      group: 'settings', desc: 'Painel de calibragem de partículas' },
    decreaseSensitivity: { code: 'Comma',  label: ',',   group: 'settings', desc: 'Diminuir sensibilidade do mouse' },
    increaseSensitivity: { code: 'Period', label: '.',   group: 'settings', desc: 'Aumentar sensibilidade do mouse' },
    decreaseSpeed:    { code: 'Minus',  label: '-',      group: 'settings', desc: 'Diminuir velocidade de voo' },
    increaseSpeed:    { code: 'Equal',  label: '=',      group: 'settings', desc: 'Aumentar velocidade de voo' },
});

// Mapa reverso code -> ação para consulta rápida
const CODE_TO_ACTION = new Map();
for (const [actionName, def] of Object.entries(ACTION_KEYS)) {
    CODE_TO_ACTION.set(def.code, actionName);
}

/**
 * Gerenciador de entrada do usuário:
 * - Filtra modificadores do navegador (Ctrl, Alt, Meta) para evitar conflitos de atalhos.
 * - Gerencia Pointer Lock com solicitação de unadjustedMovement e fallback transparente.
 * - Normaliza vetor de movimento horizontal (movimento diagonal sem vantagem de velocidade).
 * - Limpa teclas em blur, visibilitychange e perda de lock.
 */
export class Controls {
    constructor() {
        this.canvas = null;
        this.camera = null;

        this.pressedKeys = new Set();
        this.isRunning = false;
        this.isHelpVisible = false;
        this.tuningMode = false;
        this.onToggleTuning = null;

        this.unadjustedMovementStatus = 'Não solicitado ainda (aguardando interação)';

        this.helpPanel = null;
    }

    /**
     * Inicializa o gerenciador de controles associando-o ao canvas e câmera.
     * @param {HTMLCanvasElement} canvas 
     * @param {import('../camera.js').Camera} camera 
     */
    attach(canvas, camera) {
        this.canvas = canvas;
        this.camera = camera;

        this._createHelpPanel();
        this._bindEvents();
    }

    /**
     * Gera dinamicamente o painel de ajuda a partir de ACTION_KEYS.
     * @private
     */
    _createHelpPanel() {
        const panel = document.createElement('div');
        panel.id = 'help-panel';
        panel.style.cssText = `
            display: none;
            position: absolute;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(18, 18, 24, 0.94);
            border: 1px solid #444;
            border-radius: 8px;
            padding: 16px 24px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 13px;
            color: #d1d5db;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7);
            z-index: 40;
            max-width: 600px;
            width: 90%;
            pointer-events: none;
            line-height: 1.6;
        `;

        const title = document.createElement('h2');
        title.style.cssText = 'font-size: 15px; margin-bottom: 10px; color: #e53935; text-transform: uppercase; letter-spacing: 1px; text-align: center;';
        title.innerHTML = 'Controles & Teclas de Atalho <span style="font-size:12px; color:#aaa; font-weight:normal;">(Pressione <strong style="color:#ffca28;">H</strong> para alternar)</span>';
        panel.appendChild(title);

        const grid = document.createElement('div');
        grid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 6px 16px;';

        for (const [, def] of Object.entries(ACTION_KEYS)) {
            const row = document.createElement('div');
            row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.06); padding: 2px 0;';

            const kbd = document.createElement('kbd');
            kbd.style.cssText = 'background: #2b2b2b; border: 1px solid #555; border-radius: 4px; padding: 1px 6px; font-family: monospace; font-size: 12px; color: #ffca28; min-width: 22px; text-align: center;';
            kbd.textContent = def.label;

            const desc = document.createElement('span');
            desc.style.cssText = 'margin-left: 8px; text-align: right; font-size: 12px; color: #bbb;';
            desc.textContent = def.desc;

            row.appendChild(kbd);
            row.appendChild(desc);
            grid.appendChild(row);
        }

        panel.appendChild(grid);
        document.getElementById('canvas-container')?.appendChild(panel);
        this.helpPanel = panel;
    }

    /**
     * Vincula os ouvintes de eventos de teclado, mouse, foco e visibilidade.
     * @private
     */
    _bindEvents() {
        window.addEventListener('keydown', (e) => this._handleKeyDown(e));
        window.addEventListener('keyup', (e) => this._handleKeyUp(e));

        // Limpeza de teclas para evitar câmera presa
        window.addEventListener('blur', () => this.clearKeys());
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.clearKeys();
        });

        document.addEventListener('pointerlockchange', () => {
            const isLocked = document.pointerLockElement === this.canvas;
            if (isLocked) {
                this._updateHelpVisibility();
            } else {
                this.clearKeys();
                this.isHelpVisible = false;
                this._updateHelpVisibility();
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (this.tuningMode) return;
            if (document.pointerLockElement !== this.canvas) return;

            // Ignora saltos espúrios de mouse (> 400 pixels em um único evento)
            if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;

            this.camera.handleMouseMove(e.movementX, e.movementY, settings.getMouseSensitivity());
        });
    }

    /**
     * Solicita o Pointer Lock solicitando unadjustedMovement com fallback.
     */
    async requestLock() {
        if (document.pointerLockElement === this.canvas) return;

        try {
            const promise = this.canvas.requestPointerLock({ unadjustedMovement: true });
            if (promise && typeof promise.then === 'function') {
                await promise.catch(() => {
                    this.unadjustedMovementStatus = 'Fallback utilizado (não suportado ou rejeitado)';
                    console.log('[Pointer Lock] unadjustedMovement rejeitado, acionando fallback padrão.');
                    return this.canvas.requestPointerLock();
                });
                if (this.unadjustedMovementStatus.startsWith('Não solicitado')) {
                    this.unadjustedMovementStatus = 'Aceito pelo navegador (entrada bruta sem aceleração)';
                    console.log('[Pointer Lock] unadjustedMovement aceito pelo navegador.');
                }
            } else {
                this.unadjustedMovementStatus = 'Aceito pelo navegador (execução síncrona)';
                console.log('[Pointer Lock] unadjustedMovement solicitado síncrono.');
            }
        } catch (err) {
            try {
                this.canvas.requestPointerLock();
                this.unadjustedMovementStatus = 'Fallback utilizado (exceção capturada)';
                console.log('[Pointer Lock] Exceção em unadjustedMovement, executando fallback:', err.message);
            } catch (fallbackErr) {
                console.warn('[Controls] Falha ao requisitar pointer lock:', fallbackErr.message);
                this.unadjustedMovementStatus = 'Falha no pointer lock';
            }
        }
    }

    /**
     * Limpa o estado de todas as teclas pressionadas.
     */
    clearKeys() {
        this.pressedKeys.clear();
    }

    /**
     * Alterna a visibilidade do painel de ajuda.
     */
    toggleHelp() {
        this.isHelpVisible = !this.isHelpVisible;
        this._updateHelpVisibility();
    }

    /**
     * Atualiza o estilo de exibição do painel de ajuda.
     * @private
     */
    _updateHelpVisibility() {
        if (this.helpPanel) {
            this.helpPanel.style.display = this.isHelpVisible ? 'block' : 'none';
        }
    }

    /**
     * Trata o evento keydown.
     * @param {KeyboardEvent} e 
     * @private
     */
    _handleKeyDown(e) {
        // Regra 2: Se Ctrl, Alt ou Meta estiverem ativos, não registra e não impede atalhos do navegador
        if (e.ctrlKey || e.altKey || e.metaKey) {
            return;
        }

        // Se o painel de calibragem estiver aberto
        if (this.tuningMode) {
            // Ignora teclas de jogo quando o foco está em inputs interativos
            if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) {
                if (e.code === 'Escape') {
                    e.preventDefault();
                    if (typeof this.onToggleTuning === 'function') {
                        this.onToggleTuning();
                    }
                }
                return;
            }

            if (e.code === 'KeyT' || e.code === 'Escape') {
                e.preventDefault();
                if (typeof this.onToggleTuning === 'function') {
                    this.onToggleTuning();
                }
                return;
            }

            const allowedInTuning = new Set([
                'KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space', 'KeyC', 'KeyR',
                'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'
            ]);

            if (allowedInTuning.has(e.code)) {
                e.preventDefault();
                this.pressedKeys.add(e.code);
                if (e.code === 'KeyR' && !e.repeat) {
                    this.isRunning = !this.isRunning;
                }
            }
            return;
        }

        // Tecla T fora do modo de calibragem pode acionar o painel
        if (e.code === 'KeyT') {
            if (typeof this.onToggleTuning === 'function') {
                e.preventDefault();
                this.onToggleTuning();
                return;
            }
        }

        // Se o menu estiver visível (cursor destravado), o jogo não processa entrada
        if (document.pointerLockElement !== this.canvas) {
            return;
        }

        const action = CODE_TO_ACTION.get(e.code);

        // Previne rolagem no Space e ações mapeadas do jogo
        if (e.code === 'Space' || action) {
            e.preventDefault();
        }

        // Ações de alternância ignoram repetição por tecla pressionada continuamente
        if (e.repeat) {
            if (action && this._isToggleAction(action)) {
                return;
            }
        }

        this.pressedKeys.add(e.code);

        if (action && !e.repeat) {
            this._triggerAction(action);
        }
    }

    /**
     * Trata o evento keyup.
     * @param {KeyboardEvent} e 
     * @private
     */
    _handleKeyUp(e) {
        this.pressedKeys.delete(e.code);
    }

    /**
     * Verifica se uma ação é do tipo alternância/disparo único.
     * @param {string} action 
     * @returns {boolean}
     * @private
     */
    _isToggleAction(action) {
        return action !== 'moveForward' &&
               action !== 'moveBackward' &&
               action !== 'strafeLeft' &&
               action !== 'strafeRight' &&
               action !== 'flyUp' &&
               action !== 'flyDown';
    }

    /**
     * Executa a ação correspondente à tecla pressionada.
     * @param {string} action 
     * @private
     */
    _triggerAction(action) {
        switch (action) {
            case 'toggleRun':
                this.isRunning = !this.isRunning;
                console.log(`[Controles] Corrida: ${this.isRunning ? 'LIGADA (2x velocidade)' : 'DESLIGADA (1x)'}`);
                break;
            case 'toggleFullscreen':
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(() => {});
                } else {
                    document.exitFullscreen().catch(() => {});
                }
                break;
            case 'toggleHelp':
                this.toggleHelp();
                break;
            case 'tuning':
                if (typeof this.onToggleTuning === 'function') {
                    this.onToggleTuning();
                }
                break;

            // Configurações provisórias delegadas ao Settings
            case 'toggleTextured':
                settings.toggle('textured');
                break;
            case 'toggleSectorColors':
                settings.toggle('sectorColors');
                break;
            case 'toggleCulling':
                settings.toggle('culling');
                break;
            case 'toggleLighting':
                settings.toggle('lighting');
                break;
            case 'toggleSkyTest':
                settings.toggle('skyTest');
                break;
            case 'toggleCrt':
                settings.toggle('crt');
                break;
            case 'toggleVisualMode':
                settings.toggle('visualMode');
                break;
            case 'toggleHud':
                settings.toggle('hud');
                break;
            case 'particles':
                settings.toggle('particles');
                break;
            case 'sprites':
                settings.toggle('sprites');
                break;
            case 'decreaseSensitivity':
                settings.stepLevel('mouseSensitivityLevel', -1);
                console.log(`[Controles] Nível de Sensibilidade: ${settings.get('mouseSensitivityLevel')}/10`);
                break;
            case 'increaseSensitivity':
                settings.stepLevel('mouseSensitivityLevel', 1);
                console.log(`[Controles] Nível de Sensibilidade: ${settings.get('mouseSensitivityLevel')}/10`);
                break;
            case 'decreaseSpeed':
                settings.stepLevel('flySpeedLevel', -1);
                console.log(`[Controles] Nível de Velocidade de Voo: ${settings.get('flySpeedLevel')}/10`);
                break;
            case 'increaseSpeed':
                settings.stepLevel('flySpeedLevel', 1);
                console.log(`[Controles] Nível de Velocidade de Voo: ${settings.get('flySpeedLevel')}/10`);
                break;
        }
    }

    /**
     * Atualiza o movimento da câmera com base no estado atual das teclas:
     * - Vetor horizontal normalizado (evita velocidade extra na diagonal).
     * - Escalonado pelo dt do frame com teto de 0.1s (evita saltos após aba em segundo plano).
     * - Multiplicador de 2x quando a corrida estiver ativada.
     * 
     * @param {number} dt Tempo decorrido em segundos
     */
    update(dt) {
        if (!this.camera) return;
        if (!this.tuningMode && document.pointerLockElement !== this.canvas) return;

        const safeDt = Math.min(dt, 0.1);

        // No modo de calibragem, setas giram a câmera a 90 graus por segundo
        if (this.tuningMode) {
            const rotSpeed = (90.0 * Math.PI) / 180.0;
            const maxPitch = (89.0 * Math.PI) / 180.0;

            if (this.pressedKeys.has('ArrowLeft')) {
                this.camera.yaw -= rotSpeed * safeDt;
            }
            if (this.pressedKeys.has('ArrowRight')) {
                this.camera.yaw += rotSpeed * safeDt;
            }
            if (this.pressedKeys.has('ArrowUp')) {
                this.camera.pitch = Math.min(maxPitch, this.camera.pitch + rotSpeed * safeDt);
            }
            if (this.pressedKeys.has('ArrowDown')) {
                this.camera.pitch = Math.max(-maxPitch, this.camera.pitch - rotSpeed * safeDt);
            }
        }

        const baseSpeed = settings.getFlySpeed();
        const currentSpeed = this.isRunning ? baseSpeed * 2.0 : baseSpeed;

        // Vetores direcionais relativos ao azimute da câmera no plano XZ
        const forwardX = Math.sin(this.camera.yaw);
        const forwardZ = -Math.cos(this.camera.yaw);
        const rightX = Math.cos(this.camera.yaw);
        const rightZ = Math.sin(this.camera.yaw);

        let moveX = 0.0;
        let moveZ = 0.0;

        if (this.pressedKeys.has('KeyW')) { moveX += forwardX; moveZ += forwardZ; }
        if (this.pressedKeys.has('KeyS')) { moveX -= forwardX; moveZ -= forwardZ; }
        if (this.pressedKeys.has('KeyD')) { moveX += rightX;   moveZ += rightZ; }
        if (this.pressedKeys.has('KeyA')) { moveX -= rightX;   moveZ -= rightZ; }

        // Normalização do vetor horizontal
        const len = Math.hypot(moveX, moveZ);
        if (len > 0.0001) {
            const step = (currentSpeed * safeDt) / len;
            this.camera.position[0] += moveX * step;
            this.camera.position[2] += moveZ * step;
        }

        // Movimento vertical livre: Space sobe (+Y), KeyC desce (-Y)
        if (this.pressedKeys.has('Space')) {
            this.camera.position[1] += currentSpeed * safeDt;
        }
        if (this.pressedKeys.has('KeyC')) {
            this.camera.position[1] -= currentSpeed * safeDt;
        }
    }
}

// Instância singleton central de controles
export const controls = new Controls();
