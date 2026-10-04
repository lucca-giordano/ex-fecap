import { WadError } from './WadFile.js';

/**
 * Módulo para leitura do lump COLORMAP, construção da paleta iluminada (256x32)
 * e determinação do nome do céu conforme o mapa.
 */

/**
 * Lê o lump COLORMAP do arquivo WAD.
 * O lump contém 34 tabelas de 256 bytes (8704 bytes), mapeando índices da paleta
 * para seus equivalentes escurecidos nos níveis 0 (mais claro/identidade) a 31 (mais escuro).
 * 
 * @param {import('./WadFile.js').WadFile} wad 
 * @returns {{ bytes: Uint8Array, numTables: number }}
 */
export function loadColormap(wad) {
    const colormapIdx = wad.findLump('COLORMAP');
    if (colormapIdx < 0) {
        throw new WadError('Lump COLORMAP não encontrado no arquivo WAD.');
    }

    const lump = wad.lumps[colormapIdx];
    if (lump.size < 8192) {
        throw new WadError(`Lump COLORMAP muito pequeno (${lump.size} bytes, esperado mínimo de 8192 bytes para 32 tabelas).`);
    }

    const bytes = wad.getLumpBytes(colormapIdx);
    const numTables = Math.floor(bytes.length / 256);

    return {
        bytes,
        numTables,
    };
}

/**
 * Cria a imagem RGBA de 256 colunas x 32 linhas correspondente aos 32 níveis de luz.
 * Cada pixel (i, n) recebe a cor da paleta 0 do PLAYPAL para o índice colormap[n][i],
 * com alpha 255.
 * 
 * @param {Uint8Array} palette Paleta 0 (768 bytes, 256 entradas RGB)
 * @param {Uint8Array} colormapBytes Bytes do lump COLORMAP
 * @returns {Uint8Array} Array de 256 * 32 * 4 bytes (RGBA)
 */
export function buildLitPalette(palette, colormapBytes) {
    const out = new Uint8Array(256 * 32 * 4);

    for (let level = 0; level < 32; level++) {
        const tableOffset = level * 256;
        for (let i = 0; i < 256; i++) {
            const mappedIdx = colormapBytes[tableOffset + i];
            const dst = (level * 256 + i) * 4;

            out[dst + 0] = palette[mappedIdx * 3 + 0];
            out[dst + 1] = palette[mappedIdx * 3 + 1];
            out[dst + 2] = palette[mappedIdx * 3 + 2];
            out[dst + 3] = 255;
        }
    }

    return out;
}

/**
 * Determina o nome da textura de céu correspondente ao mapa fornecido.
 * Mapas ExMy usam SKYx (com x limitado a 1..3); mapas MAPxx usam SKY1 (01..11),
 * SKY2 (12..20) e SKY3 (21..32). Para E1M1, retorna 'SKY1'.
 * 
 * @param {string} mapName Nome do mapa (ex: 'E1M1', 'MAP01')
 * @returns {string} Nome da textura de céu ('SKY1', 'SKY2' ou 'SKY3')
 */
export function skyNameForMap(mapName) {
    const name = (mapName || '').toUpperCase();

    const episodeMatch = name.match(/^E(\d+)M(\d+)$/);
    if (episodeMatch) {
        const ep = parseInt(episodeMatch[1], 10);
        const clampedEp = Math.min(Math.max(ep, 1), 3);
        return `SKY${clampedEp}`;
    }

    const mapMatch = name.match(/^MAP(\d+)$/);
    if (mapMatch) {
        const num = parseInt(mapMatch[1], 10);
        if (num <= 11) return 'SKY1';
        if (num <= 20) return 'SKY2';
        return 'SKY3';
    }

    return 'SKY1';
}
