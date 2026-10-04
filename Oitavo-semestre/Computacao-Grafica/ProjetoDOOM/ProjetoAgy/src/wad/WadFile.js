/**
 * Leitor e manipulador do contêiner binário WAD (Where's All the Data).
 * Lê o cabeçalho e o diretório de lumps garantindo interpretação em Little-Endian.
 */

const LITTLE_ENDIAN = true;
const HEADER_SIZE = 12;
const DIR_ENTRY_SIZE = 16;

export class WadError extends Error {
    constructor(message) {
        super(`[Erro WAD] ${message}`);
        this.name = 'WadError';
    }
}

/**
 * Lê uma string ASCII de tamanho fixo em um DataView.
 * Interrompe a leitura no primeiro byte nulo (0x00) e retorna em maiúsculas.
 * @param {DataView} view 
 * @param {number} offset 
 * @param {number} length 
 * @returns {string}
 */
export function readName(view, offset, length = 8) {
    let result = '';
    for (let i = 0; i < length; i++) {
        const byte = view.getUint8(offset + i);
        if (byte === 0) break;
        result += String.fromCharCode(byte);
    }
    return result.toUpperCase();
}

export class WadFile {
    /**
     * Cria e valida uma instância de WadFile a partir de um ArrayBuffer.
     * @param {ArrayBuffer} buffer 
     */
    constructor(buffer) {
        if (!buffer || buffer.byteLength < HEADER_SIZE) {
            throw new WadError(`Arquivo menor que o cabeçalho mínimo (${buffer ? buffer.byteLength : 0} bytes).`);
        }

        this.buffer = buffer;
        const view = new DataView(buffer);

        // Cabeçalho (12 bytes):
        // 0..3: Assinatura ("IWAD" ou "PWAD")
        // 4..7: Quantidade de lumps (int32)
        // 8..11: Offset do diretório de lumps (int32)
        this.type = readName(view, 0, 4);
        if (this.type !== 'IWAD' && this.type !== 'PWAD') {
            throw new WadError(`Assinatura de arquivo inválida: "${this.type}". Esperado "IWAD" ou "PWAD".`);
        }

        const numLumps = view.getInt32(4, LITTLE_ENDIAN);
        const dirOffset = view.getInt32(8, LITTLE_ENDIAN);

        if (numLumps < 0 || dirOffset < 0 || dirOffset + numLumps * DIR_ENTRY_SIZE > buffer.byteLength) {
            throw new WadError(
                `Diretório do WAD corrompido ou fora dos limites do arquivo (lumps: ${numLumps}, offset: ${dirOffset}, tamanho do buffer: ${buffer.byteLength}).`
            );
        }

        // Leitura das entradas do diretório (16 bytes cada)
        this.lumps = [];
        for (let i = 0; i < numLumps; i++) {
            const entryOffset = dirOffset + i * DIR_ENTRY_SIZE;
            const lump = {
                index: i,
                offset: view.getInt32(entryOffset, LITTLE_ENDIAN),
                size: view.getInt32(entryOffset + 4, LITTLE_ENDIAN),
                name: readName(view, entryOffset + 8, 8),
            };

            // Validação de limites individuais do lump
            if (lump.offset < 0 || lump.size < 0 || lump.offset + lump.size > buffer.byteLength) {
                throw new WadError(
                    `Lump ${i} ("${lump.name}") aponta para fora do arquivo (offset: ${lump.offset}, size: ${lump.size}).`
                );
            }

            this.lumps.push(lump);
        }
    }

    /**
     * Carrega um arquivo WAD via requisição HTTP Fetch.
     * Valida explicitamente se a resposta HTTP foi bem-sucedida (status 200..299).
     * @param {string|URL} url 
     * @returns {Promise<WadFile>}
     */
    static async fromUrl(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new WadError(
                `Falha na requisição HTTP (${response.status} ${response.statusText}) ao carregar "${url}". Verifique se o arquivo existe na pasta assets.`
            );
        }
        const buffer = await response.arrayBuffer();
        return new WadFile(buffer);
    }

    /**
     * Procura o primeiro lump com o nome informado a partir de determinado índice.
     * @param {string} name 
     * @param {number} start 
     * @returns {number} Índice do lump ou -1 se não encontrado.
     */
    findLump(name, start = 0) {
        const upper = name.toUpperCase();
        for (let i = start; i < this.lumps.length; i++) {
            if (this.lumps[i].name === upper) return i;
        }
        return -1;
    }

    /**
     * Obtém metadados de um lump a partir de seu nome ou índice numérico.
     * @param {string|number} ref 
     * @returns {Object} { index, offset, size, name }
     */
    getLumpInfo(ref) {
        const index = typeof ref === 'number' ? ref : this.findLump(ref);
        const lump = this.lumps[index];
        if (!lump) {
            throw new WadError(`Lump "${ref}" não encontrado no diretório do arquivo WAD.`);
        }
        return lump;
    }

    /**
     * Retorna uma fatia de bytes (Uint8Array) correspondente ao lump.
     * @param {string|number} ref 
     * @returns {Uint8Array}
     */
    getLumpBytes(ref) {
        const lump = this.getLumpInfo(ref);
        return new Uint8Array(this.buffer, lump.offset, lump.size);
    }

    /**
     * Retorna um DataView apontando exclusivamente para a região do lump.
     * @param {string|number} ref 
     * @returns {DataView}
     */
    getLumpView(ref) {
        const lump = this.getLumpInfo(ref);
        return new DataView(this.buffer, lump.offset, lump.size);
    }
}
