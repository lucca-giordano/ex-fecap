// Página de depuração dos mapas (etapa 23): monta cada mapa com buildLevelData (o mesmo do jogo, sem
// GPU) e mostra camadas, objetos, totais, saídas e avisos; também a progressão do GameFlow.

import { WadFile } from '../src/wad/WadFile.js';
import { TextureCache } from '../src/wad/TextureCache.js';
import { buildLevelData } from '../src/game/LevelData.js';
import { listMaps } from '../src/game/GameSession.js';
import { nextMap } from '../src/game/GameFlow.js';
import { MONSTER_TABLE } from '../src/game/monsterTable.js';
import { skillFilter } from '../src/sprites/thingTable.js';

const WAD_URL = new URL('../assets/freedoom1.wad', import.meta.url);

function showError(text) {
  document.getElementById('msg').textContent = text;
  console.error(text);
}

function table(el, head, rows, classOf = () => '') {
  el.innerHTML = '';
  const tr = (cells, tag, cls = '') => {
    const row = document.createElement('tr');
    if (cls) row.className = cls;
    cells.forEach((c, i) => {
      const cell = document.createElement(tag);
      cell.textContent = c;
      if (i === 0 || typeof c === 'string' && Number.isNaN(Number(c))) cell.className = 'l';
      row.appendChild(cell);
    });
    el.appendChild(row);
  };
  tr(head, 'th');
  for (const r of rows) tr(r, 'td', classOf(r));
}

// Recursos não suportados do mapa: especiais de linha (tipo x usos) e tipos de monstro sem IA ou sem quadros.
function unsupported(d) {
  const specials = [...d.specialsInfo.unsupported.entries()].map(([type, uses]) => `${type}x${Array.isArray(uses) ? uses.length : uses}`);
  const monsters = [...d.monsterTable.noAI, ...d.monsterTable.unresolved];
  const out = [specials.length ? `especiais ${specials.join(' ')}` : '', monsters.length ? `monstros ${monsters.join(', ')}` : ''].filter(Boolean);
  return out.join('; ') || '-';
}

async function main() {
  const wad = await WadFile.fromUrl(WAD_URL);
  const maps = listMaps(wad);
  const cache = { textures: new TextureCache(), spriteLumps: null };
  const status = document.getElementById('status');

  function run() {
    const maxLayers = Number(document.getElementById('limit').value);
    const skill = Number(document.getElementById('skill').value);
    const rows = [];
    const t0 = performance.now();
    for (const m of maps) {
      try {
        const d = buildLevelData(wad, m.name, { skill, cache, maxLayers });
        rows.push([m.name, d.ms.toFixed(0), d.wallLayers.size, d.flatLayers.size, d.spriteScene?.layers.length ?? 'SEM',
          d.spriteScene?.objects.length ?? 0, d.totals.kills, d.totals.items, d.totals.secrets,
          `${d.exits.normal}/${d.exits.secret}`, d.skyName, unsupported(d), d.warnings.length ? d.warnings.join('; ') : '-']);
      } catch (err) {
        rows.push([m.name, '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', `ERRO: ${err.message}`]);
      }
    }
    status.textContent = `${maps.length} mapas em ${(performance.now() - t0).toFixed(0)} ms (limite ${maxLayers}, dificuldade ${skill})`;
    table(document.getElementById('maps'),
      ['mapa', 'ms', 'paredes', 'flats', 'sprites', 'objetos', 'monstros', 'itens', 'segredos', 'saídas n/s', 'céu', 'não suportado', 'avisos'],
      rows, (r) => (String(r[12]).startsWith('ERRO') || r[4] === 'SEM' ? 'bad' : ''));
  }

  // Monstros por dificuldade direto dos THINGS (mesmo filtro do buildSpriteScene).
  {
    const rows = [];
    for (const m of maps) {
      const d = buildLevelData(wad, m.name, { cache });
      const counts = [1, 2, 3, 4, 5].map((s) => d.map.things.filter((t) => MONSTER_TABLE[t.type]?.isMonster && skillFilter(t.flags, s) === 'ok').length);
      rows.push([m.name, ...counts]);
    }
    table(document.getElementById('skills'), ['mapa', '1', '2', '3', '4', '5'], rows);
  }

  // Progressão: saída normal e secreta de cada mapa (sem volta guardada do secreto: tabela do Doom).
  {
    const has = (e, mm) => maps.some((x) => x.episode === e && x.map === mm);
    const label = (n) => (n.kind === 'map' ? `E${n.episode}M${n.map}` : 'FIM DO EPISÓDIO');
    table(document.getElementById('flow'), ['mapa', 'saída normal', 'saída secreta'],
      maps.map((m) => [m.name, label(nextMap(m.episode, m.map, false, has)), label(nextMap(m.episode, m.map, true, has))]));
  }

  document.getElementById('run').addEventListener('click', run);
  run();
}

main().catch((err) => showError(err.message));
