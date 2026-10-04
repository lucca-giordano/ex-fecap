// Página de depuração dos sons: decodifica todos com o MESMO dmx.js do jogo, mostra a forma de onda e
// toca com o AudioEngine real. Testador posicional com as MESMAS funções de soundMath.js.

import { WadFile } from '../src/wad/WadFile.js';
import { decodeDmx, findSoundLumps, soundNameFromLump, loadSounds } from '../src/audio/dmx.js';
import { adjustSoundParams, masterGain } from '../src/audio/soundMath.js';
import { AudioEngine } from '../src/audio/AudioEngine.js';

const WAD_URL = new URL('../assets/freedoom1.wad', import.meta.url);
const WAVE_W = 160;
const WAVE_H = 32;
const LISTENER = { x: 0, y: 0, angleDeg: 0 }; // na origem, olhando para o leste

function showError(text) {
  document.getElementById('msg').textContent = text;
  console.error(text);
}

const $ = (id) => document.getElementById(id);

function cell(text, cls) {
  const td = document.createElement('td');
  if (cls) td.className = cls;
  if (typeof text === 'string') td.textContent = text;
  else td.append(text); // elemento (canvas, botão)
  return td;
}

// Miniatura da forma de onda: mínimo e máximo das amostras em cada coluna.
function waveform(samples) {
  const canvas = document.createElement('canvas');
  canvas.width = WAVE_W;
  canvas.height = WAVE_H;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#6c6';
  ctx.beginPath();
  const per = Math.max(1, Math.floor(samples.length / WAVE_W));
  for (let x = 0; x < WAVE_W; x++) {
    let lo = 1, hi = -1;
    for (let i = x * per; i < Math.min(samples.length, (x + 1) * per); i++) {
      lo = Math.min(lo, samples[i]);
      hi = Math.max(hi, samples[i]);
    }
    if (hi < lo) continue;
    ctx.moveTo(x + 0.5, (1 - hi) * WAVE_H / 2);
    ctx.lineTo(x + 0.5, (1 - lo) * WAVE_H / 2 + 1);
  }
  ctx.stroke();
  return canvas;
}

async function main() {
  const wad = await WadFile.fromUrl(WAD_URL);
  const { sounds, invalid } = loadSounds(wad);
  const engine = new AudioEngine(sounds, { volumeLevel: 12, skipped: invalid.length });

  // Tabela: todos os DS*, válidos e inválidos.
  const table = $('table');
  const head = document.createElement('tr');
  for (const h of ['lump', 'som', 'taxa (Hz)', 'amostras', 'duração (s)', 'forma de onda', '']) {
    const th = document.createElement('th');
    th.textContent = h;
    head.append(th);
  }
  table.append(head);
  const lumps = [...findSoundLumps(wad)].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [lump, index] of lumps) {
    const name = soundNameFromLump(lump);
    const r = decodeDmx(wad.getLumpBytes(index));
    const tr = document.createElement('tr');
    if (!r.ok) {
      tr.className = 'bad';
      tr.append(cell(lump, 'name'), cell(name, 'name'), cell(`inválido: ${r.reason}`, 'name'));
    } else {
      const play = document.createElement('button');
      play.textContent = 'Tocar';
      play.addEventListener('click', () => engine.play(name));
      tr.append(cell(lump, 'name'), cell(name, 'name'), cell(String(r.rate)), cell(String(r.samples.length)),
        cell(r.duration.toFixed(3)), cell(waveform(r.samples)), cell(play));
    }
    table.append(tr);
  }
  $('title').textContent = `Sons do WAD: ${sounds.size} válidos, ${invalid.length} inválidos`;

  // Volume mestre e mudo.
  const updateMaster = () => {
    const level = Number($('volume').value);
    $('volumeValue').textContent = String(level);
    engine.setVolumeLevel(level);
    engine.setMuted($('muted').checked);
    const stats = engine.getStats();
    $('status').textContent = `ganho mestre ${masterGain(level, $('muted').checked).toFixed(3)}; ` +
      `${stats.running ? 'áudio ativo' : 'clique em algo para ativar o áudio'}; canais ${stats.channelsActive}/8`;
  };
  $('volume').addEventListener('input', updateMaster);
  $('muted').addEventListener('change', updateMaster);
  setInterval(updateMaster, 500);
  updateMaster();

  // Som posicional: fonte a `dist` unidades no ângulo dado (relativo ao olhar do ouvinte).
  for (const name of [...sounds.keys()].sort()) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    if (name === 'pistol') opt.selected = true;
    $('posSound').append(opt);
  }
  const sourcePos = () => {
    const a = Number($('angle').value) * Math.PI / 180, d = Number($('dist').value);
    return { x: LISTENER.x + Math.cos(a) * d, y: LISTENER.y + Math.sin(a) * d };
  };
  const updatePos = () => {
    $('angleValue').textContent = $('angle').value;
    $('distValue').textContent = $('dist').value;
    const p = adjustSoundParams(LISTENER, sourcePos());
    $('posInfo').textContent = `distância aproximada ${p.dist.toFixed(0)}; volume ${p.volume.toFixed(3)}; ` +
      `pan ${p.pan.toFixed(3)} (${p.pan < -0.01 ? 'esquerda' : p.pan > 0.01 ? 'direita' : 'centro'})` +
      `${p.audible ? '' : ' — fora do alcance, não toca'}`;
  };
  $('angle').addEventListener('input', updatePos);
  $('dist').addEventListener('input', updatePos);
  updatePos();
  $('playPos').addEventListener('click', () => {
    engine.setListener(LISTENER);
    const { x, y } = sourcePos();
    engine.play($('posSound').value, { origin: 'teste', x, y });
  });
}

main().catch((err) => showError(err.message));
