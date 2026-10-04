// Linhas e páginas da tela READ THIS!. Puro. Separado do MenuRenderer para o Menu contar as páginas
// sem importar o desenho.

import { ACTION_KEYS } from '../input/Controls.js';

// Layout: duas colunas, linhas de 12 pixels a partir de y = 28; o texto não passa de y = 180 e o
// rodapé fica em y = 185.
export const HELP = { titleY: 15, y: 28, line: 12, colX: [4, 162], nameDx: 54, footerY: 185, maxBottom: 180, glyphH: 7 };
// Linhas por coluna: y + (n - 1) * line + glyphH <= maxBottom.
export const HELP_ROWS = Math.floor((HELP.maxBottom - HELP.glyphH - HELP.y) / HELP.line) + 1;

// Linhas: [tecla, ação]. Grupos numa linha só: setas ('tuning'), armas ('weapons') e roda ('wheel').
export function helpEntries(T) {
  const entries = [];
  const groups = { tuning: [T.arrowsKey, T.arrowsAction], weapons: [T.weaponsKey, T.weaponsAction], wheel: [T.wheelKey, T.wheelAction] };
  const seen = new Set();
  for (const [action, k] of Object.entries(ACTION_KEYS)) {
    if (k.group) {
      if (!seen.has(k.group)) entries.push(groups[k.group]);
      seen.add(k.group);
      continue;
    }
    entries.push([T.keyLabels[k.code] ?? k.label, T.actions[action]]);
  }
  entries.push([T.escKey, T.escAction]);
  return entries;
}

// Páginas equilibradas: cada uma com até 2 * HELP_ROWS linhas.
export function helpPages(T) {
  const entries = helpEntries(T);
  const count = Math.max(1, Math.ceil(entries.length / (2 * HELP_ROWS)));
  const per = Math.ceil(entries.length / count);
  return Array.from({ length: count }, (_, i) => entries.slice(i * per, (i + 1) * per));
}
