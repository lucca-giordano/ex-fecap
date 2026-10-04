// Sons no formato DMX do Doom (lumps "DS..."). Puro: sem Web Audio.
//
// Cabeçalho (little-endian, 8 bytes): uint16 formato (3), uint16 taxa (Hz), uint32 N (amostras,
// INCLUINDO 32 bytes de preenchimento). Amostras de 8 bits sem sinal; os 16 primeiros e os 16 últimos
// bytes dos N são preenchimento. O som real começa em 8 + 16 e tem N - 32 amostras.

const LE = true;
export const DMX_FORMAT = 3;
export const DMX_PAD = 16;
export const MIN_RATE = 8000;
export const MAX_RATE = 96000;

// Decodifica um lump. Devolve { ok: true, rate, samples: Float32Array, duration } ou { ok: false, reason }.
export function decodeDmx(bytes) {
  if (bytes.length < 8) return { ok: false, reason: `lump com ${bytes.length} bytes (cabeçalho tem 8)` };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const format = view.getUint16(0, LE);
  const rate = view.getUint16(2, LE);
  const n = view.getUint32(4, LE);
  if (format !== DMX_FORMAT) return { ok: false, reason: `formato ${format} (esperado ${DMX_FORMAT})` };
  if (n <= 2 * DMX_PAD) return { ok: false, reason: `N = ${n} (precisa ser maior que ${2 * DMX_PAD})` };
  if (bytes.length < 8 + n) return { ok: false, reason: `lump com ${bytes.length} bytes, menor que 8 + N = ${8 + n}` };
  if (rate < MIN_RATE || rate > MAX_RATE) return { ok: false, reason: `taxa ${rate} Hz fora de [${MIN_RATE}, ${MAX_RATE}]` };

  const count = n - 2 * DMX_PAD;
  const samples = new Float32Array(count);
  const start = 8 + DMX_PAD;
  // 8 bits sem sinal -> [-1, 1): 128 vira 0, 0 vira -1, 255 vira 0.9921875.
  for (let i = 0; i < count; i++) samples[i] = (bytes[start + i] - 128) / 128;
  return { ok: true, rate, samples, duration: count / rate };
}

// Nome lógico: lump sem o "DS", em minúsculas (DSPISTOL -> "pistol").
export const soundNameFromLump = (lumpName) => lumpName.slice(2).toLowerCase();

// Lumps "DS*" com mais de 8 bytes (nome repetido: vale a última ocorrência). "DP*" (PC speaker) fica de fora.
export function findSoundLumps(wad) {
  const lumps = new Map();
  wad.lumps.forEach((lump, i) => {
    if (lump.name.startsWith('DS') && lump.size > 8) lumps.set(lump.name, i);
  });
  return lumps;
}

// Decodifica todos os sons. Inválidos são pulados com aviso (nome e motivo).
// Devolve { sounds: Map nome -> { rate, samples, duration, lump }, invalid: [{ lump, reason }] }.
export function loadSounds(wad, warn = (msg) => console.warn(msg)) {
  const sounds = new Map();
  const invalid = [];
  for (const [lump, index] of findSoundLumps(wad)) {
    const r = decodeDmx(wad.getLumpBytes(index));
    if (!r.ok) {
      invalid.push({ lump, reason: r.reason });
      warn(`Som ${lump} ignorado: ${r.reason}`);
      continue;
    }
    sounds.set(soundNameFromLump(lump), { rate: r.rate, samples: r.samples, duration: r.duration, lump });
  }
  return { sounds, invalid };
}
