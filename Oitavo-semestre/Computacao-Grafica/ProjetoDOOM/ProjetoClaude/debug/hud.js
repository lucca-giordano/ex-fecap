// Página de depuração da camada de interface: usa as MESMAS funções do jogo (composeHud, PlayerStats,
// weapons.js), em Canvas 2D e sem WebGPU, ampliadas 3x.

import { WadFile } from '../src/wad/WadFile.js';
import { loadHudAssets } from '../src/hud/HudAssets.js';
import { composeHud, BAR_Y, HUD_WIDTH, HUD_HEIGHT } from '../src/hud/HudRenderer.js';
import { PlayerStats } from '../src/game/PlayerStats.js';
import { WEAPONTOP, READY_SX, WEAPONS, USABLE_SLOTS, attackTics } from '../src/game/weapons.js';

const WAD_URL = new URL('../assets/freedoom1.wad', import.meta.url);
const SCALE = 3;
const GRAY = [90, 90, 90];
const LINE = [255, 0, 255];

function showError(text) {
  document.getElementById('msg').textContent = text;
  console.error(text);
}

// Desenha RGBA (w x h) ampliado; `background(x, y)` dá a cor dos pixels transparentes.
function toCanvas(rgba, w, h, background) {
  const small = document.createElement('canvas');
  small.width = w;
  small.height = h;
  const ctx = small.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (rgba[o + 3]) img.data.set([rgba[o], rgba[o + 1], rgba[o + 2], 255], o);
      else img.data.set([...background(x, y), 255], o);
    }
  }
  ctx.putImageData(img, 0, 0);
  const big = document.createElement('canvas');
  big.width = w * SCALE;
  big.height = h * SCALE;
  const bctx = big.getContext('2d');
  bctx.imageSmoothingEnabled = false;
  bctx.drawImage(small, 0, 0, big.width, big.height);
  return big;
}

function figure(container, canvas, caption) {
  const fig = document.createElement('figure');
  const cap = document.createElement('figcaption');
  cap.textContent = caption;
  fig.append(canvas, cap);
  container.append(fig);
}

const statsWith = (health, ammo, armor) => {
  const s = new PlayerStats();
  s.health = health;
  s.ammoClip = ammo;
  s.armor = armor;
  return s;
};

async function main() {
  const wad = await WadFile.fromUrl(WAD_URL);
  const assets = loadHudAssets(wad);
  if (assets.missing.length) console.warn(`Lumps ausentes: ${assets.missing.join(', ')}`);
  if (!assets.ok) throw new Error(`Faltam lumps obrigatórios: ${assets.fatal.join(', ')}`);
  const background = (x, y) => (y === BAR_Y - 1 ? LINE : GRAY);

  // Camada composta de cada arma: parada e no quadro do tiro, com o primeiro clarão.
  const layers = document.getElementById('layers');
  for (const slot of USABLE_SLOTS.filter((s) => assets.weaponSlots.includes(s))) {
    const def = WEAPONS[slot];
    const shot = def.attack.find((fr) => fr.action && fr.action !== 'refire');
    const base = { prefix: def.prefix, sx: READY_SX, sy: WEAPONTOP, ammo: def.ammo };
    const cases = [[`${def.name} parada (${def.prefix}${def.ready})`, { ...base, frame: def.ready, flash: null }],
      [`${def.name} tiro (${def.prefix}${shot.letter}${shot.flash ? ` + ${def.flashPrefix}${shot.flash[0][0]}` : ''})`,
        { ...base, frame: shot.letter, flash: shot.flash ? { prefix: def.flashPrefix, letter: shot.flash[0][0] } : null }]];
    for (const [caption, weapon] of cases) {
      const rgba = composeHud({ stats: new PlayerStats(), weapon, weaponLevel: 0 }, assets, 0);
      figure(layers, toCanvas(rgba, HUD_WIDTH, HUD_HEIGHT, background), caption);
    }
  }

  // Só a barra (linhas 168 a 199) com valores diferentes.
  const bars = document.getElementById('bars');
  const barCases = [
    [100, 50, 0], [50, 5, 100], [20, 0, 0], [0, 50, 100],
  ];
  for (const [health, ammo, armor] of barCases) {
    const rgba = composeHud({ stats: statsWith(health, ammo, armor), weapon: null, weaponLevel: 0 }, assets, 0);
    const bar = rgba.slice(BAR_Y * HUD_WIDTH * 4);
    figure(bars, toCanvas(bar, HUD_WIDTH, HUD_HEIGHT - BAR_Y, () => GRAY), `vida ${health}, munição ${ammo}, armadura ${armor}`);
  }

  // Etapa 17: cada arma utilizável, uma fileira com parado, quadros de ataque (letra, tics e ação) e
  // clarão, cada um com a cruz na origem (leftOffset, topOffset); lumps ausentes em vermelho.
  const frames = document.getElementById('frames');
  for (const slot of USABLE_SLOTS) {
    const def = WEAPONS[slot];
    const title = document.createElement('h3');
    title.textContent = `${slot}: ${def.name} (${def.prefix}), ataque de ${attackTics(slot)} tics` +
      (assets.weaponSlots.includes(slot) ? '' : ' — INDISPONÍVEL');
    const row = document.createElement('div');
    row.className = 'grid';
    frames.append(title, row);
    const items = [[`${def.prefix}${def.ready}0`, 'parado']];
    def.attack.forEach((fr, i) => items.push([`${def.prefix}${fr.letter}0`, `#${i + 1} ${fr.tics} tics${fr.action ? ` ${fr.action}` : ''}`]));
    for (const fr of def.attack) {
      for (const [letter, tics] of fr.flash ?? []) items.push([`${def.flashPrefix}${letter}0`, `clarão ${tics} tics`]);
    }
    for (const [name, label] of items) {
      const p = assets.sprites[name];
      if (!p) {
        const miss = document.createElement('div');
        miss.className = 'missing';
        miss.textContent = `${name}: AUSENTE (${label})`;
        row.append(miss);
        continue;
      }
      figure(row, originCanvas(p, assets.palette), `${name} ${label}; ${p.width}x${p.height} origem (${p.leftOffset}, ${p.topOffset})`);
    }
  }
}

// Sprite ampliado com a cruz na origem. A origem (0, 0) fica a (-leftOffset, -topOffset) do canto do
// sprite; nos sprites de arma os offsets são negativos, então a origem fica FORA da imagem (acima e à
// esquerda). A tela cobre os dois.
function originCanvas(p, palette) {
  const PAD = 6;
  const minX = Math.min(0, -p.leftOffset), maxX = Math.max(0, -p.leftOffset + p.width);
  const minY = Math.min(0, -p.topOffset), maxY = Math.max(0, -p.topOffset + p.height);
  const w = maxX - minX + 2 * PAD, h = maxY - minY + 2 * PAD;
  const originX = PAD - minX, originY = PAD - minY;
  const left = originX - p.leftOffset, top = originY - p.topOffset;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < p.height; y++) {
    for (let x = 0; x < p.width; x++) {
      const s = y * p.width + x;
      if (!p.opacity[s]) continue;
      const c = p.indices[s] * 3;
      rgba.set([palette[c], palette[c + 1], palette[c + 2], 255], ((top + y) * w + left + x) * 4);
    }
  }
  const canvas = toCanvas(rgba, w, h, () => GRAY);
  const ctx = canvas.getContext('2d');
  const ox = (originX + 0.5) * SCALE, oy = (originY + 0.5) * SCALE;
  ctx.strokeStyle = '#0f0';
  ctx.beginPath();
  ctx.moveTo(ox - 12, oy); ctx.lineTo(ox + 12, oy);
  ctx.moveTo(ox, oy - 12); ctx.lineTo(ox, oy + 12);
  ctx.stroke();
  return canvas;
}

main().catch((err) => showError(err.message));
