import { decodePatch, loadPalette0, findLastLump } from '../wad/Textures.js';
import { WadError } from '../wad/WadFile.js';

/**
 * Carrega todos os assets gráficos necessários para o menu do Doom:
 * - Paleta 0 do PLAYPAL (256 cores RGB)
 * - Imagem de título TITLEPIC
 * - Logo M_DOOM e títulos
 * - Rótulos gráficos M_NEWG, M_OPTION, M_RDTHIS
 * - Cursor animado M_SKULL1 e M_SKULL2
 * - Peças do termômetro M_THERML, M_THERMM, M_THERMR, M_THERMO
 * - Fonte STCFN033 a STCFN095 (63 caracteres ASCII 33 a 95)
 * 
 * @param {import('../wad/WadFile.js').WadFile} wad 
 * @returns {Object} Assets decodificados e estatísticas de carregamento
 */
export function loadMenuAssets(wad) {
    // 1. Paleta 0
    const palette = loadPalette0(wad);

    const foundLumps = [];
    const missingLumps = [];

    /**
     * Função auxiliar para carregar e anexar a paleta a um patch.
     * @param {string} name 
     * @param {boolean} required 
     * @returns {Object|null}
     */
    function loadNamedPatch(name, required = false) {
        const lIdx = findLastLump(wad, name);
        if (lIdx < 0) {
            missingLumps.push(name);
            if (required) {
                throw new WadError(`[MenuAssets] Lump obrigatório "${name}" não foi encontrado no arquivo WAD.`);
            }
            return null;
        }

        const patch = decodePatch(wad, name);
        if (!patch) {
            missingLumps.push(name);
            if (required) {
                throw new WadError(`[MenuAssets] Falha ao decodificar patch obrigatório "${name}".`);
            }
            return null;
        }

        patch.name = name;
        patch.palette = palette;
        foundLumps.push(name);
        return patch;
    }

    // 2. Patches principais
    const titlepic = loadNamedPatch('TITLEPIC', false);
    const m_doom = loadNamedPatch('M_DOOM', false);
    const m_optttl = loadNamedPatch('M_OPTTTL', false);
    const m_newg = loadNamedPatch('M_NEWG', false);
    const m_option = loadNamedPatch('M_OPTION', false);
    const m_rdthis = loadNamedPatch('M_RDTHIS', false);
    const m_skull1 = loadNamedPatch('M_SKULL1', false);
    const m_skull2 = loadNamedPatch('M_SKULL2', false);
    const m_therml = loadNamedPatch('M_THERML', false);
    const m_thermm = loadNamedPatch('M_THERMM', false);
    const m_thermr = loadNamedPatch('M_THERMR', false);
    const m_thermo = loadNamedPatch('M_THERMO', false);

    // 3. Fonte: STCFN033 a STCFN095 (63 glifos obrigatórios)
    const font = [];
    for (let c = 33; c <= 95; c++) {
        const lumpName = 'STCFN' + String(c).padStart(3, '0');
        const glyph = loadNamedPatch(lumpName, true); // Erro fatal se faltar
        font.push(glyph);
    }

    if (missingLumps.length > 0) {
        console.warn(`[MenuAssets] Lumps opcionais ausentes no WAD (${missingLumps.length}):`, missingLumps.join(', '));
    }

    return {
        palette,
        titlepic,
        m_doom,
        m_optttl,
        m_newg,
        m_option,
        m_rdthis,
        m_skull1,
        m_skull2,
        m_therml,
        m_thermm,
        m_thermr,
        m_thermo,
        font,
        foundLumps,
        missingLumps,
        dimensions: {
            m_doom: m_doom ? `${m_doom.width}x${m_doom.height}` : 'Ausente',
            m_skull1: m_skull1 ? `${m_skull1.width}x${m_skull1.height}` : 'Ausente',
            m_thermm: m_thermm ? `${m_thermm.width}x${m_thermm.height}` : 'Ausente',
            titlepic: titlepic ? `${titlepic.width}x${titlepic.height}` : 'Ausente',
        },
    };
}
