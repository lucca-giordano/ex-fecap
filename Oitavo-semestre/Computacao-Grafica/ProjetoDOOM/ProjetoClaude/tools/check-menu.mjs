// Verificação do menu sem navegador: compõe cada tela nos dois idiomas com os módulos puros e
// confere pixels desenhados e limites de texto. Uso: node tools/check-menu.mjs
// Sai com código diferente de zero se algo falhar.

import fs from 'node:fs';
import { WadFile } from '../src/wad/WadFile.js';
import { loadMenuAssets } from '../src/menu/MenuAssets.js';
import { composeMenu, measureText, helpEntries, helpPages, MENU_WIDTH, MENU_HEIGHT, MENU_LAYOUT } from '../src/menu/MenuRenderer.js';
import { SCREENS } from '../src/menu/Menu.js';
import { MENU_TEXT } from '../src/menu/menuText.js';

const WAD_PATH = new URL('../assets/freedoom1.wad', import.meta.url);

const bytes = fs.readFileSync(WAD_PATH);
const wad = new WadFile(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const assets = loadMenuAssets(wad);
console.log(`Lumps encontrados: ${assets.found.length}; ausentes: ${assets.missing.join(', ') || 'nenhum'}`);

const values = (level) => ({
  visualMode: 'moderno', crt: true, lighting: false, fullscreen: false,
  mouseSensitivityLevel: level, flySpeedLevel: level,
  textured: true, sectorColors: false, culling: true, skyTest: false, hud: true,
  particles: true, sprites: true, moveMode: 'walk', sfxVolumeLevel: Math.min(15, level),
  monsterAI: true, noTarget: level > 5,
});

// Casos: nome, estado.
const cases = [];
for (const lang of ['en', 'pt']) {
  cases.push([`${lang} título + principal`, { lang, screen: 'main', selected: 0, started: false, resumeFailed: false, values: values(5) }]);
  cases.push([`${lang} principal sobre o jogo (resume falhou)`, { lang, screen: 'main', selected: 2, started: true, resumeFailed: true, values: values(5) }]);
  cases.push([`${lang} opções (nível 1)`, { lang, screen: 'options', selected: 4, started: true, resumeFailed: false, values: values(1) }]);
  cases.push([`${lang} opções (nível 10)`, { lang, screen: 'options', selected: 6, started: false, resumeFailed: false, values: values(10) }]);
  cases.push([`${lang} debug`, { lang, screen: 'debug', selected: 5, started: true, resumeFailed: true, values: values(5) }]);
  cases.push([`${lang} game debug`, { lang, screen: 'gameDebug', selected: 6, started: true, resumeFailed: true, values: values(5) }]);
  cases.push([`${lang} monster debug`, { lang, screen: 'monsterDebug', selected: 1, started: true, resumeFailed: true, values: values(10) }]);
  cases.push([`${lang} extras`, { lang, screen: 'extras', selected: 2, started: true, resumeFailed: false, values: values(5) }]);
  cases.push([`${lang} opções (volume 0)`, { lang, screen: 'options', selected: 4, started: true, resumeFailed: false,
    values: { ...values(1), sfxVolumeLevel: 0 } }]);
  cases.push([`${lang} opções (volume 15)`, { lang, screen: 'options', selected: 4, started: true, resumeFailed: false,
    values: { ...values(10), sfxVolumeLevel: 15 } }]);
  // Etapa 17: uma composição por página da ajuda.
  helpPages(MENU_TEXT[lang]).forEach((_, page) => {
    cases.push([`${lang} read this página ${page + 1}`, { lang, screen: 'help', helpPage: page, selected: 0, started: true, resumeFailed: true, values: values(5) }]);
  });
}

const MIN_GAP = 4; // folga mínima entre textos vizinhos, em pixels
let failures = 0;
const fail = (msg) => { failures++; console.log(`  FALHA: ${msg}`); };

for (const [name, state] of cases) {
  const report = [];
  const rgba = composeMenu(state, assets, 0, report);
  let opaque = 0;
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] !== 0) opaque++;
  if (rgba.length !== MENU_WIDTH * MENU_HEIGHT * 4) fail(`${name}: tamanho ${rgba.length}`);
  console.log(`${name}: ${opaque} pixels não transparentes, ${report.length} textos`);
  if (opaque === 0) fail(`${name}: nenhum pixel desenhado`);
  for (const r of report) {
    if (r.width > MENU_WIDTH) fail(`${name}: "${r.text}" com ${r.width} px de largura`);
    if (r.x < 0 || r.right > MENU_WIDTH) fail(`${name}: "${r.text}" sai da borda horizontal (x ${r.x}, fim ${r.right})`);
    if (r.y < 0 || r.bottom > MENU_HEIGHT) fail(`${name}: "${r.text}" sai da borda vertical (y ${r.y}, fim ${r.bottom})`);
  }
}

// Sobreposições de layout, nos dois idiomas.
const { OPTIONS, HELP } = MENU_LAYOUT;
for (const lang of ['en', 'pt']) {
  const T = MENU_TEXT[lang];
  for (const screen of ['options', 'extras', 'debug', 'gameDebug', 'monsterDebug']) {
    for (const item of SCREENS[screen].items) {
      if (item.type !== 'toggle' && item.type !== 'fullscreen') continue;
      const end = OPTIONS.x + measureText(assets.font, T[item.id]);
      if (end >= OPTIONS.valueX) fail(`${lang} ${screen}: rótulo "${T[item.id]}" (fim ${end}) invade a coluna de valores (${OPTIONS.valueX})`);
    }
  }
  const entries = helpEntries(T);
  for (const [keyLabel, actionName] of entries) {
    if (!actionName) fail(`${lang}: ação sem nome na tela de ajuda`);
    if (measureText(assets.font, keyLabel) + MIN_GAP > HELP.nameDx) fail(`${lang} ajuda: tecla "${keyLabel}" encosta no nome da ação`);
    if (HELP.colX[0] + HELP.nameDx + measureText(assets.font, actionName ?? '') + MIN_GAP > HELP.colX[1]) {
      fail(`${lang} ajuda: "${actionName}" encosta na segunda coluna`);
    }
  }
}

// O último item das opções (e do debug) deve terminar acima de y = 190 (sem a mensagem do rodapé).
const LAST_ITEM_MAX_Y = 190;
for (const lang of ['en', 'pt']) {
  for (const screen of ['options', 'extras', 'debug', 'gameDebug', 'monsterDebug']) {
    const report = [];
    composeMenu({ lang, screen, selected: 0, started: true, resumeFailed: false, values: values(5) }, assets, 0, report);
    const bottom = Math.max(...report.map((r) => r.bottom));
    console.log(`${lang} ${screen}: último texto termina em y = ${bottom}`);
    if (bottom > LAST_ITEM_MAX_Y) fail(`${lang} ${screen}: último item termina em y = ${bottom} (limite ${LAST_ITEM_MAX_Y})`);
  }
}

// Ajuda (etapa 17): em cada página, a lista termina até y = HELP.maxBottom (180), longe do rodapé, e
// todas as linhas de helpEntries aparecem em alguma página.
for (const lang of ['en', 'pt']) {
  const pages = helpPages(MENU_TEXT[lang]);
  const total = pages.reduce((n, pg) => n + pg.length, 0);
  if (total !== helpEntries(MENU_TEXT[lang]).length) fail(`${lang} ajuda: páginas com ${total} linhas`);
  if (HELP.line !== 12) fail(`ajuda: espaçamento ${HELP.line} (esperado 12)`);
  pages.forEach((_, page) => {
    const report = [];
    composeMenu({ lang, screen: 'help', helpPage: page, selected: 0, started: true, resumeFailed: false, values: values(5) }, assets, 0, report);
    const list = report.filter((r) => r.y < HELP.footerY);
    const lastBottom = Math.max(...list.map((r) => r.bottom));
    console.log(`${lang} ajuda página ${page + 1}/${pages.length}: ${pages[page].length} linhas, última termina em y = ${lastBottom}, rodapé em ${HELP.footerY}`);
    if (lastBottom > HELP.maxBottom) fail(`${lang} ajuda página ${page + 1}: a lista termina em ${lastBottom} (limite ${HELP.maxBottom})`);
  });
}

// Termômetros: a ponta direita (x + 8 + células * 8 + largura de M_THERMR) cabe na tela.
for (const screen of ['options', 'extras', 'debug', 'gameDebug', 'monsterDebug']) {
  for (const item of SCREENS[screen].items) {
    if (item.type !== 'thermo') continue;
    const cells = item.cells ?? 10;
    const end = OPTIONS.x + 8 + cells * 8 + (assets.patches.M_THERMR?.width ?? 0);
    if (end > MENU_WIDTH) fail(`${screen}: termômetro ${item.id} (${cells} células) termina em x = ${end}`);
    else console.log(`${screen}: termômetro ${item.id} com ${cells} células termina em x = ${end}`);
  }
}

// Termômetro (em y + thermoDy) não pode encostar no rótulo do item seguinte.
const thermoH = assets.patches.M_THERMM?.height ?? 0;
if (OPTIONS.thermoDy + thermoH > OPTIONS.thermoStep) {
  fail(`termômetro termina em y + ${OPTIONS.thermoDy + thermoH}, depois do próximo item (y + ${OPTIONS.thermoStep})`);
}

console.log(failures ? `${failures} falha(s)` : 'Tudo certo');
process.exit(failures ? 1 : 0);
