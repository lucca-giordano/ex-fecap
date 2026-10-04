import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WadFile } from '../src/wad/WadFile.js';
import { loadMenuAssets } from '../src/menu/MenuAssets.js';
import { composeMenu, measureText } from '../src/menu/MenuRenderer.js';
import { MENU_TEXTS } from '../src/menu/menuText.js';
import { ACTION_KEYS } from '../src/input/Controls.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const wadPath = path.resolve(__dirname, '../assets/freedoom1.wad');
if (!fs.existsSync(wadPath)) {
    console.error(`[check-menu] Arquivo WAD não encontrado em: ${wadPath}`);
    process.exit(1);
}

const buffer = fs.readFileSync(wadPath);
const wad = new WadFile(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
const assets = loadMenuAssets(wad);

const languages = ['en', 'pt'];
const screens = [
    { name: 'Tela de Título (Menu Principal, started=false)', state: { currentScreen: 'main', started: false, selectedItem: { main: 0 } } },
    { name: 'Menu Principal sobre Cena (started=true)', state: { currentScreen: 'main', started: true, resumeFailed: false, selectedItem: { main: 1 } } },
    { name: 'Menu Principal com Falha de Retomada (resumeFailed=true)', state: { currentScreen: 'main', started: true, resumeFailed: true, selectedItem: { main: 0 } } },
    { name: 'Opções (Termômetros nível 5)', state: { currentScreen: 'options', started: true, selectedItem: { options: 4 }, settings: { visualMode: 'retro', crt: true, lighting: true, mouseSensitivityLevel: 5, flySpeedLevel: 5 } } },
    { name: 'Opções (Termômetros nível 1)', state: { currentScreen: 'options', started: true, selectedItem: { options: 4 }, settings: { visualMode: 'retro', crt: true, lighting: true, mouseSensitivityLevel: 1, flySpeedLevel: 1 } } },
    { name: 'Opções (Termômetros nível 10)', state: { currentScreen: 'options', started: true, selectedItem: { options: 5 }, settings: { visualMode: 'moderno', crt: false, lighting: false, mouseSensitivityLevel: 10, flySpeedLevel: 10 } } },
    { name: 'Submenu Debug', state: { currentScreen: 'debug', started: true, selectedItem: { debug: 2 }, settings: { textured: true, sectorColors: false, culling: true, skyTest: false, hud: true } } },
    { name: 'READ THIS! (Controles)', state: { currentScreen: 'help', started: true } },
];

let failed = false;

console.log('====================================================');
console.log('Verificação Automatizada do Menu do Doom (Etapa 9)');
console.log('====================================================\n');

for (const lang of languages) {
    console.log(`>>> Idioma Testado: [${lang.toUpperCase()}] <<<`);
    const texts = MENU_TEXTS[lang];

    // 1. Verificação de largura de todos os textos individuais
    console.log(`Verificando limites de texto para idioma [${lang}]:`);
    for (const [key, text] of Object.entries(texts)) {
        const w = measureText(assets.font, text);
        if (w > 320) {
            console.error(`  [ERRO] Texto "${key}" (${text}) excede 320px de largura: ${w}px`);
            failed = true;
        }
    }

    // 2. Verificação de largura dos itens da tela READ THIS!
    const entries = Object.entries(ACTION_KEYS);
    const mid = Math.ceil(entries.length / 2);
    const col1 = entries.slice(0, mid);
    const col2 = entries.slice(mid);

    for (const [action, def] of col1) {
        const line = `${def.label} ${action}`;
        const right = 8 + measureText(assets.font, line);
        if (right > 160) {
            console.error(`  [ERRO] Coluna 1: Item "${line}" ultrapassa borda da coluna 1 (x=${right}px > 160px)`);
            failed = true;
        }
    }

    for (const [action, def] of col2) {
        const line = `${def.label} ${action}`;
        const right = 160 + measureText(assets.font, line);
        if (right > 320) {
            console.error(`  [ERRO] Coluna 2: Item "${line}" ultrapassa borda da tela (x=${right}px > 320px)`);
            failed = true;
        }
    }

    // 3. Composição de cada tela e contagem de pixels não transparentes
    for (const scr of screens) {
        const img = composeMenu(scr.state, assets, 0.5, lang);
        if (!(img instanceof Uint8ClampedArray) || img.length !== 320 * 200 * 4) {
            console.error(`  [ERRO] ${scr.name}: Buffer retornado não possui dimensões 320x200x4.`);
            failed = true;
            continue;
        }

        let opaquePixels = 0;
        let outOfBounds = 0;
        let maxY = 0;

        for (let y = 0; y < 200; y++) {
            for (let x = 0; x < 320; x++) {
                const idx = (y * 320 + x) * 4;
                const alpha = img[idx + 3];
                if (alpha > 0) {
                    opaquePixels++;
                    if (y > maxY) maxY = y;
                    if (x < 0 || x >= 320 || y < 0 || y >= 200) {
                        outOfBounds++;
                    }
                }
            }
        }

        if (opaquePixels === 0) {
            console.error(`  [ERRO] ${scr.name}: Nenhum pixel desenhado (imagem totalmente transparente).`);
            failed = true;
        } else {
            console.log(`  [OK] ${scr.name}: ${opaquePixels} pixels desenhados (${(opaquePixels / (320 * 200) * 100).toFixed(1)}% de preenchimento).`);
        }

        if (scr.state.currentScreen === 'options') {
            if (maxY >= 190) {
                console.error(`  [ERRO] ${scr.name}: Pixels desenhados em y=${maxY} ultrapassam o limite de 190px.`);
                failed = true;
            } else {
                console.log(`  [OK] ${scr.name}: Termina em y=${maxY} (< 190).`);
            }
        }

        if (outOfBounds > 0) {
            console.error(`  [ERRO] ${scr.name}: ${outOfBounds} pixels fora dos limites da imagem.`);
            failed = true;
        }
    }
    console.log('');
}

if (failed) {
    console.error('❌ Falha na verificação automatizada do menu.');
    process.exit(1);
} else {
    console.log('✅ Todas as verificações de layout, renderização pura e limites de tela passaram com sucesso!');
    process.exit(0);
}
