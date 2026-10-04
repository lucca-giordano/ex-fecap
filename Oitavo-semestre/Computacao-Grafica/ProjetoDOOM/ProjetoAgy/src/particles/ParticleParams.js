import {
  DEFAULT_PARTICLE_PARAMS,
  validateAndSanitizeParams
} from './particleConfig.js';

const STORAGE_KEY = 'doomgpu.particles.v1';
const CONFIG_URL = './config/particles.json';

/**
 * Gerencia o ciclo de vida, persistência e notificações dos parâmetros de partículas.
 * Ordem de prioridade no carregamento:
 * 1. Default em código (DEFAULT_PARTICLE_PARAMS)
 * 2. config/particles.json (via fetch)
 * 3. localStorage (doomgpu.particles.v1)
 */
export class ParticleParams {
  constructor() {
    this._listeners = new Set();
    this._saveTimeout = null;
    this._params = JSON.parse(JSON.stringify(DEFAULT_PARTICLE_PARAMS));
    this._fileDefaults = null; // Parâmetros vindos do config/particles.json
  }

  /**
   * Inicializa carregando do arquivo de configuração e do localStorage.
   */
  async init() {
    // 1. Tenta carregar do config/particles.json
    try {
      const response = await fetch(CONFIG_URL);
      if (response.ok) {
        const json = await response.json();
        this._fileDefaults = validateAndSanitizeParams(json);
        this._params = JSON.parse(JSON.stringify(this._fileDefaults));
      } else {
        console.warn(`[ParticleParams] Falha ao carregar ${CONFIG_URL} (status ${response.status}). Usando defaults internos.`);
      }
    } catch (err) {
      console.warn(`[ParticleParams] Erro ao buscar ${CONFIG_URL}:`, err);
    }

    // 2. Tenta carregar do localStorage (prioridade mais alta)
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this._params = validateAndSanitizeParams(parsed);
      }
    } catch (err) {
      console.warn(`[ParticleParams] Erro ao carregar parâmetros do localStorage. Removendo chave corrompida.`, err);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignora erro de remoção
      }
    }

    this._notify();
    return this._params;
  }

  /**
   * Retorna uma cópia profunda dos parâmetros atuais.
   */
  get() {
    return JSON.parse(JSON.stringify(this._params));
  }

  /**
   * Atualiza parâmetros (parciais ou completos), valida e notifica ouvintes.
   * @param {Object} partialOrFull
   */
  set(partialOrFull) {
    if (!partialOrFull || typeof partialOrFull !== 'object') return;

    // Mescla recursivamente apenas as seções conhecidas
    const merged = JSON.parse(JSON.stringify(this._params));

    if (partialOrFull.version !== undefined) merged.version = partialOrFull.version;
    if (partialOrFull.count !== undefined) merged.count = partialOrFull.count;
    if (partialOrFull.emberRatio !== undefined) merged.emberRatio = partialOrFull.emberRatio;
    if (partialOrFull.boxHalfXZ !== undefined) merged.boxHalfXZ = partialOrFull.boxHalfXZ;
    if (partialOrFull.boxHalfY !== undefined) merged.boxHalfY = partialOrFull.boxHalfY;

    if (partialOrFull.dust) {
      Object.assign(merged.dust, partialOrFull.dust);
    }
    if (partialOrFull.ember) {
      Object.assign(merged.ember, partialOrFull.ember);
    }
    if (partialOrFull.render) {
      Object.assign(merged.render, partialOrFull.render);
    }

    this._params = validateAndSanitizeParams(merged);
    this._scheduleSave();
    this._notify();
  }

  /**
   * Registra um ouvinte de alterações. Retorna função de unsubscribe.
   * @param {Function} callback
   * @returns {Function}
   */
  subscribe(callback) {
    if (typeof callback !== 'function') return () => {};
    this._listeners.add(callback);
    return () => {
      this._listeners.delete(callback);
    };
  }

  _notify() {
    const current = this.get();
    for (const listener of this._listeners) {
      try {
        listener(current);
      } catch (err) {
        console.error('[ParticleParams] Erro no listener de partículas:', err);
      }
    }
  }

  _scheduleSave() {
    if (this._saveTimeout) {
      clearTimeout(this._saveTimeout);
    }
    this._saveTimeout = setTimeout(() => {
      this._saveTimeout = null;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this._params));
      } catch (err) {
        console.warn('[ParticleParams] Não foi possível salvar no localStorage:', err);
      }
    }, 300);
  }

  /**
   * Reseta os parâmetros para o default do arquivo config/particles.json ou default de código.
   */
  resetToDefaults() {
    const base = this._fileDefaults || DEFAULT_PARTICLE_PARAMS;
    this._params = JSON.parse(JSON.stringify(base));
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignora erro
    }
    this._scheduleSave();
    this._notify();
  }

  /**
   * Exporta a configuração atual para download como JSON.
   */
  exportToFile() {
    const jsonStr = JSON.stringify(this._params, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'particles.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Importa configuração a partir de texto JSON ou objeto.
   * @param {string|Object} content
   */
  importFromFile(content) {
    try {
      const parsed = typeof content === 'string' ? JSON.parse(content) : content;
      const validated = validateAndSanitizeParams(parsed);
      this._params = validated;
      this._scheduleSave();
      this._notify();
      return true;
    } catch (err) {
      console.warn('[ParticleParams] Falha ao importar arquivo JSON:', err);
      return false;
    }
  }
}
