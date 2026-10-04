import { MENU_LANG, MENU_TEXTS } from './menuText.js';
import { ACTION_KEYS } from '../input/Controls.js';

const WIDTH = 320;
const HEIGHT = 200;
const SKULLXOFF = -32;

/**
 * Desenha um patch decodificado no buffer RGBA de 320x200.
 * Aplica os offsets do cabeçalho como V_DrawPatch do Doom: (x - leftOffset, y - topOffset).
 * Pixels transparentes não são desenhados.
 * 
 * @param {Uint8ClampedArray|Uint8Array} buffer Buffer RGBA de 320x200x4
 * @param {Object} patch Patch decodificado
 * @param {number} x Coordenada X de destino
 * @param {number} y Coordenada Y de destino
 * @param {Uint8Array} [palette=patch.palette] Paleta RGB de 256 cores (768 bytes)
 */
export function drawPatch(buffer, patch, x, y, palette = patch?.palette) {
    if (!patch || !patch.columns || !palette) return;

    const startX = Math.floor(x - (patch.leftOffset || 0));
    const startY = Math.floor(y - (patch.topOffset || 0));

    for (let col = 0; col < patch.width; col++) {
        const destX = startX + col;
        if (destX < 0 || destX >= WIDTH) continue;

        const posts = patch.columns[col];
        if (!posts) continue;

        for (let p = 0; p < posts.length; p++) {
            const post = posts[p];
            for (let r = 0; r < post.length; r++) {
                const destY = startY + post.topDelta + r;
                if (destY < 0 || destY >= HEIGHT) continue;

                const colorIdx = post.pixels[r];
                const destIdx = (destY * WIDTH + destX) * 4;
                const palIdx = colorIdx * 3;

                buffer[destIdx + 0] = palette[palIdx + 0];
                buffer[destIdx + 1] = palette[palIdx + 1];
                buffer[destIdx + 2] = palette[palIdx + 2];
                buffer[destIdx + 3] = 255;
            }
        }
    }
}

/**
 * Normaliza um texto removendo acentos e convertendo para maiúsculas.
 * @param {string} text 
 * @returns {string}
 */
function cleanString(text) {
    if (!text) return '';
    return String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

/**
 * Mede a largura em pixels de uma string ao ser desenhada com a fonte do Doom.
 * @param {Array<Object>} font Array de 63 glifos (ASCII 33 a 95)
 * @param {string} text Texto a medir
 * @returns {number} Largura em pixels
 */
export function measureText(font, text) {
    if (!text) return 0;
    const clean = cleanString(text);
    let curWidth = 0;
    let maxWidth = 0;

    for (let i = 0; i < clean.length; i++) {
        const char = clean[i];
        if (char === '\n') {
            if (curWidth > maxWidth) maxWidth = curWidth;
            curWidth = 0;
            continue;
        }

        const c = char.charCodeAt(0) - 33;
        if (c < 0 || c >= 63 || !font || !font[c]) {
            curWidth += 4; // Espaço ou caractere sem glifo
        } else {
            curWidth += font[c].width;
        }
    }

    return Math.max(curWidth, maxWidth);
}

/**
 * Desenha uma string com a fonte do Doom (M_WriteText).
 * '\n' avança Y em 12 pixels e retorna X ao início.
 * 
 * @param {Uint8ClampedArray|Uint8Array} buffer 
 * @param {Array<Object>} font Array de glifos
 * @param {string} text Texto a desenhar
 * @param {number} x Coordenada X inicial
 * @param {number} y Coordenada Y inicial
 * @returns {number} Coordenada X final
 */
export function drawText(buffer, font, text, x, y) {
    if (!text) return x;
    const clean = cleanString(text);
    let curX = x;
    let curY = y;

    for (let i = 0; i < clean.length; i++) {
        const char = clean[i];
        if (char === '\n') {
            curY += 12;
            curX = x;
            continue;
        }

        const c = char.charCodeAt(0) - 33;
        if (c < 0 || c >= 63 || !font || !font[c]) {
            curX += 4;
        } else {
            const glyph = font[c];
            drawPatch(buffer, glyph, curX, curY);
            curX += glyph.width;
        }
    }

    return curX;
}

/**
 * Desenha um termômetro deslizante estilo Doom (M_DrawThermo).
 * @param {Uint8ClampedArray|Uint8Array} buffer 
 * @param {Object} assets 
 * @param {number} x 
 * @param {number} y 
 * @param {number} largura Número de células intermediárias (10)
 * @param {number} posicao Posição do marcador (0 a 9 para níveis 1 a 10)
 */
export function drawThermo(buffer, assets, x, y, largura, posicao) {
    // Tratamento de peças ausentes: desenha valor numérico simples
    if (!assets.m_therml || !assets.m_thermm || !assets.m_thermr || !assets.m_thermo) {
        drawText(buffer, assets.font, String(posicao + 1), x, y);
        return;
    }

    // 1. Ponta esquerda
    drawPatch(buffer, assets.m_therml, x, y);

    // 2. Células do meio
    let xx = x + 8;
    for (let i = 0; i < largura; i++) {
        drawPatch(buffer, assets.m_thermm, xx, y);
        xx += 8;
    }

    // 3. Ponta direita
    drawPatch(buffer, assets.m_thermr, xx, y);

    // 4. Marcador móvel
    const clampedPos = Math.max(0, Math.min(posicao, largura - 1));
    drawPatch(buffer, assets.m_thermo, x + 8 + clampedPos * 8, y);
}

/**
 * Compõe o quadro completo do menu em uma imagem RGBA de 320x200 pixels.
 * Função pura e desacoplada do WebGPU/DOM.
 * 
 * @param {Object} estado Estado do menu (currentScreen, selectedItem, started, resumeFailed, settings, isFullscreen)
 * @param {Object} assets Assets carregados do WAD
 * @param {number} tempo Tempo em segundos para animação da caveira
 * @param {string} [lang=MENU_LANG] Idioma ("en" ou "pt")
 * @returns {Uint8ClampedArray} Imagem RGBA de 320x200x4 (1280 bytes por linha)
 */
export function composeMenu(estado, assets, tempo = 0, lang = MENU_LANG) {
    const buffer = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
    const texts = MENU_TEXTS[lang] || MENU_TEXTS.en;

    // Cálculo do quadro da caveira (alterna a cada 8 tics, a 35 tics/s)
    const skullIdx = Math.floor((tempo * 35.0) / 8.0) % 2;
    const skullPatch = (skullIdx === 0 ? assets.m_skull1 : assets.m_skull2) || assets.m_skull1;

    /**
     * Auxiliar para desenhar o cursor de caveira.
     * @param {number} itemX 
     * @param {number} itemY 
     * @param {boolean} isTextItem 
     */
    function drawSkullCursor(itemX, itemY, isTextItem = false) {
        const skullX = itemX + SKULLXOFF;
        let skullY;
        if (isTextItem && skullPatch) {
            skullY = itemY + Math.floor((12 - skullPatch.height) / 2);
        } else {
            skullY = itemY - 5;
        }

        if (skullPatch) {
            drawPatch(buffer, skullPatch, skullX, skullY);
        } else if (assets.font) {
            drawText(buffer, assets.font, '>', skullX + 24, itemY);
        }
    }

    const screen = estado.currentScreen || 'main';

    // -------------------------------------------------------------
    // TELA: READ THIS! (Ajuda com lista de controles)
    // -------------------------------------------------------------
    if (screen === 'help') {
        // Fundo preto opaco
        buffer.fill(0);
        for (let i = 3; i < buffer.length; i += 4) {
            buffer[i] = 255;
        }

        // Título centralizado
        const titleW = measureText(assets.font, texts.controlsTitle);
        drawText(buffer, assets.font, texts.controlsTitle, Math.floor((WIDTH - titleW) / 2), 15);

        // Duas colunas com rótulo legível e nome da ação lidos de ACTION_KEYS
        const entries = Object.entries(ACTION_KEYS);
        const mid = Math.ceil(entries.length / 2);
        const col1 = entries.slice(0, mid);
        const col2 = entries.slice(mid);

        let curY = 36;
        for (const [action, def] of col1) {
            const line = `${def.label} ${action}`;
            drawText(buffer, assets.font, line, 8, curY);
            curY += 12;
        }

        curY = 36;
        for (const [action, def] of col2) {
            const line = `${def.label} ${action}`;
            drawText(buffer, assets.font, line, 160, curY);
            curY += 12;
        }

        // Rodapé centralizado em Y = 185
        const footW = measureText(assets.font, texts.returnFooter);
        drawText(buffer, assets.font, texts.returnFooter, Math.floor((WIDTH - footW) / 2), 185);

        // A caveira NUNCA é desenhada na tela READ THIS!
        return buffer;
    }

    // -------------------------------------------------------------
    // TELA: OPÇÕES
    // -------------------------------------------------------------
    if (screen === 'options') {
        // Se ainda não começou, desenha o TITLEPIC como fundo
        if (!estado.started && assets.titlepic) {
            drawPatch(buffer, assets.titlepic, 0, 0);
        }

        // Título
        if (lang === 'en' && assets.m_optttl) {
            drawPatch(buffer, assets.m_optttl, 108, 15);
        } else {
            const titleW = measureText(assets.font, texts.optionsTitle);
            drawText(buffer, assets.font, texts.optionsTitle, Math.floor((WIDTH - titleW) / 2), 15);
        }

        const optSettings = estado.settings || {};
        const isRetro = (optSettings.visualMode === 'retro' || !optSettings.visualMode);
        const isCrt = optSettings.crt ?? true;
        const isLight = optSettings.lighting ?? true;
        const isParticles = optSettings.particles ?? true;
        const isSprites = optSettings.sprites ?? true;
        const isFull = Boolean(estado.isFullscreen);
        const sensLevel = optSettings.mouseSensitivityLevel ?? 5;
        const speedLevel = optSettings.flySpeedLevel ?? 5;

        // Lista de itens e posições Y (todos terminam acima de y = 190)
        // Ordem: VISUAL, CRT, LIGHTING, PARTICLES, SPRITES, FULLSCREEN, SENSITIVITY, FLY SPEED, TUNING, DEBUG
        const itemYPositions = [30, 41, 52, 63, 74, 85, 97, 120, 144, 157];

        // 0. VISUAL
        drawText(buffer, assets.font, texts.visual, 60, itemYPositions[0]);
        drawText(buffer, assets.font, isRetro ? texts.valRetro : texts.valModern, 210, itemYPositions[0]);

        // 1. CRT
        drawText(buffer, assets.font, texts.crt, 60, itemYPositions[1]);
        drawText(buffer, assets.font, isCrt ? texts.valOn : texts.valOff, 210, itemYPositions[1]);

        // 2. LIGHTING
        drawText(buffer, assets.font, texts.lighting, 60, itemYPositions[2]);
        drawText(buffer, assets.font, isLight ? texts.valOn : texts.valOff, 210, itemYPositions[2]);

        // 3. PARTICLES
        drawText(buffer, assets.font, texts.particles, 60, itemYPositions[3]);
        drawText(buffer, assets.font, isParticles ? texts.valOn : texts.valOff, 210, itemYPositions[3]);

        // 4. SPRITES (ON/OFF)
        drawText(buffer, assets.font, texts.sprites, 60, itemYPositions[4]);
        drawText(buffer, assets.font, isSprites ? texts.valOn : texts.valOff, 210, itemYPositions[4]);

        // 5. FULLSCREEN
        drawText(buffer, assets.font, texts.fullscreen, 60, itemYPositions[5]);
        drawText(buffer, assets.font, isFull ? texts.valOn : texts.valOff, 210, itemYPositions[5]);

        // 6. MOUSE SENSITIVITY (termômetro)
        drawText(buffer, assets.font, texts.mouseSensitivity, 60, itemYPositions[6]);
        drawThermo(buffer, assets, 60, itemYPositions[6] + 9, 10, sensLevel - 1);

        // 7. FLY SPEED (termômetro)
        drawText(buffer, assets.font, texts.flySpeed, 60, itemYPositions[7]);
        drawThermo(buffer, assets, 60, itemYPositions[7] + 9, 10, speedLevel - 1);

        // 8. PARTICLE TUNING (abre o painel)
        drawText(buffer, assets.font, texts.particleTuning, 60, itemYPositions[8]);

        // 9. DEBUG (submenu)
        drawText(buffer, assets.font, texts.debug, 60, itemYPositions[9]);

        // Cursor da caveira
        const selected = Math.max(0, Math.min(estado.selectedItem?.options ?? 0, 9));
        drawSkullCursor(60, itemYPositions[selected], true);

        return buffer;
    }

    // -------------------------------------------------------------
    // TELA: SUBMENU DEBUG
    // -------------------------------------------------------------
    if (screen === 'debug') {
        if (!estado.started && assets.titlepic) {
            drawPatch(buffer, assets.titlepic, 0, 0);
        }

        // Título centralizado
        const titleW = measureText(assets.font, texts.debugTitle);
        drawText(buffer, assets.font, texts.debugTitle, Math.floor((WIDTH - titleW) / 2), 15);

        const dbgSettings = estado.settings || {};
        const isTex = dbgSettings.textured ?? true;
        const isSec = dbgSettings.sectorColors ?? false;
        const isCull = dbgSettings.culling ?? true;
        const isSky = dbgSettings.skyTest ?? false;
        const isHud = dbgSettings.hud ?? true;

        const startY = 36;
        const spacing = 12;

        // 0. TEXTURES
        drawText(buffer, assets.font, texts.textures, 60, startY + 0 * spacing);
        drawText(buffer, assets.font, isTex ? texts.valOn : texts.valOff, 210, startY + 0 * spacing);

        // 1. SECTOR COLORS
        drawText(buffer, assets.font, texts.sectorColors, 60, startY + 1 * spacing);
        drawText(buffer, assets.font, isSec ? texts.valOn : texts.valOff, 210, startY + 1 * spacing);

        // 2. BACKFACE CULLING
        drawText(buffer, assets.font, texts.culling, 60, startY + 2 * spacing);
        drawText(buffer, assets.font, isCull ? texts.valOn : texts.valOff, 210, startY + 2 * spacing);

        // 3. SKY TEST
        drawText(buffer, assets.font, texts.skyTest, 60, startY + 3 * spacing);
        drawText(buffer, assets.font, isSky ? texts.valOn : texts.valOff, 210, startY + 3 * spacing);

        // 4. HUD
        drawText(buffer, assets.font, texts.hud, 60, startY + 4 * spacing);
        drawText(buffer, assets.font, isHud ? texts.valOn : texts.valOff, 210, startY + 4 * spacing);

        // 5. RESET DEFAULTS
        drawText(buffer, assets.font, texts.resetDefaults, 60, startY + 5 * spacing);

        // Cursor da caveira
        const selected = Math.max(0, Math.min(estado.selectedItem?.debug ?? 0, 5));
        drawSkullCursor(60, startY + selected * spacing, true);

        return buffer;
    }

    // -------------------------------------------------------------
    // TELA PRINCIPAL / TÍTULO (screen === 'main')
    // -------------------------------------------------------------
    // Se o jogo ainda não iniciou, renderiza o TITLEPIC ao fundo
    if (!estado.started) {
        if (assets.titlepic) {
            drawPatch(buffer, assets.titlepic, 0, 0);
        } else {
            buffer.fill(0);
            for (let i = 3; i < buffer.length; i += 4) buffer[i] = 255;
        }
    }

    // Logo M_DOOM em (94, 2)
    if (assets.m_doom) {
        drawPatch(buffer, assets.m_doom, 94, 2);
    } else {
        const logoW = measureText(assets.font, 'DOOM');
        drawText(buffer, assets.font, 'DOOM', Math.floor((WIDTH - logoW) / 2), 15);
    }

    // Itens do Menu Principal (x = 97, primeiro em y = 64, espaçamento 16)
    // Item 0: NEW GAME
    if (lang === 'en' && assets.m_newg) {
        drawPatch(buffer, assets.m_newg, 97, 64);
    } else {
        drawText(buffer, assets.font, texts.newGame, 97, 64);
    }

    // Item 1: OPTIONS
    if (lang === 'en' && assets.m_option) {
        drawPatch(buffer, assets.m_option, 97, 80);
    } else {
        drawText(buffer, assets.font, texts.options, 97, 80);
    }

    // Item 2: READ THIS!
    if (lang === 'en' && assets.m_rdthis) {
        drawPatch(buffer, assets.m_rdthis, 97, 96);
    } else {
        drawText(buffer, assets.font, texts.readThis, 97, 96);
    }

    // Cursor da caveira em x = 97 + SKULLXOFF (= 65), y = (y do item) - 5
    const selected = Math.max(0, Math.min(estado.selectedItem?.main ?? 0, 2));
    const itemY = 64 + selected * 16;
    drawSkullCursor(97, itemY, false);

    // Mensagem "CLICK TO RESUME" quando started = true e o pedido de pointer lock falhou
    if (estado.started && estado.resumeFailed) {
        const resumeW = measureText(assets.font, texts.clickToResume);
        drawText(buffer, assets.font, texts.clickToResume, Math.floor((WIDTH - resumeW) / 2), 185);
    }

    return buffer;
}
