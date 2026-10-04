// Leitor do contêiner WAD: cabeçalho + diretório de lumps.
// Todos os números do WAD são little-endian.

const LE = true;
const HEADER_SIZE = 12;
const DIR_ENTRY_SIZE = 16;

export class WadError extends Error {
  constructor(message) {
    super(`WAD: ${message}`);
    this.name = 'WadError';
  }
}

// Lê um nome ASCII de tamanho fixo preenchido com zeros (nomes de lump e de textura).
// Corta no primeiro byte 0 e devolve em maiúsculas.
export function readName(view, offset, length = 8) {
  let s = '';
  for (let i = 0; i < length; i++) {
    const c = view.getUint8(offset + i);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s.toUpperCase();
}

export class WadFile {
  constructor(buffer) {
    if (buffer.byteLength < HEADER_SIZE) {
      throw new WadError(`arquivo pequeno demais (${buffer.byteLength} bytes)`);
    }
    this.buffer = buffer;
    const view = new DataView(buffer);

    // Cabeçalho: assinatura (4 bytes), número de lumps (int32), offset do diretório (int32).
    this.type = readName(view, 0, 4);
    if (this.type !== 'IWAD' && this.type !== 'PWAD') {
      throw new WadError(`assinatura inválida "${this.type}" (esperado IWAD ou PWAD)`);
    }
    const numLumps = view.getInt32(4, LE);
    const dirOffset = view.getInt32(8, LE);
    if (numLumps < 0 || dirOffset < 0 || dirOffset + numLumps * DIR_ENTRY_SIZE > buffer.byteLength) {
      throw new WadError(`diretório fora do arquivo (lumps=${numLumps}, offset=${dirOffset})`);
    }

    // Diretório: offset (int32), tamanho (int32), nome (8 bytes).
    this.lumps = [];
    for (let i = 0; i < numLumps; i++) {
      const p = dirOffset + i * DIR_ENTRY_SIZE;
      const lump = {
        index: i,
        offset: view.getInt32(p, LE),
        size: view.getInt32(p + 4, LE),
        name: readName(view, p + 8, 8),
      };
      if (lump.offset < 0 || lump.size < 0 || lump.offset + lump.size > buffer.byteLength) {
        throw new WadError(`lump ${i} "${lump.name}" aponta para fora do arquivo`);
      }
      this.lumps.push(lump);
    }
  }

  static async fromUrl(url) {
    const response = await fetch(url);
    // Um 404 não rejeita o fetch: o servidor devolve uma página HTML. Por isso checamos ok.
    if (!response.ok) {
      throw new WadError(`falha ao baixar ${url}: HTTP ${response.status} ${response.statusText}`);
    }
    return new WadFile(await response.arrayBuffer());
  }

  // Índice do primeiro lump com esse nome a partir de `start`, ou -1.
  findLump(name, start = 0) {
    const n = name.toUpperCase();
    for (let i = start; i < this.lumps.length; i++) {
      if (this.lumps[i].name === n) return i;
    }
    return -1;
  }

  // Aceita índice numérico ou nome.
  getLumpInfo(ref) {
    const index = typeof ref === 'number' ? ref : this.findLump(ref);
    const lump = this.lumps[index];
    if (!lump) throw new WadError(`lump "${ref}" não encontrado`);
    return lump;
  }

  getLumpBytes(ref) {
    const lump = this.getLumpInfo(ref);
    return new Uint8Array(this.buffer, lump.offset, lump.size);
  }

  getLumpView(ref) {
    const lump = this.getLumpInfo(ref);
    return new DataView(this.buffer, lump.offset, lump.size);
  }
}
