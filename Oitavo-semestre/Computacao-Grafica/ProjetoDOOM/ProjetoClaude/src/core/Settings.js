// Configurações do jogo: estado único, com validação, assinantes e persistência em localStorage.
// Nenhum outro módulo guarda cópia destas opções: todos leem com get() ou assinam mudanças.

const STORAGE_KEY = 'doomgpu.settings.v1';
export const DEFAULT_MOVE_MODE = 'walk'; // etapa 12: 'walk' (gravidade e colisão) ou 'fly'

// type: 'bool' | 'enum' | 'int'. persist: salva no localStorage (as de depuração valem só na sessão).
const SCHEMA = {
  visualMode: { type: 'enum', values: ['retro', 'moderno'], default: 'retro', persist: true },
  crt: { type: 'bool', default: true, persist: true },
  lighting: { type: 'bool', default: true, persist: true },
  textured: { type: 'bool', default: true, persist: false },
  sectorColors: { type: 'bool', default: false, persist: false },
  culling: { type: 'bool', default: true, persist: false },
  skyTest: { type: 'bool', default: false, persist: false },
  hud: { type: 'bool', default: true, persist: true },
  mouseSensitivityLevel: { type: 'int', min: 1, max: 10, default: 5, persist: true },
  flySpeedLevel: { type: 'int', min: 1, max: 10, default: 5, persist: true },
  // Etapa 10. Chaves ausentes no armazenamento usam o padrão (sem mudar a versão do esquema).
  // A antiga particleDensity foi substituída pelos parâmetros de src/particles/ e é ignorada se existir.
  particles: { type: 'bool', default: true, persist: true },
  sprites: { type: 'bool', default: true, persist: true }, // etapa 11
  moveMode: { type: 'enum', values: ['walk', 'fly'], default: DEFAULT_MOVE_MODE, persist: true },
  // Etapa 14: volume dos efeitos 0..15 (o Doom usa 8 por padrão; 12 se ouve melhor numa sala) e mudo.
  sfxVolumeLevel: { type: 'int', min: 0, max: 15, default: 12, persist: true },
  muted: { type: 'bool', default: false, persist: true },
  // Etapa 18: IA dos monstros e "sem alvo" (os monstros ignoram o jogador), só na sessão.
  monsterAI: { type: 'bool', default: true, persist: false },
  noTarget: { type: 'bool', default: false, persist: false },
};

function isValid(key, value) {
  const s = SCHEMA[key];
  if (!s) return false;
  if (s.type === 'bool') return typeof value === 'boolean';
  if (s.type === 'enum') return s.values.includes(value);
  return Number.isInteger(value) && value >= s.min && value <= s.max;
}

class Settings {
  constructor() {
    this.values = {};
    this.listeners = new Map(); // chave (ou '*') -> Set de funções
    for (const [key, s] of Object.entries(SCHEMA)) this.values[key] = s.default;
    this.source = this.load();
  }

  get(key) {
    if (!(key in SCHEMA)) throw new Error(`Configuração desconhecida: ${key}`);
    return this.values[key];
  }

  // Valida tipo e faixa; devolve true se o valor mudou. Só notifica quando muda.
  set(key, value) {
    if (!isValid(key, value)) {
      console.warn(`Configuração inválida ignorada: ${key} = ${JSON.stringify(value)}`);
      return false;
    }
    if (this.values[key] === value) return false;
    this.values[key] = value;
    if (SCHEMA[key].persist) this.save();
    for (const k of [key, '*']) {
      for (const fn of this.listeners.get(k) ?? []) fn(value, key);
    }
    return true;
  }

  // Booleanos invertem; enums de dois valores alternam entre eles.
  toggle(key) {
    const s = SCHEMA[key];
    if (s?.type === 'bool') return this.set(key, !this.values[key]);
    if (s?.type === 'enum' && s.values.length === 2) {
      return this.set(key, s.values[(s.values.indexOf(this.values[key]) + 1) % 2]);
    }
    throw new Error(`Configuração ${key} não pode ser alternada`);
  }

  // Devolve uma função que cancela a assinatura.
  subscribe(key, fn) {
    if (key !== '*' && !(key in SCHEMA)) throw new Error(`Configuração desconhecida: ${key}`);
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key).add(fn);
    return () => this.listeners.get(key).delete(fn);
  }

  reset() {
    for (const [key, s] of Object.entries(SCHEMA)) this.set(key, s.default);
  }

  // Lê só as chaves persistidas; valores inválidos são ignorados. Devolve a origem para o log.
  load() {
    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      console.warn('Configurações: falha ao ler o localStorage:', err.message);
      return 'padrões (localStorage indisponível)';
    }
    if (!raw) return 'padrões';
    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      console.warn('Configurações: conteúdo salvo inválido, usando padrões:', err.message);
      return 'padrões (conteúdo salvo inválido)';
    }
    const loaded = [];
    for (const [key, s] of Object.entries(SCHEMA)) {
      if (!s.persist || !(key in data)) continue;
      if (isValid(key, data[key])) {
        this.values[key] = data[key];
        loaded.push(key);
      } else {
        console.warn(`Configurações: valor salvo inválido ignorado: ${key} = ${JSON.stringify(data[key])}`);
      }
    }
    return `localStorage (${loaded.join(', ') || 'nenhuma chave válida'})`;
  }

  save() {
    const data = {};
    for (const [key, s] of Object.entries(SCHEMA)) if (s.persist) data[key] = this.values[key];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.warn('Configurações: falha ao salvar no localStorage:', err.message);
    }
  }
}

export const settings = new Settings();
