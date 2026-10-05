// Linha de base de TODOS os mapas ExMy (etapa 23, parte 0). Uso: node tools/baseline-all-maps.mjs
// Para cada mapa, tenta construir com o mesmo caminho do jogo (loadMap, texturas do mapa com o céu e as
// contrapartes dos interruptores, geometria estática com e sem exclusões, geometria dinâmica, colisão,
// estado do nível, sprites e objetos) e grava tools/baselines/geometry-all.json com sucesso ou erro
// (mensagem e arquivo:linha), SHA-256 dos bytes e contagens. É um RELATÓRIO: sai com código 0.
// Com --force regrava um arquivo existente; sem ele, só imprime a comparação.

import fs from 'node:fs';
import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import { layerMaps, loadWad } from './baseline-geometry.mjs';
import { loadMap } from '../src/wad/MapData.js';
import { loadTextures, usedTextureNames } from '../src/wad/Textures.js';
import { skyNameForMap } from '../src/wad/Colormap.js';
import { findSpriteLumps } from '../src/wad/Sprites.js';
import { buildWalls } from '../src/map/buildWalls.js';
import { buildFlats } from '../src/map/buildFlats.js';
import { DynamicGeometry, dynamicSets } from '../src/map/dynamicGeometry.js';
import { buildCollisionLines } from '../src/physics/collisionData.js';
import { LevelState } from '../src/game/LevelState.js';
import { analyzeSpecials, switchCounterpartNames } from '../src/game/specials.js';
import { buildSpriteScene } from '../src/sprites/spriteLogic.js';
import { resolveMonsterTable, extraSpriteFrames } from '../src/game/monsterTable.js';
import { DROP_SPRITES } from '../src/game/itemTable.js';
import { missileSpriteFrames } from '../src/game/Missiles.js';

export const ALL_BASELINE_PATH = new URL('./baselines/geometry-all.json', import.meta.url);
const MAP_LUMPS = ['THINGS', 'LINEDEFS', 'SIDEDEFS', 'VERTEXES', 'SEGS', 'SSECTORS', 'NODES', 'SECTORS', 'REJECT', 'BLOCKMAP'];
const sha = (typed) => crypto.createHash('sha256').update(Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength)).digest('hex');

export function exmyMaps(wad) {
  const out = [];
  wad.lumps.forEach((l, i) => {
    if (/^E\dM\d$/.test(l.name) && MAP_LUMPS.every((n, k) => wad.lumps[i + 1 + k]?.name === n)) out.push(l.name);
  });
  return out;
}

// "arquivo:linha" do primeiro quadro da pilha dentro do projeto.
function where(err) {
  const m = /(src|tools)[\\/][^\s:)]+:\d+/.exec(err.stack ?? '');
  return m ? m[0].replace(/\\/g, '/') : '?';
}

// Mesmo caminho de construção do main.js da etapa 22 (sem GPU).
export function buildCurrent(wad, name) {
  const map = loadMap(wad, name);
  const used = usedTextureNames(map);
  used.walls.add(skyNameForMap(name));
  for (const n of switchCounterpartNames(map)) used.walls.add(n);
  const textures = loadTextures(wad, used.walls, used.flats);
  const { wallLayers, flatLayers } = layerMaps(textures);
  const level = new LevelState(map);
  const info = analyzeSpecials(map, level.tagMap);
  const sets = dynamicSets(level, info.movableSectors, info.switchLines);
  const wallsFull = buildWalls(map, wallLayers);
  const flatsFull = buildFlats(map, flatLayers);
  const walls = buildWalls(map, wallLayers, { linedefs: sets.lines });
  const flats = buildFlats(map, flatLayers, { sectors: sets.sectors });
  const dyn = new DynamicGeometry(map, sets, flats.subsectorInfo, wallLayers, flatLayers);
  const lines = buildCollisionLines(map);
  const { lumps } = findSpriteLumps(wad);
  const table = resolveMonsterTable(lumps, new Set(map.things.map((t) => t.type)));
  const scene = buildSpriteScene(wad, map, { maxLayers: 1024, extraFrames: [...extraSpriteFrames(table.entries),
    ...DROP_SPRITES.map((f) => ({ ...f, category: 'drop' })), ...missileSpriteFrames().map((f) => ({ ...f, category: 'effect' }))] });
  const spawn = map.things.find((t) => t.type === 1);
  return { map, textures, wallsFull, flatsFull, walls, flats, dyn, lines, level, info, scene, spawn };
}

export function digestOf(b) {
  return {
    static: { walls: { vertexCount: b.wallsFull.vertexCount, indexCount: b.wallsFull.indices.length, vertices: sha(b.wallsFull.vertices), indices: sha(b.wallsFull.indices) },
      flats: { vertexCount: b.flatsFull.vertexCount, indexCount: b.flatsFull.indices.length, vertices: sha(b.flatsFull.vertices), indices: sha(b.flatsFull.indices) } },
    excluded: { walls: sha(b.walls.vertices), wallIndices: sha(b.walls.indices), flats: sha(b.flats.vertices), flatIndices: sha(b.flats.indices) },
    dynamic: { vertexCount: b.dyn.vertexCount, indexCount: b.dyn.indices.length, vertices: sha(b.dyn.vertices), sectorVertices: sha(b.dyn.sectorVertices), indices: sha(b.dyn.indices) },
    counts: { linedefs: b.map.linedefs.length, sectors: b.map.sectors.length, objects: b.scene.objects.length, collisionLines: b.lines.length,
      movableSectors: b.info.movableSectors.size, layers: b.scene.layers.length, missingWalls: b.textures.stats.missingWalls.length,
      missingFlats: b.textures.stats.missingFlats.length, spawn: Boolean(b.spawn) },
  };
}

if (process.argv[1]?.endsWith('baseline-all-maps.mjs')) {
  const wad = loadWad();
  const results = {};
  for (const name of exmyMaps(wad)) {
    const t0 = performance.now();
    try {
      const b = buildCurrent(wad, name);
      results[name] = { ok: true, ms: Math.round(performance.now() - t0), ...digestOf(b) };
    } catch (err) {
      results[name] = { ok: false, error: err.message, at: where(err) };
    }
  }
  const failed = Object.entries(results).filter(([, r]) => !r.ok);
  console.log(`Mapas: ${Object.keys(results).length}; construídos: ${Object.keys(results).length - failed.length}; falharam: ${failed.length}`);
  for (const [n, r] of failed) console.log(`  ${n}: ${r.error} (${r.at})`);
  for (const [n, r] of Object.entries(results)) {
    if (r.ok && (r.counts.missingWalls || r.counts.missingFlats || !r.counts.spawn)) {
      console.log(`  aviso ${n}: texturas ausentes ${r.counts.missingWalls}, flats ausentes ${r.counts.missingFlats}, início ${r.counts.spawn}`);
    }
  }
  if (!fs.existsSync(ALL_BASELINE_PATH) || process.argv.includes('--force')) {
    fs.mkdirSync(new URL('./baselines/', import.meta.url), { recursive: true });
    fs.writeFileSync(ALL_BASELINE_PATH, `${JSON.stringify({ createdAt: new Date().toISOString(), maps: results }, null, 2)}\n`);
    console.log(`Gravado ${ALL_BASELINE_PATH.pathname}`);
  } else {
    const base = JSON.parse(fs.readFileSync(ALL_BASELINE_PATH, 'utf8')).maps;
    const diff = Object.keys(results).filter((n) => JSON.stringify(base[n]?.static) !== JSON.stringify(results[n].static) ||
      JSON.stringify(base[n]?.dynamic) !== JSON.stringify(results[n].dynamic));
    console.log(`Linha de base já existe; mapas com hash diferente do registrado: ${diff.join(', ') || 'nenhum'}`);
  }
}
