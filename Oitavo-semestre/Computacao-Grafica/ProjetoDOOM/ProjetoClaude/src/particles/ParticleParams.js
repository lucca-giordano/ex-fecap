// Estado dos parâmetros das partículas: carregamento, gravação e assinantes.
// Prioridade: padrões do código < config/particles.json < localStorage ("doomgpu.particles.v1").

import {
  DEFAULT_PARTICLE_PARAMS, clone, sanitizeParams, mergeParamLayers, setPath, getPath, serializeParams,
} from './particleConfig.js';

export const PARTICLES_STORAGE_KEY = 'doomgpu.particles.v1';
const CONFIG_URL = new URL('../../config/particles.json', import.meta.url);
const SAVE_DEBOUNCE_MS = 300;

const warn = (msg) => console.warn(`Partículas: ${msg}`);

// Lê config/particles.json sem cache. Devolve o objeto ou null (com aviso) se faltar ou for inválido.
async function fetchConfigFile() {
  try {
    const response = await fetch(CONFIG_URL, { cache: 'no-store' });
    if (!response.ok) {
      warn(`config/particles.json: HTTP ${response.status}; usando os padrões do código`);
      return null;
    }
    return await response.json();
  } catch (err) {
    warn(`config/particles.json inválido ou indisponível (${err.message}); usando os padrões do código`);
    return null;
  }
}

function readStorage() {
  try {
    const raw = localStorage.getItem(PARTICLES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    warn(`falha ao ler o localStorage (${err.message})`);
    return null;
  }
}

export class ParticleParams {
  constructor() {
    this.values = clone(DEFAULT_PARTICLE_PARAMS);
    this.listeners = new Set();
    this.saveTimer = null;
    this.source = 'padrões do código';
  }

  async load() {
    const file = await fetchConfigFile();
    const stored = readStorage();
    this.values = mergeParamLayers([file, stored], warn);
    this.source = stored ? 'localStorage' : file ? 'config/particles.json' : 'padrões do código';
    console.log(`Partículas: parâmetros carregados de ${this.source}`);
    this.notify();
  }

  get(path) {
    return path ? getPath(this.values, path) : this.values;
  }

  // Altera um campo; a validação limita faixas e corrige restrições entre campos.
  set(path, value) {
    const candidate = clone(this.values);
    setPath(candidate, path, value);
    this.apply(sanitizeParams(candidate, this.values, warn));
  }

  // Substitui o objeto inteiro (importação), validado sobre os padrões do código.
  replace(obj) {
    this.apply(sanitizeParams(obj, DEFAULT_PARTICLE_PARAMS, warn));
  }

  apply(next) {
    this.values = next;
    this.notify();
    this.scheduleSave();
  }

  // "Restaurar do arquivo": apaga o localStorage e relê config/particles.json.
  async restoreFromFile() {
    clearTimeout(this.saveTimer);
    try {
      localStorage.removeItem(PARTICLES_STORAGE_KEY);
    } catch (err) {
      warn(`falha ao apagar o localStorage (${err.message})`);
    }
    this.values = mergeParamLayers([await fetchConfigFile()], warn);
    this.source = 'config/particles.json';
    this.notify();
  }

  // "Restaurar padrões do código": volta aos padrões e grava no localStorage.
  restoreDefaults() {
    this.apply(clone(DEFAULT_PARTICLE_PARAMS));
  }

  toJSON() {
    return serializeParams(this.values);
  }

  scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(PARTICLES_STORAGE_KEY, JSON.stringify(this.values));
      } catch (err) {
        warn(`falha ao gravar no localStorage (${err.message})`);
      }
    }, SAVE_DEBOUNCE_MS);
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    for (const fn of this.listeners) fn(this.values);
  }
}
