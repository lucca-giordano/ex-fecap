// Levantamento de todos os mapas do WAD (etapa 22, parte 0). SOMENTE LEITURA: não altera nenhum arquivo
// do jogo. Uso: node tools/survey-maps.mjs
// Gera docs/levantamento-mapas.md e tools/out/survey.json e imprime um resumo de até 40 linhas.
// "Suportado hoje" vem das tabelas reais do projeto (specials.js, thingTable.js, itemTable.js,
// monsterTable.js, aiTable.js). As descrições abaixo são de memória ("?" = dúvida).

import fs from 'node:fs';
import { WadFile } from '../src/wad/WadFile.js';
import { loadMap } from '../src/wad/MapData.js';
import { readTextureDefs } from '../src/wad/Textures.js';
import { SPECIALS } from '../src/game/specials.js';
import { THING_TABLE, IGNORED_TYPES, skillFilter } from '../src/sprites/thingTable.js';
import { ITEM_TABLE } from '../src/game/itemTable.js';
import { MONSTER_TABLE } from '../src/game/monsterTable.js';
import { AI_TABLE } from '../src/game/aiTable.js';

const MAP_LUMPS = ['THINGS', 'LINEDEFS', 'SIDEDEFS', 'VERTEXES', 'SEGS', 'SSECTORS', 'NODES', 'SECTORS', 'REJECT', 'BLOCKMAP'];

// Especiais de linha do Doom (de memória; "?" = dúvida).
const LINE_DESC = {
  1: 'porta DR', 2: 'porta abre W1', 3: 'porta fecha W1', 4: 'porta W1', 5: 'piso sobe ao teto vizinho W1', 7: 'escada S1',
  8: 'escada W1', 9: 'doughnut S1', 10: 'elevador W1', 11: 'saída S1', 12: 'luz ao máximo vizinho W1', 13: 'luz 255 W1',
  14: 'piso sobe 32 e muda textura S1', 15: 'piso sobe 24 e muda textura S1', 16: 'porta fecha 30 s W1', 17: 'luz piscando W1',
  18: 'piso sobe ao próximo S1', 19: 'piso desce ao maior vizinho W1', 20: 'piso sobe ao próximo e muda textura S1',
  21: 'elevador S1', 22: 'piso sobe ao próximo e muda textura W1', 23: 'piso desce ao menor S1', 24: 'piso sobe ao teto G1',
  25: 'esmagador W1', 26: 'porta azul DR', 27: 'porta amarela DR', 28: 'porta vermelha DR', 29: 'porta S1', 30: 'piso sobe pela textura W1',
  31: 'porta abre D1', 32: 'porta azul D1', 33: 'porta vermelha D1', 34: 'porta amarela D1', 35: 'luz 35 W1',
  36: 'piso desce ao maior + 8 W1', 37: 'piso desce ao menor e muda textura W1', 38: 'piso desce ao menor W1', 39: 'teleporte W1',
  40: 'teto sobe W1', 41: 'teto desce ao chão S1', 42: 'porta fecha SR', 43: 'teto desce ao chão SR', 44: 'teto desce W1',
  45: 'piso desce ao maior SR', 46: 'piso sobe ao próximo G1', 47: 'piso sobe ao próximo e muda textura G1', 48: 'parede rolante',
  49: 'esmagador S1 ?', 50: 'porta fecha S1', 51: 'saída secreta S1', 52: 'saída W1', 53: 'piso móvel W1', 54: 'para piso móvel W1',
  55: 'piso sobe esmagando S1', 56: 'piso sobe esmagando W1', 57: 'para esmagador W1', 58: 'piso sobe 24 W1',
  59: 'piso sobe 24 e muda textura W1', 60: 'piso desce ao menor SR', 61: 'porta abre SR', 62: 'elevador SR', 63: 'porta SR',
  64: 'piso sobe ao teto SR', 65: 'piso sobe esmagando SR', 66: 'piso sobe 24 e muda textura SR', 67: 'piso sobe 32 e muda textura SR',
  68: 'piso sobe ao próximo e muda textura SR', 69: 'piso sobe ao próximo SR', 70: 'piso desce ao maior + 8 SR',
  71: 'piso desce ao maior + 8 S1', 72: 'teto desce WR', 73: 'esmagador WR', 74: 'para esmagador WR', 75: 'porta fecha WR',
  76: 'porta fecha 30 s WR', 77: 'esmagador rápido WR', 78: 'desconhecido', 79: 'luz 35 WR', 80: 'luz ao máximo vizinho WR',
  81: 'luz 255 WR', 82: 'piso desce ao menor WR', 83: 'piso desce ao maior WR', 84: 'piso desce ao menor e muda textura WR',
  86: 'porta abre WR', 87: 'piso móvel WR', 88: 'elevador WR', 89: 'para piso móvel WR', 90: 'porta WR', 91: 'piso sobe ao teto WR',
  92: 'piso sobe 24 WR', 93: 'piso sobe 24 e muda textura WR', 94: 'piso sobe esmagando WR', 95: 'piso sobe ao próximo e muda textura WR',
  96: 'piso sobe pela textura WR', 97: 'teleporte WR', 98: 'piso desce ao maior + 8 WR', 99: 'porta azul rápida SR ?',
  100: 'escada rápida W1', 101: 'piso sobe ao teto S1', 102: 'piso desce ao maior S1', 103: 'porta abre S1', 104: 'luz ao menor vizinho W1',
  105: 'porta rápida WR', 106: 'porta rápida abre WR', 107: 'porta rápida fecha WR', 108: 'porta rápida W1', 109: 'porta rápida abre W1',
  110: 'porta rápida fecha W1', 111: 'porta rápida S1', 112: 'porta rápida abre S1', 113: 'porta rápida fecha S1',
  114: 'porta rápida SR', 115: 'porta rápida abre SR', 116: 'porta rápida fecha SR', 117: 'porta rápida DR', 118: 'porta rápida D1',
  119: 'piso sobe ao próximo W1', 120: 'elevador rápido WR', 121: 'elevador rápido W1', 122: 'elevador rápido S1',
  123: 'elevador rápido SR', 124: 'saída secreta W1', 125: 'teleporte de monstro W1', 126: 'teleporte de monstro WR',
  127: 'escada rápida S1', 128: 'piso sobe ao próximo WR', 129: 'piso rápido sobe ao próximo WR', 130: 'piso rápido sobe ao próximo W1',
  131: 'piso rápido sobe ao próximo S1', 132: 'piso rápido sobe ao próximo SR', 133: 'porta azul rápida S1 ?', 134: 'porta vermelha rápida SR ?',
  135: 'porta vermelha rápida S1 ?', 136: 'porta amarela rápida SR ?', 137: 'porta amarela rápida S1 ?', 138: 'luz 255 SR', 139: 'luz 35 SR',
  140: 'piso sobe 512 S1', 141: 'esmagador silencioso W1',
};
// Especiais de setor (de memória).
const SECTOR_DESC = {
  1: 'luz piscando aleatória', 2: 'estroboscópica rápida', 3: 'estroboscópica lenta', 4: 'estroboscópica lenta com dano de 20',
  5: 'dano de 10', 7: 'dano de 5', 8: 'luz oscilante', 9: 'secreto', 10: 'porta fecha em 30 s', 11: 'dano de 20 e fim de fase com vida baixa',
  12: 'estroboscópica lenta sincronizada', 13: 'estroboscópica rápida sincronizada', 14: 'porta abre em 5 min', 16: 'dano de 20',
  17: 'luz tremulante tipo fogo',
};
// Números de monstros do Doom (de memória), para a categoria de tipos que as tabelas do projeto não têm.
const MONSTER_NAMES = {
  3004: 'zumbi', 9: 'sargento', 65: 'comando', 84: 'SS', 3001: 'diabrete', 3002: 'demônio', 58: 'espectro', 3006: 'alma perdida',
  3005: 'cacodemônio', 69: 'cavaleiro do inferno ?', 3003: 'barão', 68: 'aracnotron', 71: 'elemental da dor', 66: 'revenant',
  67: 'mancubus', 64: 'arquivil', 16: 'cyberdemon', 7: 'spider mastermind', 72: 'Keen',
};
const START_TYPES = new Set([1, 2, 3, 4, 11]);
const TELEPORT_DEST = 14;

// Famílias de texturas animadas (de memória); só as presentes no WAD contam.
const FLAT_FAMILIES = ['NUKAGE', 'FWATER', 'LAVA', 'BLOOD', 'RROCK0', 'SLIME'];
const WALL_FAMILIES = ['BLODGR', 'BLODRIP', 'FIREBLU', 'FIRELAV', 'FIREMAG', 'FIREWAL', 'GSTFONT', 'ROCKRED', 'SLADRIP', 'BFALL', 'SFALL', 'WFALL', 'DBRAIN'];
const RROCK_ANIM = new Set(['RROCK05', 'RROCK06', 'RROCK07', 'RROCK08']);

function thingInfo(type) {
  const monster = MONSTER_TABLE[type];
  if (monster?.isMonster || MONSTER_NAMES[type]) {
    const support = AI_TABLE[type] ? 'sim (IA)' : monster ? 'parcial (passivo)' : 'não';
    return { category: 'monstro', name: `${MONSTER_NAMES[type] ?? 'desconhecido'} (${monster?.prefix ?? THING_TABLE[type]?.prefix ?? '?'})`, supported: support };
  }
  if (START_TYPES.has(type)) return { category: 'início de jogador', name: type <= 4 ? `jogador ${type}` : 'deathmatch', supported: 'ignorado' };
  if (type === TELEPORT_DEST) return { category: 'destino de teleporte', name: 'destino de teleporte', supported: 'não' };
  if (ITEM_TABLE[type]) return { category: 'item', name: `${ITEM_TABLE[type].messageKey} (${THING_TABLE[type]?.prefix ?? '?'})`, supported: THING_TABLE[type] ? 'sim' : 'não' };
  if (MONSTER_TABLE[type]) return { category: 'outro', name: MONSTER_TABLE[type].prefix, supported: 'sim' }; // barril
  if (THING_TABLE[type]) return { category: 'decoração', name: THING_TABLE[type].prefix, supported: 'sim (sprite)' };
  return { category: IGNORED_TYPES.has(type) ? 'outro' : 'outro', name: 'desconhecido', supported: 'não' };
}

const bump = (map, key, mapName, n = 1) => {
  if (!map.has(key)) map.set(key, { count: 0, maps: new Set() });
  const e = map.get(key);
  e.count += n;
  e.maps.add(mapName);
};

// --- Leitura ---
const bytes = fs.readFileSync(new URL('../assets/freedoom1.wad', import.meta.url));
const wad = new WadFile(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const mapNames = [];
wad.lumps.forEach((l, i) => {
  if (!/^(E\dM\d|MAP\d\d)$/.test(l.name)) return;
  if (MAP_LUMPS.every((n, k) => wad.lumps[i + 1 + k]?.name === n)) mapNames.push(l.name);
});
const flatNames = new Set(wad.lumps.map((l) => l.name));
const wallDefs = readTextureDefs(wad);
const animFlats = new Map(), animWalls = new Map();
for (const fam of FLAT_FAMILIES) {
  const names = [...flatNames].filter((n) => (fam === 'RROCK0' ? RROCK_ANIM.has(n) : n.startsWith(fam) && /\d$/.test(n)));
  if (names.length) animFlats.set(fam === 'RROCK0' ? 'RROCK05-08' : fam, new Set(names));
}
for (const fam of WALL_FAMILIES) {
  const names = [...wallDefs.keys()].filter((n) => n.startsWith(fam));
  if (names.length) animWalls.set(fam, new Set(names));
}

const maps = [];
const lineHist = new Map(), sectorHist = new Map(), thingHist = new Map();
const animUse = new Map();
let grates = 0, scrollers = 0;
const tag666 = [], bosses = { 3003: [], 16: [], 7: [] };
for (const name of mapNames) {
  const map = loadMap(wad, name); // lança erro se a estrutura for inválida
  const monsters = {};
  let items = 0, skill3 = 0, unsupportedSpecials = new Set(), unsupportedMonsters = new Set();
  for (const t of map.things) {
    bump(thingHist, t.type, name);
    if (skillFilter(t.flags) === 'ok') skill3++;
    const info = thingInfo(t.type);
    if (info.category === 'monstro') {
      monsters[t.type] = (monsters[t.type] ?? 0) + 1;
      if (!AI_TABLE[t.type]) unsupportedMonsters.add(t.type);
    }
    if (ITEM_TABLE[t.type]) items++;
    if (bosses[t.type] && !bosses[t.type].includes(name)) bosses[t.type].push(name);
  }
  for (const l of map.linedefs) {
    if (l.special) {
      bump(lineHist, l.special, name);
      if (!SPECIALS[l.special]) unsupportedSpecials.add(l.special);
    }
    if (l.special === 48) scrollers++;
    if (l.tag === 666 || l.tag === 667) tag666.push(`${name} linha tag ${l.tag}`);
    if (l.leftSidedef !== 0xFFFF) {
      for (const sd of [l.rightSidedef, l.leftSidedef]) if (map.sidedefs[sd]?.middleTexture && map.sidedefs[sd].middleTexture !== '-') grates++;
    }
  }
  let secrets = 0;
  for (const s of map.sectors) {
    if (s.special) bump(sectorHist, s.special, name);
    if (s.special === 9) secrets++;
    if (s.tag === 666 || s.tag === 667) tag666.push(`${name} setor tag ${s.tag}`);
    for (const f of [s.floorTexture, s.ceilingTexture]) {
      for (const [fam, set] of animFlats) if (set.has(f)) bump(animUse, `flat ${fam}`, name);
    }
  }
  for (const sd of map.sidedefs) {
    for (const t of [sd.upperTexture, sd.middleTexture, sd.lowerTexture]) {
      for (const [fam, set] of animWalls) if (set.has(t)) bump(animUse, `parede ${fam}`, name);
    }
  }
  maps.push({ name, linedefs: map.linedefs.length, sectors: map.sectors.length, things: map.things.length, skill3, monsters, items, secrets,
    score: unsupportedSpecials.size + unsupportedMonsters.size, unsupportedSpecials: [...unsupportedSpecials].sort((a, b) => a - b), unsupportedMonsters: [...unsupportedMonsters] });
}

// --- Saídas ---
const supportedLine = (n) => (SPECIALS[n] ? 'sim' : 'não');
const lineRows = [...lineHist].sort((a, b) => b[1].maps.size - a[1].maps.size || b[1].count - a[1].count)
  .map(([n, e]) => ({ special: n, lines: e.count, maps: e.maps.size, desc: LINE_DESC[n] ?? 'desconhecido', supported: supportedLine(n) }));
const sectorRows = [...sectorHist].sort((a, b) => a[0] - b[0])
  .map(([n, e]) => ({ special: n, sectors: e.count, maps: e.maps.size, desc: SECTOR_DESC[n] ?? 'desconhecido', supported: 'não' }));
const thingRows = [...thingHist].sort((a, b) => a[0] - b[0]).map(([n, e]) => ({ type: n, count: e.count, maps: e.maps.size, ...thingInfo(n) }));
const animRows = [...animUse].sort((a, b) => b[1].maps.size - a[1].maps.size).map(([k, e]) => ({ family: k, uses: e.count, maps: e.maps.size }));
const ranking = [...maps].sort((a, b) => a.score - b.score || a.name.localeCompare(b.name)).slice(0, 10);
const survey = { wad: 'freedoom1.wad', maps, lineSpecials: lineRows, sectorSpecials: sectorRows, things: thingRows, animations: animRows,
  animatedFamiliesInWad: { flats: Object.fromEntries([...animFlats].map(([k, v]) => [k, [...v]])), walls: Object.fromEntries([...animWalls].map(([k, v]) => [k, [...v]])) },
  grates, scrollers, tags666: tag666, bosses, ranking: ranking.map((m) => ({ name: m.name, score: m.score })) };
fs.mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('./out/survey.json', import.meta.url), `${JSON.stringify(survey, null, 2)}\n`);

const md = [];
md.push('# Levantamento dos mapas do freedoom1.wad', '',
  'Gerado por `tools/survey-maps.mjs` (somente leitura). "Suportado" vem das tabelas do projeto; as descrições são de memória ("?" = dúvida).', '',
  '| Mapa | Linedefs | Setores | Objetos | Na dificuldade 3 | Monstros por tipo | Itens | Secretos | Não suportados (pontuação) |',
  '|------|---------:|--------:|--------:|-----------------:|-------------------|------:|---------:|---------------------------:|');
for (const m of maps) {
  md.push(`| ${m.name} | ${m.linedefs} | ${m.sectors} | ${m.things} | ${m.skill3} | ${Object.entries(m.monsters).map(([t, n]) => `${t}x${n}`).join(' ')} | ${m.items} | ${m.secrets} | ${m.score} |`);
}
md.push('', '## Especiais de linha', '', '| Nº | Linhas | Mapas | Descrição | Suportado |', '|---:|---:|---:|---|---|');
for (const r of lineRows) md.push(`| ${r.special} | ${r.lines} | ${r.maps} | ${r.desc} | ${r.supported} |`);
md.push('', '## Especiais de setor', '', '| Nº | Setores | Mapas | Descrição | Suportado |', '|---:|---:|---:|---|---|');
for (const r of sectorRows) md.push(`| ${r.special} | ${r.sectors} | ${r.maps} | ${r.desc} | ${r.supported} |`);
md.push('', '## Tipos de objeto', '', '| Tipo | Quantidade | Mapas | Nome | Categoria | Suportado |', '|---:|---:|---:|---|---|---|');
for (const r of thingRows) md.push(`| ${r.type} | ${r.count} | ${r.maps} | ${r.name} | ${r.category} | ${r.supported} |`);
md.push('', '## Texturas animadas', '', '| Família | Usos | Mapas |', '|---|---:|---:|');
for (const r of animRows) md.push(`| ${r.family} | ${r.uses} | ${r.maps} |`);
md.push('', `Famílias presentes no WAD: flats ${[...animFlats.keys()].join(', ') || 'nenhuma'}; paredes ${[...animWalls.keys()].join(', ') || 'nenhuma'}.`,
  '', `Texturas centrais em linhas de dois lados (grades e janelas): ${grates}. Linhas com especial 48 (parede rolante): ${scrollers}.`,
  `Tags 666 e 667: ${tag666.length ? tag666.join('; ') : 'nenhuma'}.`,
  '', `Chefes: barão (3003) em ${bosses[3003].join(', ') || 'nenhum'}; cyberdemon (16) em ${bosses[16].join(', ') || 'nenhum'}; spider mastermind (7) em ${bosses[7].join(', ') || 'nenhum'}.`,
  '', '## Mapas com menos recursos não suportados', '', 'Pontuação = especiais de linha distintos não suportados + tipos de monstro distintos sem IA.', '');
ranking.forEach((m, i) => md.push(`${i + 1}. ${m.name}: ${m.score} (especiais ${m.unsupportedSpecials.join(', ') || '-'}; monstros ${m.unsupportedMonsters.join(', ') || '-'})`));
fs.writeFileSync(new URL('../docs/levantamento-mapas.md', import.meta.url), `${md.join('\n')}\n`);

// --- Resumo no console (até 40 linhas) ---
const out = [];
out.push(`RESUMO DO LEVANTAMENTO (${maps.length} mapas): ${maps.map((m) => m.name).join(' ')}`);
out.push('Especiais de linha não suportados que afetam mais mapas:');
const unsup = lineRows.filter((r) => r.supported === 'não').slice(0, 15);
for (let i = 0; i < unsup.length; i += 3) out.push('  ' + unsup.slice(i, i + 3).map((r) => `${r.special} ${r.desc} (${r.maps} mapas, ${r.lines} linhas)`).join('; '));
out.push(`Especiais de setor usados: ${sectorRows.map((r) => `${r.special} ${r.desc} (${r.maps})`).join('; ')}`);
const unsupThings = thingRows.filter((r) => r.supported === 'não' || r.supported.startsWith('parcial'))
  .sort((a, b) => (a.category === 'monstro' ? 0 : 1) - (b.category === 'monstro' ? 0 : 1) || b.maps - a.maps);
out.push(`Objetos não suportados: ${unsupThings.map((r) => `${r.type} ${r.name}${r.supported.startsWith('parcial') ? ' [passivo]' : ''} (${r.maps})`).join('; ')}`);
out.push(`Animações: ${animRows.map((r) => `${r.family} (${r.maps} mapas)`).join('; ') || 'nenhuma'}`);
out.push(`Grades e janelas (textura central em dois lados): ${grates}; paredes rolantes (48): ${scrollers}; tags 666/667: ${tag666.length}`);
out.push(`Chefes: barão ${bosses[3003].join(' ') || '-'}; cyberdemon ${bosses[16].join(' ') || '-'}; spider ${bosses[7].join(' ') || '-'}`);
out.push('Ranking (menos recursos não suportados):');
ranking.forEach((m, i) => out.push(`  ${i + 1}. ${m.name}: ${m.score} (especiais ${m.unsupportedSpecials.join(',') || '-'}; monstros ${m.unsupportedMonsters.join(',') || '-'})`));
console.log(out.slice(0, 40).join('\n'));
