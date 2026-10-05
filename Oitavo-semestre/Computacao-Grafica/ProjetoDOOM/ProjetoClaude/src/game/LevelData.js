// Dados de um nível (etapa 23): tudo que depende só do mapa, montado na CPU, sem GPU e sem DOM.
// O jogo constrói o próximo nível inteiro com isto (e com LevelGpu) antes de descartar o atual.

import { loadMap } from '../wad/MapData.js';
import { loadTextures, usedTextureNames, readTextureDefs } from '../wad/Textures.js';
import { skyNameForMap } from '../wad/Colormap.js';
import { findSpriteLumps } from '../wad/Sprites.js';
import { findSector } from '../map/bsp.js';
import { buildWalls } from '../map/buildWalls.js';
import { buildFlats } from '../map/buildFlats.js';
import { DynamicGeometry, dynamicSets } from '../map/dynamicGeometry.js';
import { buildCollisionLines } from '../physics/collisionData.js';
import { textureLayerMaps } from '../gpu/TextureSet.js';
import { buildSpriteScene, MAX_SPRITE_BYTES } from '../sprites/spriteLogic.js';
import { SKILL } from '../sprites/thingTable.js';
import { LevelState } from './LevelState.js';
import { analyzeSpecials, switchCounterpartNames } from './specials.js';
import { resolveMonsterTable, extraSpriteFrames, MONSTER_TABLE } from './monsterTable.js';
import { ITEM_TABLE, DROP_SPRITES } from './itemTable.js';
import { missileSpriteFrames } from './Missiles.js';
import { TFOG_FRAMES } from './effects.js';
import { skillParams } from './skill.js';

export const SECRET_SECTOR = 9;
const EXIT_SPECIALS = { 11: false, 52: false, 51: true, 124: true }; // especial -> saída secreta?

// Plano far a partir do tamanho do mapa: diagonal dos limites * 1.5.
export function farFromMap(map) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const v of map.vertexes) {
    minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
    minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
  }
  return Math.hypot(maxX - minX, maxY - minY) * 1.5;
}

// Quadros fixos da textura de sprites (além dos tipos do mapa): itens largados e projéteis; no Nightmare
// (etapa 23), também a névoa TFOG do respawn (nas outras dificuldades as camadas ficam como antes).
export function fixedSpriteFrames(skill = SKILL) {
  const fog = skillParams(skill).respawn ? [...new Set(TFOG_FRAMES.map(([l]) => l))].map((letter) => ({ prefix: 'TFOG', letter, category: 'effect' })) : [];
  return [...DROP_SPRITES.map((f) => ({ ...f, category: 'drop' })), ...missileSpriteFrames().map((f) => ({ ...f, category: 'effect' })), ...fog];
}

// cache: { textures: TextureCache, spriteLumps } compartilhado entre níveis (opcional).
// Devolve { name, map, spawn, skyName, textures, used, wallLayers, flatLayers, levelState, specialsInfo,
// dynSets, walls, flats, dyn, staticWithoutExclusions(), collisionLines, monsterTable, spriteScene,
// totals, exits, far, warnings, ms }. Lança erro se o mapa não existir ou não tiver o início do jogador 1.
export function buildLevelData(wad, mapName, { skill = SKILL, cache = null, maxLayers = 1024, maxBytes = MAX_SPRITE_BYTES } = {}) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  const warnings = [];
  const map = loadMap(wad, mapName);
  const spawn = map.things.find((t) => t.type === 1);
  if (!spawn) throw new Error(`${mapName}: início do jogador 1 não encontrado`);

  // Texturas: as do mapa, o céu do episódio (com recuo) e as contrapartes dos interruptores, no fim.
  const texCache = cache?.textures ?? null;
  if (texCache && !texCache.defs) { texCache.defs = readTextureDefs(wad); }
  const defs = texCache?.defs ?? readTextureDefs(wad);
  const skyName = skyNameForMap(mapName, (n) => defs.has(n));
  const used = usedTextureNames(map);
  used.walls.add(skyName);
  for (const name of switchCounterpartNames(map)) used.walls.add(name);
  const textures = loadTextures(wad, used.walls, used.flats, texCache);
  for (const n of textures.stats.missingWalls) warnings.push(`textura ${n} ausente (fallback)`);
  for (const n of textures.stats.missingFlats) warnings.push(`flat ${n} ausente (fallback)`);
  const { wallLayers, flatLayers } = textureLayerMaps(textures);

  // Especiais e geometria (estática sem as linhas e setores móveis; dinâmica com eles).
  const levelState = new LevelState(map);
  const specialsInfo = analyzeSpecials(map, levelState.tagMap);
  warnings.push(...specialsInfo.warnings);
  const dynSets = dynamicSets(levelState, specialsInfo.movableSectors, specialsInfo.switchLines);
  const walls = buildWalls(map, wallLayers, { linedefs: dynSets.lines });
  const flats = buildFlats(map, flatLayers, { sectors: dynSets.sectors });
  const dyn = new DynamicGeometry(map, dynSets, flats.subsectorInfo, wallLayers, flatLayers);
  for (const { linedef, reason } of walls.stats.skippedLinedefs) warnings.push(`linedef ${linedef} ignorada: ${reason}`);
  const collisionLines = buildCollisionLines(map);

  // Sprites: tipos do mapa (com a dificuldade) e quadros de combate, efeitos, largados e projéteis.
  if (cache && !cache.spriteLumps) cache.spriteLumps = findSpriteLumps(wad).lumps;
  const lumps = cache?.spriteLumps ?? findSpriteLumps(wad).lumps;
  const monsterTable = resolveMonsterTable(lumps, new Set(map.things.map((t) => t.type)));
  let spriteScene = null;
  try {
    spriteScene = buildSpriteScene(wad, map, { skill, maxLayers, maxBytes,
      extraFrames: [...extraSpriteFrames(monsterTable.entries), ...fixedSpriteFrames(skill)] });
    if (spriteScene.stats.droppedCategories.length) warnings.push(`sprites: descartados ${spriteScene.stats.droppedCategories.join(', ')}`);
    if (spriteScene.stats.unresolved.length) warnings.push(`tipos sem sprite: ${spriteScene.stats.unresolved.join(', ')}`);
  } catch (err) {
    warnings.push(`sprites indisponíveis: ${err.message}`);
  }

  // Totais (depois do filtro de dificuldade) e saídas.
  const objects = spriteScene?.objects ?? [];
  const typeOf = (o) => map.things[o.index].type;
  const totals = {
    kills: objects.filter((o) => MONSTER_TABLE[typeOf(o)]?.isMonster).length,
    items: objects.filter((o) => ITEM_TABLE[typeOf(o)]?.counts).length,
    secrets: map.sectors.filter((s) => s.special === SECRET_SECTOR).length,
  };
  const exits = { normal: 0, secret: 0 };
  for (const l of map.linedefs) if (l.special in EXIT_SPECIALS) exits[EXIT_SPECIALS[l.special] ? 'secret' : 'normal']++;
  const spawnSector = findSector(map, spawn.x, spawn.y);
  const ms = typeof performance !== 'undefined' ? performance.now() - t0 : 0;
  return {
    name: map.name, map, spawn, spawnSector, skill, skyName, textures, used, wallLayers, flatLayers,
    levelState, specialsInfo, dynSets, walls, flats, dyn, collisionLines, monsterTable, spriteScene,
    totals, exits, far: farFromMap(map), warnings, ms,
    // Etapa 20: se os buffers dinâmicos falharem, a geometria estática volta a ser montada sem exclusões.
    staticWithoutExclusions: () => ({ walls: buildWalls(map, wallLayers), flats: buildFlats(map, flatLayers) }),
  };
}
