// Motor de som com Web Audio. A decodificação (dmx.js), a matemática (soundMath.js) e os canais
// (channels.js) são puros; aqui fica só a cola com o navegador.
//
// O AudioContext é criado no primeiro gesto do usuário (pointerdown ou keydown), para o Chrome não
// avisar sobre autoplay. Pedidos de som antes disso (ou com o contexto parado) são descartados em
// silêncio; o som do próprio primeiro gesto pode ser perdido.
//
// Cadeia por som: AudioBufferSourceNode -> GainNode (distância) -> StereoPannerNode -> GainNode mestre -> saída.

import { adjustSoundParams, masterGain } from './soundMath.js';
import { ChannelManager, MAX_CHANNELS } from './channels.js';

const CUT_FADE = 0.005;     // fade ao cortar um canal (s)
const MASTER_SMOOTH = 0.02; // constante de tempo das mudanças do volume mestre (s)

export class AudioEngine {
  // sounds: Map nome -> { rate, samples }, de loadSounds.
  constructor(sounds, { volumeLevel = 12, muted = false, skipped = 0 } = {}) {
    this.sounds = sounds;
    this.skipped = skipped;
    this.level = volumeLevel;
    this.muted = muted;
    this.ctx = null;
    this.buffers = new Map();
    this.master = null;
    this.channels = new ChannelManager(MAX_CHANNELS);
    this.voices = new Array(MAX_CHANNELS).fill(null); // { source, gain, panner }
    this.listener = null;
    this.warned = new Set();

    // Desbloqueio por gesto (fase de captura, antes de qualquer outro handler).
    this.unlock = () => this.createContext();
    window.addEventListener('pointerdown', this.unlock, true);
    window.addEventListener('keydown', this.unlock, true);
  }

  createContext() {
    if (this.ctx) return;
    window.removeEventListener('pointerdown', this.unlock, true);
    window.removeEventListener('keydown', this.unlock, true);
    try {
      this.ctx = new AudioContext({ latencyHint: 'interactive' });
    } catch (err) {
      console.warn('Som: não foi possível criar o AudioContext:', err.message);
      return;
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch((err) => console.warn('Som: resume() falhou:', err.message));
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = masterGain(this.level, this.muted);
    this.master.connect(this.ctx.destination);
    // Um AudioBuffer por som, guardado em cache.
    for (const [name, s] of this.sounds) {
      const buffer = this.ctx.createBuffer(1, s.samples.length, s.rate);
      buffer.copyToChannel(s.samples, 0);
      this.buffers.set(name, buffer);
    }
    console.log(`Som: AudioContext criado (${this.ctx.sampleRate} Hz), ${this.buffers.size} sons em cache`);
  }

  get running() {
    return Boolean(this.ctx) && this.ctx.state === 'running';
  }

  // listener: { x, y, angleDeg } em coordenadas do Doom (chamado a cada frame).
  setListener(listener) {
    this.listener = listener;
  }

  setVolumeLevel(n) {
    this.level = n;
    this.applyMaster();
  }

  setMuted(muted) {
    this.muted = muted;
    this.applyMaster();
  }

  applyMaster() {
    if (!this.master) return;
    this.master.gain.setTargetAtTime(masterGain(this.level, this.muted), this.ctx.currentTime, MASTER_SMOOTH);
  }

  // Toca um som. opts: { origin, x, y } (x, y em coordenadas do Doom; sem eles, som sem posição).
  play(name, { origin, x, y } = {}) {
    if (this.muted || !this.running) return;
    const buffer = this.buffers.get(name);
    if (!buffer) {
      if (!this.warned.has(name)) {
        this.warned.add(name);
        console.warn(`Som "${name}" não existe no WAD; ignorado`);
      }
      return;
    }
    const positional = Number.isFinite(x) && Number.isFinite(y);
    const params = adjustSoundParams(this.listener, positional ? { x, y } : null);
    if (!params.audible) return;

    const { index, stop } = this.channels.alloc(origin);
    if (stop >= 0) this.cut(stop);

    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = params.volume;
    const panner = ctx.createStereoPanner();
    panner.pan.value = params.pan;
    source.connect(gain).connect(panner).connect(this.master);
    const voice = { source, gain, panner };
    this.voices[index] = voice;
    source.onended = () => {
      // Só libera se o canal ainda é desta voz (pode ter sido reutilizado depois de um corte).
      if (this.voices[index] === voice) {
        this.voices[index] = null;
        this.channels.release(index);
      }
      source.disconnect();
      gain.disconnect();
      panner.disconnect();
    };
    source.start();
  }

  // Corta um canal com fade de 5 ms (sem estalo) e o deixa livre para reutilizar.
  cut(index) {
    const voice = this.voices[index];
    if (!voice) return;
    const now = this.ctx.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.linearRampToValueAtTime(0, now + CUT_FADE);
    try {
      voice.source.stop(now + CUT_FADE);
    } catch {
      // já parada
    }
    this.voices[index] = null;
  }

  stopAll() {
    for (let i = 0; i < this.voices.length; i++) {
      if (this.voices[i]) {
        this.cut(i);
        this.channels.release(i);
      }
    }
  }

  getStats() {
    return { running: this.running, loaded: this.sounds.size, skipped: this.skipped, channelsActive: this.channels.active };
  }
}
