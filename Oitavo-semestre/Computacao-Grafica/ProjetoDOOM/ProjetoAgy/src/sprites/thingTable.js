/**
 * Tabela única de tipos de entidades (THINGS) do Doom e regras de visualização de sprites.
 * Mapeia cada tipo para: prefixo do sprite (4 chars), sequência de quadros (frames),
 * duração por quadro em tics (tics), se possui iluminação máxima (fullbright) e se possui efeito fuzz (fuzz).
 */

export const SKILL = 3;

// Tipos de entidades sem representação gráfica 3D (ignorados silenciosamente)
export const SILENT_IGNORES = new Set([
    1,    // Início do Jogador 1
    2,    // Início do Jogador 2
    3,    // Início do Jogador 3
    4,    // Início do Jogador 4
    11,   // Início Deathmatch
    2010, // Destino de teleporte
]);

/**
 * Definições canônicas de tipos de objetos.
 * Tipos não presentes nesta tabela ou cujos lumps não existirem no WAD
 * são marcados como "não resolvidos" e não são desenhados.
 */
export const THING_TABLE = Object.freeze({
    // --- Inimigos ---
    3004: { name: 'Former Human', prefix: 'POSS', frames: 'AB', tics: 10, fullbright: false, fuzz: false },
    9:    { name: 'Shotgun Guy', prefix: 'SPOS', frames: 'AB', tics: 10, fullbright: false, fuzz: false },
    3001: { name: 'Imp', prefix: 'TROO', frames: 'AB', tics: 10, fullbright: false, fuzz: false },
    3002: { name: 'Demon (Pinky)', prefix: 'SARG', frames: 'AB', tics: 10, fullbright: false, fuzz: false },
    58:   { name: 'Spectre (Fuzz)', prefix: 'SARG', frames: 'AB', tics: 10, fullbright: false, fuzz: true },
    3005: { name: 'Cacodemon', prefix: 'HEAD', frames: 'A', tics: 10, fullbright: false, fuzz: false },
    3006: { name: 'Lost Soul', prefix: 'SKUL', frames: 'AB', tics: 6, fullbright: false, fuzz: false },
    3003: { name: 'Baron of Hell', prefix: 'BOSS', frames: 'AB', tics: 10, fullbright: false, fuzz: false },

    // --- Armas e Munição ---
    2001: { name: 'Shotgun', prefix: 'SHOT', frames: 'A', tics: 10, fullbright: false, fuzz: false },
    2002: { name: 'Chaingun', prefix: 'MGUN', frames: 'A', tics: 10, fullbright: false, fuzz: false },
    2003: { name: 'Rocket Launcher', prefix: 'LAUN', frames: 'A', tics: 10, fullbright: false, fuzz: false },
    2004: { name: 'Plasma Rifle', prefix: 'PLAS', frames: 'A', tics: 10, fullbright: false, fuzz: false },
    2005: { name: 'Chainsaw', prefix: 'CSAW', frames: 'A', tics: 10, fullbright: false, fuzz: false },
    2007: { name: 'Ammo Clip', prefix: 'CLIP', frames: 'A', tics: 10, fullbright: false, fuzz: false },
    2008: { name: 'Shotgun Shells', prefix: 'SHEL', frames: 'A', tics: 10, fullbright: false, fuzz: false },
    2048: { name: 'Box of Bullets', prefix: 'AMMO', frames: 'A', tics: 10, fullbright: false, fuzz: false },
    2049: { name: 'Box of Shells', prefix: 'SBOX', frames: 'A', tics: 10, fullbright: false, fuzz: false },
    2046: { name: 'Box of Rockets', prefix: 'BROK', frames: 'A', tics: 10, fullbright: false, fuzz: false },
    2047: { name: 'Energy Cell', prefix: 'CELL', frames: 'A', tics: 10, fullbright: false, fuzz: false },
    17:   { name: 'Cell Pack', prefix: 'CELP', frames: 'A', tics: 10, fullbright: false, fuzz: false },
    8:    { name: 'Backpack', prefix: 'BPAK', frames: 'A', tics: 10, fullbright: false, fuzz: false },

    // --- Saúde e Armadura ---
    2011: { name: 'Stimpack', prefix: 'STIM', frames: 'A', tics: 10, fullbright: false, fuzz: false },
    2012: { name: 'Medikit', prefix: 'MEDI', frames: 'A', tics: 10, fullbright: false, fuzz: false },
    2014: { name: 'Health Bonus', prefix: 'BON1', frames: 'ABCDCB', tics: 6, fullbright: false, fuzz: false },
    2015: { name: 'Armor Bonus', prefix: 'BON2', frames: 'ABCDCB', tics: 6, fullbright: false, fuzz: false },
    2018: { name: 'Green Armor', prefix: 'ARM1', frames: 'AB', tics: 6, fullbright: false, fuzz: false },
    2019: { name: 'Blue Armor', prefix: 'ARM2', frames: 'AB', tics: 6, fullbright: false, fuzz: false },

    // --- Poderes (Fullbright) ---
    2013: { name: 'Soul Sphere', prefix: 'SOUL', frames: 'ABCDCB', tics: 6, fullbright: true, fuzz: false },
    2023: { name: 'Berserk', prefix: 'PSTR', frames: 'A', tics: 10, fullbright: true, fuzz: false },
    2024: { name: 'Invisibility', prefix: 'PINS', frames: 'ABCD', tics: 6, fullbright: true, fuzz: false },
    2025: { name: 'Radiation Suit', prefix: 'SUIT', frames: 'A', tics: 10, fullbright: true, fuzz: false },
    2026: { name: 'Computer Map', prefix: 'PMAP', frames: 'ABCDCB', tics: 6, fullbright: true, fuzz: false },
    2045: { name: 'Light Amplification', prefix: 'PVIS', frames: 'AB', tics: 6, fullbright: true, fuzz: false },
    2022: { name: 'Invulnerability', prefix: 'PINV', frames: 'ABCD', tics: 6, fullbright: true, fuzz: false },

    // --- Chaves ---
    5:    { name: 'Blue Keycard', prefix: 'BKEY', frames: 'AB', tics: 10, fullbright: false, fuzz: false },
    6:    { name: 'Yellow Keycard', prefix: 'YKEY', frames: 'AB', tics: 10, fullbright: false, fuzz: false },
    13:   { name: 'Red Keycard', prefix: 'RKEY', frames: 'AB', tics: 10, fullbright: false, fuzz: false },
    40:   { name: 'Blue Skull Key', prefix: 'BSKU', frames: 'AB', tics: 10, fullbright: false, fuzz: false },
    39:   { name: 'Yellow Skull Key', prefix: 'YSKU', frames: 'AB', tics: 10, fullbright: false, fuzz: false },
    38:   { name: 'Red Skull Key', prefix: 'RSKU', frames: 'AB', tics: 10, fullbright: false, fuzz: false },

    // --- Decoração e Obstáculos ---
    2035: { name: 'Exploding Barrel', prefix: 'BAR1', frames: 'AB', tics: 6, fullbright: false, fuzz: false },
    2028: { name: 'Floor Lamp', prefix: 'COLU', frames: 'A', tics: 10, fullbright: true, fuzz: false },
    48:   { name: 'Tech Column', prefix: 'ELEC', frames: 'A', tics: 10, fullbright: false, fuzz: false },
    44:   { name: 'Tall Blue Torch', prefix: 'TBLU', frames: 'ABCD', tics: 4, fullbright: true, fuzz: false },
    45:   { name: 'Tall Green Torch', prefix: 'TGRN', frames: 'ABCD', tics: 4, fullbright: true, fuzz: false },
    46:   { name: 'Tall Red Torch', prefix: 'TRED', frames: 'ABCD', tics: 4, fullbright: true, fuzz: false },
    55:   { name: 'Short Blue Torch', prefix: 'SMBT', frames: 'ABCD', tics: 4, fullbright: true, fuzz: false },
    56:   { name: 'Short Green Torch', prefix: 'SMGT', frames: 'ABCD', tics: 4, fullbright: true, fuzz: false },
    57:   { name: 'Short Red Torch', prefix: 'SMRT', frames: 'ABCD', tics: 4, fullbright: true, fuzz: false },
    70:   { name: 'Burning Candelabra', prefix: 'FCAN', frames: 'ABC', tics: 4, fullbright: true, fuzz: false },
    85:   { name: 'Tech Lamp', prefix: 'TLMP', frames: 'ABCD', tics: 4, fullbright: true, fuzz: false },
    86:   { name: 'Tech Lamp 2', prefix: 'TLP2', frames: 'ABCD', tics: 4, fullbright: true, fuzz: false },

    // --- Decorações Adicionais e Corpos do E1M1 ---
    10:   { name: 'Bloody Mess', prefix: 'PLAY', frames: 'W', tics: 10, fullbright: false, fuzz: false },
    12:   { name: 'Bloody Mess 2', prefix: 'PLAY', frames: 'W', tics: 10, fullbright: false, fuzz: false },
    15:   { name: 'Dead Player', prefix: 'PLAY', frames: 'N', tics: 10, fullbright: false, fuzz: false },
    18:   { name: 'Dead Former Human', prefix: 'POSS', frames: 'L', tics: 10, fullbright: false, fuzz: false },
    19:   { name: 'Dead Shotgun Guy', prefix: 'SPOS', frames: 'L', tics: 10, fullbright: false, fuzz: false },
    20:   { name: 'Dead Imp', prefix: 'TROO', frames: 'M', tics: 10, fullbright: false, fuzz: false },
    21:   { name: 'Dead Demon', prefix: 'SARG', frames: 'N', tics: 10, fullbright: false, fuzz: false },
    24:   { name: 'Pool of Blood/Flesh', prefix: 'POL5', frames: 'A', tics: 10, fullbright: false, fuzz: false },
    26:   { name: 'Pool of Guts', prefix: 'POL6', frames: 'AB', tics: 6, fullbright: false, fuzz: false },
    43:   { name: 'Burnt Tree', prefix: 'TRE1', frames: 'A', tics: 10, fullbright: false, fuzz: false },
    47:   { name: 'Brown Tree Stub', prefix: 'TRE2', frames: 'A', tics: 10, fullbright: false, fuzz: false },
    54:   { name: 'Big Tree', prefix: 'TRE2', frames: 'A', tics: 10, fullbright: false, fuzz: false },
    60:   { name: 'Hanging Legs', prefix: 'GOR1', frames: 'ABC', tics: 6, fullbright: false, fuzz: false },
});

/**
 * Filtra entidades (THINGS) com base nas flags de dificuldade e multiplayer.
 * @param {Array<Object>} things Lista de entidades lidas do lump THINGS
 * @param {number} [skill=SKILL] Nível de habilidade (1 a 5)
 * @returns {Object} { kept, discardedMultiplayer, discardedSkill }
 */
export function filterThingsBySkill(things, skill = SKILL) {
    let skillBit = 0x0002;
    if (skill <= 2) {
        skillBit = 0x0001;
    } else if (skill === 3) {
        skillBit = 0x0002;
    } else {
        skillBit = 0x0004;
    }

    const kept = [];
    let discardedMultiplayer = 0;
    let discardedSkill = 0;

    for (const th of things) {
        // Flag 0x0010: apenas multiplayer (não deve ser criada em single-player)
        if ((th.flags & 0x0010) !== 0) {
            discardedMultiplayer++;
            continue;
        }

        // Bit de dificuldade
        if ((th.flags & skillBit) === 0) {
            discardedSkill++;
            continue;
        }

        kept.push(th);
    }

    return { kept, discardedMultiplayer, discardedSkill };
}
