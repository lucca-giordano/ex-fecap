/**
 * Tabela única de textos do menu do Doom por idioma.
 * Idiomas suportados: "en" (inglês, padrão) e "pt" (português sem diacríticos).
 */
export const MENU_LANG = 'en';

export const MENU_TEXTS = Object.freeze({
    en: {
        // Menu Principal
        newGame: 'NEW GAME',
        options: 'OPTIONS',
        readThis: 'READ THIS!',

        // Tela de Opções
        optionsTitle: 'OPTIONS',
        visual: 'VISUAL',
        crt: 'CRT',
        lighting: 'LIGHTING',
        particles: 'PARTICLES',
        sprites: 'SPRITES',
        fullscreen: 'FULLSCREEN',
        mouseSensitivity: 'MOUSE SENSITIVITY',
        flySpeed: 'FLY SPEED',
        particleTuning: 'PARTICLE TUNING',
        debug: 'DEBUG',

        // Valores de Opções
        valRetro: 'RETRO',
        valModern: 'MODERN',
        valOn: 'ON',
        valOff: 'OFF',

        // Submenu Debug
        debugTitle: 'DEBUG',
        textures: 'TEXTURES',
        sectorColors: 'SECTOR COLORS',
        culling: 'BACKFACE CULLING',
        skyTest: 'SKY TEST',
        hud: 'HUD',
        resetDefaults: 'RESET DEFAULTS',

        // Tela READ THIS!
        controlsTitle: 'CONTROLS',
        returnFooter: 'ESC OR ENTER TO RETURN',

        // Mensagem de recuperação de bloqueio de ponteiro
        clickToResume: 'CLICK TO RESUME',
    },
    pt: {
        // Menu Principal
        newGame: 'NOVO JOGO',
        options: 'OPCOES',
        readThis: 'AJUDA',

        // Tela de Opções
        optionsTitle: 'OPCOES',
        visual: 'VISUAL',
        crt: 'CRT',
        lighting: 'ILUMINACAO',
        particles: 'PARTICULAS',
        sprites: 'SPRITES',
        fullscreen: 'TELA CHEIA',
        mouseSensitivity: 'SENSIBILIDADE',
        flySpeed: 'VELOCIDADE VOO',
        particleTuning: 'CALIBRAGEM DE PARTICULAS',
        debug: 'DEPURACAO',

        // Valores de Opções
        valRetro: 'RETRO',
        valModern: 'MODERNO',
        valOn: 'LIG',
        valOff: 'DESL',

        // Submenu Debug
        debugTitle: 'DEPURACAO',
        textures: 'TEXTURAS',
        sectorColors: 'CORES SETOR',
        culling: 'CULLING',
        skyTest: 'TESTE CEU',
        hud: 'HUD',
        resetDefaults: 'RESTAURAR PADROES',

        // Tela READ THIS!
        controlsTitle: 'CONTROLES',
        returnFooter: 'ESC OU ENTER PARA VOLTAR',

        // Mensagem de recuperação de bloqueio de ponteiro
        clickToResume: 'CLIQUE PARA CONTINUAR',
    },
});
