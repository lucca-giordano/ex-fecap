// Especiais de linha suportados (etapa 20). Puro. Números e comportamento do p_spec.c, p_switch.c e
// p_doors.c do Doom (lembrados de memória). Os demais especiais diferentes de 0 são "não suportados":
// sem efeito, só contados e listados.
//
// trigger: 'use' (tecla E, pelo lado da frente) ou 'cross' (cruzar a linha andando);
// action: 'door' | 'plat' | 'exit'; manual: atua no setor de TRÁS da linha (sem tag);
// repeat: false = uma vez (S1, W1 e portas de uma vez); key: cor da chave; door: tipo da porta.

const S = (n, desc, o) => ({ special: n, desc, ...o });
const manualDoor = (door, repeat, key = null, monsters = false) => ({ trigger: 'use', action: 'door', manual: true, door, repeat, key, monsters });
const tagDoor = (trigger, door, repeat) => ({ trigger, action: 'door', manual: false, door, repeat });
const plat = (trigger, repeat) => ({ trigger, action: 'plat', manual: false, repeat });
const exit = (trigger, secret) => ({ trigger, action: 'exit', manual: false, repeat: false, secret });

export const SPECIALS = {
  // Manuais (uso, setor de trás).
  1: S(1, 'porta normal (DR)', manualDoor('normal', true, null, true)),
  26: S(26, 'porta normal, chave azul (DR)', manualDoor('normal', true, 'blue')),
  27: S(27, 'porta normal, chave amarela (DR)', manualDoor('normal', true, 'yellow')),
  28: S(28, 'porta normal, chave vermelha (DR)', manualDoor('normal', true, 'red')),
  31: S(31, 'porta abre e fica (D1)', manualDoor('open', false)),
  32: S(32, 'porta abre e fica, chave azul (D1)', manualDoor('open', false, 'blue')),
  33: S(33, 'porta abre e fica, chave vermelha (D1)', manualDoor('open', false, 'red')),
  34: S(34, 'porta abre e fica, chave amarela (D1)', manualDoor('open', false, 'yellow')),
  117: S(117, 'porta rápida normal (DR)', manualDoor('blazeRaise', true)),
  118: S(118, 'porta rápida abre e fica (D1)', manualDoor('blazeOpen', false)),
  // Interruptores S1 (uma vez) e SR (repetível), por tag.
  11: S(11, 'saída (S1)', exit('use', false)),
  51: S(51, 'saída secreta (S1)', exit('use', true)),
  21: S(21, 'elevador (S1)', plat('use', false)),
  29: S(29, 'porta normal (S1)', tagDoor('use', 'normal', false)),
  50: S(50, 'fechar porta (S1)', tagDoor('use', 'close', false)),
  103: S(103, 'porta abre e fica (S1)', tagDoor('use', 'open', false)),
  42: S(42, 'fechar porta (SR)', tagDoor('use', 'close', true)),
  61: S(61, 'porta abre e fica (SR)', tagDoor('use', 'open', true)),
  62: S(62, 'elevador (SR)', plat('use', true)),
  63: S(63, 'porta normal (SR)', tagDoor('use', 'normal', true)),
  // Cruzamento W1 (uma vez) e WR (repetível), por tag.
  2: S(2, 'porta abre e fica (W1)', tagDoor('cross', 'open', false)),
  3: S(3, 'fechar porta (W1)', tagDoor('cross', 'close', false)),
  4: S(4, 'porta normal (W1)', tagDoor('cross', 'normal', false)),
  10: S(10, 'elevador (W1)', plat('cross', false)),
  52: S(52, 'saída (W1)', exit('cross', false)),
  124: S(124, 'saída secreta (W1)', exit('cross', true)),
  75: S(75, 'fechar porta (WR)', tagDoor('cross', 'close', true)),
  86: S(86, 'porta abre e fica (WR)', tagDoor('cross', 'open', true)),
  88: S(88, 'elevador (WR)', plat('cross', true)),
  90: S(90, 'porta normal (WR)', tagDoor('cross', 'normal', true)),
};

// Interruptor: especial de uso que não é porta manual (S1 e SR).
export const isSwitchSpecial = (sp) => Boolean(sp) && sp.trigger === 'use' && !sp.manual;

// Chave da cor: cartão ou caveira servem igualmente.
export function hasKeyColor(keys, color) {
  return Boolean(keys[`${color}Card`] || keys[`${color}Skull`]);
}

// Textura de interruptor da sidedef da frente: primeira posição (alta, média, baixa) com SW1 ou SW2.
export function switchTextureOf(side) {
  for (const where of ['upperTexture', 'middleTexture', 'lowerTexture']) {
    if (/^SW[12]/.test(side[where] ?? '')) return { where, name: side[where] };
  }
  return null;
}
export const switchCounterpart = (name) => (name.startsWith('SW1') ? `SW2${name.slice(3)}` : `SW1${name.slice(3)}`);

// Contrapartes de todas as texturas de interruptor usadas no mapa (carregadas junto com as outras,
// para as camadas existirem; acrescentadas DEPOIS dos nomes do mapa, sem mudar as camadas existentes).
export function switchCounterpartNames(map) {
  const out = new Set();
  for (const s of map.sidedefs) {
    for (const t of [s.upperTexture, s.middleTexture, s.lowerTexture]) if (/^SW[12]/.test(t ?? '')) out.add(switchCounterpart(t));
  }
  return out;
}

// Conjuntos dinâmicos do mapa: setores que se movem (portas e elevadores) e relatório.
// Manuais: o setor de trás da linha; remotos de porta ou elevador: os setores da tag.
// Devolve { movableSectors: Set, switchLines: Set, unsupported: Map especial -> [linhas], warnings: [] }.
export function analyzeSpecials(map, tagMap) {
  const movableSectors = new Set();
  const switchLines = new Set();
  const unsupported = new Map();
  const warnings = [];
  map.linedefs.forEach((line, li) => {
    if (!line.special) return;
    const sp = SPECIALS[line.special];
    if (!sp) {
      if (!unsupported.has(line.special)) unsupported.set(line.special, []);
      unsupported.get(line.special).push(li);
      return;
    }
    if (sp.action === 'door' && sp.manual) {
      if (line.leftSidedef === 0xFFFF) warnings.push(`linha ${li}: porta manual (${line.special}) sem lado de trás`);
      else movableSectors.add(map.sidedefs[line.leftSidedef].sector);
    } else if (sp.action === 'door' || sp.action === 'plat') {
      if (line.tag === 0) warnings.push(`linha ${li}: especial ${line.special} com tag 0 (ignorado)`);
      const sectors = tagMap.get(line.tag) ?? [];
      if (line.tag !== 0 && sectors.length === 0) warnings.push(`linha ${li}: tag ${line.tag} sem setor`);
      if (line.tag !== 0) for (const s of sectors) movableSectors.add(s);
    }
    if (isSwitchSpecial(sp) && switchTextureOf(map.sidedefs[line.rightSidedef])) switchLines.add(li);
  });
  return { movableSectors, switchLines, unsupported, warnings };
}
