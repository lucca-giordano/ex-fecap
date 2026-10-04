/**
 * Módulo central de configurações do Doom WebGPU.
 * Gerencia o estado único de opções de exibição, renderização e controles,
 * com persistência seletiva em localStorage e sistema reativo de subscrição.
 */

const STORAGE_KEY = 'doomgpu.settings.v1';

export const BASE_MOUSE_SENSITIVITY = 0.0022; // radianos por pixel
export const BASE_FLY_SPEED = 300.0;          // unidades Doom por segundo

export const DEFAULT_SETTINGS = Object.freeze({
    // Configurações persistidas
    visualMode: 'retro',          // 'retro' (4:3) ou 'moderno' (tela cheia)
    crt: true,                    // efeito de monitor de tubo CRT
    lighting: true,               // iluminação por setor com COLORMAP
    hud: true,                    // exibição do HUD em tempo real
    mouseSensitivityLevel: 5,     // nível inteiro de 1 a 10 (padrão 5)
    flySpeedLevel: 5,             // nível inteiro de 1 a 10 (padrão 5)
    particles: true,              // partículas de poeira e brasas (compute shader)
    sprites: true,                // sprites 2D dos objetos do mapa (THINGS)

    // Opções de depuração da sessão (não persistidas, voltam ao padrão ao recarregar)
    textured: true,               // true = texturas ativas, false = cores sólidas
    sectorColors: false,          // true = flats por setor, false = flats por textura
    culling: true,                // true = backface culling ativo, false = desativado
    skyTest: false,               // true = céu em todos os tetos, false = apenas F_SKY1
});

// Chaves que são salvas no armazenamento local
const PERSISTED_KEYS = new Set([
    'visualMode',
    'crt',
    'lighting',
    'hud',
    'mouseSensitivityLevel',
    'flySpeedLevel',
    'particles',
    'sprites',
]);

class SettingsManager {
    constructor() {
        this._state = { ...DEFAULT_SETTINGS };
        this._subscribers = new Map(); // key -> Set<Function>
        this.source = 'padrões';       // 'localStorage (doomgpu.settings.v1)' ou 'padrões'
        this._loadFromStorage();
    }

    /**
     * Carrega as configurações persistidas do localStorage.
     * @private
     */
    _loadFromStorage() {
        if (typeof window === 'undefined' || !window.localStorage) return;

        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                this.source = 'padrões (primeira execução)';
                return;
            }

            const data = JSON.parse(raw);
            if (typeof data !== 'object' || data === null) {
                this.source = 'padrões (formato inválido)';
                return;
            }

            let loadedAny = false;
            for (const key of PERSISTED_KEYS) {
                if (key in data) {
                    const val = data[key];
                    if (this._validate(key, val)) {
                        this._state[key] = val;
                        loadedAny = true;
                    }
                }
            }

            if (loadedAny) {
                this.source = `localStorage (${STORAGE_KEY})`;
            } else {
                this.source = 'padrões (sem chaves válidas)';
            }
        } catch (err) {
            console.warn(`[Settings] Falha ao carregar do localStorage (${STORAGE_KEY}):`, err.message);
            this.source = 'padrões (erro de leitura)';
        }
    }

    /**
     * Salva as configurações persistidas no localStorage.
     * @private
     */
    _saveToStorage() {
        if (typeof window === 'undefined' || !window.localStorage) return;

        try {
            const toSave = {};
            for (const key of PERSISTED_KEYS) {
                toSave[key] = this._state[key];
            }
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
        } catch (err) {
            console.warn(`[Settings] Falha ao salvar no localStorage (${STORAGE_KEY}):`, err.message);
        }
    }

    /**
     * Valida tipo e faixa de valores para cada chave de configuração.
     * @param {string} key 
     * @param {*} value 
     * @returns {boolean}
     * @private
     */
    _validate(key, value) {
        if (!(key in DEFAULT_SETTINGS)) return false;

        switch (key) {
            case 'visualMode':
                return value === 'retro' || value === 'moderno';
            case 'mouseSensitivityLevel':
            case 'flySpeedLevel':
                return Number.isInteger(value) && value >= 1 && value <= 10;
            case 'crt':
            case 'lighting':
            case 'particles':
            case 'sprites':
            case 'textured':
            case 'sectorColors':
            case 'culling':
            case 'skyTest':
            case 'hud':
                return typeof value === 'boolean';
            default:
                return false;
        }
    }

    /**
     * Retorna o valor atual de uma configuração.
     * @param {string} key 
     * @returns {*}
     */
    get(key) {
        return this._state[key];
    }

    /**
     * Altera o valor de uma configuração, validando tipo e faixa.
     * Notifica os assinantes se o valor tiver mudado.
     * @param {string} key 
     * @param {*} value 
     * @param {boolean} [persist=true] Se deve salvar no localStorage quando aplicável
     * @returns {boolean} true se a alteração foi aplicada
     */
    set(key, value, persist = true) {
        if (!this._validate(key, value)) {
            console.warn(`[Settings] Valor inválido para "${key}":`, value);
            return false;
        }

        const oldValue = this._state[key];
        if (oldValue === value) return false;

        this._state[key] = value;

        if (persist && PERSISTED_KEYS.has(key)) {
            this._saveToStorage();
        }

        this._notify(key, value, oldValue);
        return true;
    }

    /**
     * Inverte o valor de uma configuração booleana.
     * @param {string} key 
     * @returns {boolean} Novo valor booleano
     */
    toggle(key) {
        if (key === 'visualMode') {
            const current = this.get('visualMode');
            const next = (current === 'retro') ? 'moderno' : 'retro';
            this.set('visualMode', next);
            return next;
        }
        const current = this.get(key);
        if (typeof current === 'boolean') {
            this.set(key, !current);
            return !current;
        }
        return current;
    }

    /**
     * Incrementa ou decrementa um nível de configuração numérico (1 a 10).
     * @param {string} key 
     * @param {number} delta 
     * @returns {number} Novo nível
     */
    stepLevel(key, delta) {
        const current = this.get(key);
        if (Number.isInteger(current)) {
            const next = Math.min(Math.max(current + delta, 1), 10);
            this.set(key, next);
            return next;
        }
        return current;
    }

    /**
     * Inscreve um callback para ser notificado em mudanças de valor.
     * @param {string} keyOrWildcard Nome da chave ou '*' para todas
     * @param {Function} callback Recebe (newValue, oldValue, key)
     * @returns {Function} Função para cancelar a inscrição
     */
    subscribe(keyOrWildcard, callback) {
        if (!this._subscribers.has(keyOrWildcard)) {
            this._subscribers.set(keyOrWildcard, new Set());
        }
        this._subscribers.get(keyOrWildcard).add(callback);

        return () => {
            const set = this._subscribers.get(keyOrWildcard);
            if (set) set.delete(callback);
        };
    }

    /**
     * Dispara as notificações para assinantes.
     * @private
     */
    _notify(key, newValue, oldValue) {
        const keySubs = this._subscribers.get(key);
        if (keySubs) {
            for (const cb of keySubs) {
                try {
                    cb(newValue, oldValue, key);
                } catch (e) {
                    console.error(`[Settings] Erro no assinante de "${key}":`, e);
                }
            }
        }

        const wildSubs = this._subscribers.get('*');
        if (wildSubs) {
            for (const cb of wildSubs) {
                try {
                    cb(newValue, oldValue, key);
                } catch (e) {
                    console.error(`[Settings] Erro no assinante coringa de "${key}":`, e);
                }
            }
        }
    }

    /**
     * Restaura todas as configurações para os padrões de fábrica.
     */
    reset() {
        for (const [key, val] of Object.entries(DEFAULT_SETTINGS)) {
            this.set(key, val);
        }
        this._saveToStorage();
    }

    /**
     * Retorna a sensibilidade do mouse em radianos por pixel:
     * base * 1.25^(nível - 5)
     * @returns {number}
     */
    getMouseSensitivity() {
        const level = this._state.mouseSensitivityLevel;
        return BASE_MOUSE_SENSITIVITY * Math.pow(1.25, level - 5);
    }

    /**
     * Retorna a velocidade de voo em unidades do Doom por segundo:
     * base * 1.25^(nível - 5)
     * @returns {number}
     */
    getFlySpeed() {
        const level = this._state.flySpeedLevel;
        return BASE_FLY_SPEED * Math.pow(1.25, level - 5);
    }
}

// Instância singleton central
export const settings = new SettingsManager();
