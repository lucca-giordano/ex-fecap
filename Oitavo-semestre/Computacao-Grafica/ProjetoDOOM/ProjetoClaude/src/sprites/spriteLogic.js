// Lógica dos sprites (pura): montagem da cena ao carregar, escolha de vista e de quadro, e
// instâncias para a GPU.

import { TICS_PER_SECOND, THING_TABLE, IGNORED_TYPES, SKILL, skillFilter } from './thingTable.js';
import { findSpriteLumps, resolveThingType, decodeSprite, buildFrames, frameComplete } from '../wad/Sprites.js';
import { findSector } from '../map/bsp.js';
import { doomToWorld } from '../map/coords.js';

// Prepara os objetos do mapa ao carregar (uma vez). maxLayers: limite de camadas do texture array.
// extraFrames (etapa 15): [{ prefix, letter, category }] além da animação de parado (dor, morte,
// morte esfacelada, efeitos; etapa 18: corrida e ataque). Quando faltam camadas, ou a textura estimada
// (camadas x largura x altura x 2 bytes) passa de maxBytes, descarta nesta ordem: 'xdeath', 'pain',
// 'runExtra' (corrida além de A e B) e, por último, a animação de parado além do primeiro quadro.
// Devolve { objects, layers: [{ name, patch }], types, frames: Map 'PREFIXO'+letra -> vistas, stats };
// stats.texture = { layers, layerW, layerH, bytes }.
export const MAX_SPRITE_BYTES = 256 * 1024 * 1024;
export function buildSpriteScene(wad, map, { skill = SKILL, maxLayers = Infinity, extraFrames = [], maxBytes = MAX_SPRITE_BYTES } = {}) {
  const { lumps: spriteLumps, source } = findSpriteLumps(wad);
  const stats = {
    source, spriteLumps: spriteLumps.size, histogram: new Map(), unresolved: [], unknown: [],
    discarded: { skill: 0, multiplayer: 0, sector: 0 }, ignored: 0, truncated: false,
    droppedCategories: [], missingExtra: [],
  };

  // Histograma dos tipos do mapa.
  for (const thing of map.things) {
    const h = stats.histogram.get(thing.type) ?? { type: thing.type, count: 0, prefix: THING_TABLE[thing.type]?.prefix ?? '-', resolved: false };
    h.count++;
    stats.histogram.set(thing.type, h);
  }

  // Resolve cada tipo presente (letras sem quadro completo saem da sequência).
  const resolved = new Map();
  for (const h of stats.histogram.values()) {
    if (IGNORED_TYPES.has(h.type)) continue;
    const entry = THING_TABLE[h.type];
    if (!entry) { stats.unknown.push(h.type); continue; }
    const r = resolveThingType(entry, spriteLumps);
    if (!r) { stats.unresolved.push(h.type); continue; }
    h.resolved = true;
    resolved.set(h.type, { ...entry, frames: r.frames, frameDefs: r.frameDefs });
  }

  // Quadros extras (etapa 15): vistas de cada PREFIXO+letra pedida; incompletos ficam de fora.
  const prefixFrames = new Map();
  const viewsOf = (prefix, letter) => {
    if (!prefixFrames.has(prefix)) prefixFrames.set(prefix, buildFrames(prefix, spriteLumps));
    const views = prefixFrames.get(prefix).get(letter);
    return frameComplete(views) ? views : null;
  };
  const extras = [];
  for (const f of extraFrames) {
    const views = viewsOf(f.prefix, f.letter);
    if (views) extras.push({ ...f, views });
    else stats.missingExtra.push(`${f.prefix}${f.letter}`);
  }

  // Camadas: um lump por camada, cada lump uma vez (o par espelhado usa o mesmo lump).
  // frames: mapa global 'PREFIXO'+letra -> [8 x { layer, mirrored }].
  let frames = new Map();
  const assignLayers = (dropped) => {
    const layerOf = new Map();
    frames = new Map();
    const add = (key, views) => {
      if (frames.has(key)) return frames.get(key);
      const layered = views.map(({ lump, mirrored }) => {
        if (!layerOf.has(lump)) layerOf.set(lump, layerOf.size);
        return { layer: layerOf.get(lump), mirrored };
      });
      frames.set(key, layered);
      return layered;
    };
    for (const type of resolved.values()) {
      type.frameLayers = new Map();
      for (const letter of type.frames) type.frameLayers.set(letter, add(type.prefix + letter, type.frameDefs.get(letter)));
    }
    for (const f of extras) if (!dropped.includes(f.category)) add(f.prefix + f.letter, f.views);
    return layerOf;
  };
  // Patches decodificados uma vez (o tamanho da camada é o maior sprite).
  const patchCache = new Map();
  const patchOf = (name) => {
    if (!patchCache.has(name)) patchCache.set(name, decodeSprite(wad, spriteLumps, name));
    return patchCache.get(name);
  };
  const textureOf = (layerOf) => {
    let layerW = 1, layerH = 1;
    for (const name of layerOf.keys()) {
      const p = patchOf(name);
      layerW = Math.max(layerW, p.width);
      layerH = Math.max(layerH, p.height);
    }
    return { layers: layerOf.size, layerW, layerH, bytes: layerOf.size * layerW * layerH * 2 };
  };
  const fits = (layerOf) => layerOf.size <= maxLayers && textureOf(layerOf).bytes <= maxBytes;
  let layerOf = assignLayers([]);
  // Etapa 23: 'attack' por último (E4M6 e E4M7 não cabem em 256 camadas só com as três primeiras); sem os
  // quadros de ataque, o monstro mostra a animação de parado enquanto ataca.
  for (const category of ['xdeath', 'pain', 'runExtra', 'attack']) {
    if (fits(layerOf)) break;
    stats.droppedCategories.push(category);
    layerOf = assignLayers(stats.droppedCategories);
  }
  if (!fits(layerOf)) {
    // Ainda sem espaço: fica só o primeiro quadro de cada animação de parado.
    stats.truncated = true;
    for (const type of resolved.values()) type.frames = type.frames[0];
    layerOf = assignLayers(stats.droppedCategories);
  }
  if (!fits(layerOf)) {
    throw new Error(`Sprites: ${layerOf.size} camadas (${textureOf(layerOf).bytes} bytes) excedem os limites ` +
      `(${maxLayers} camadas, ${maxBytes} bytes)`);
  }
  stats.texture = textureOf(layerOf);
  const layers = [...layerOf.keys()].map((name) => ({ name, patch: patchOf(name) }));

  // Objetos: filtro de dificuldade, setor (base no chão) e luz do setor.
  const objects = [];
  map.things.forEach((thing, index) => {
    if (IGNORED_TYPES.has(thing.type)) { stats.ignored++; return; }
    const type = resolved.get(thing.type);
    if (!type) return; // desconhecido ou não resolvido (já no relatório)
    const filter = skillFilter(thing.flags, skill);
    if (filter !== 'ok') { stats.discarded[filter]++; return; }
    const si = findSector(map, thing.x, thing.y);
    const sector = map.sectors[si];
    if (!sector) {
      stats.discarded.sector++;
      console.warn(`Sprites: objeto ${index} (tipo ${thing.type}) em setor inválido; descartado`);
      return;
    }
    objects.push({
      x: thing.x, y: thing.y, angle: thing.angle, flags: thing.flags, type, index,
      base: doomToWorld(thing.x, thing.y, sector.floorHeight),
      lightnum: Math.min(15, Math.max(0, Math.floor(sector.lightLevel / 16))),
      offset: animOffset(index),
    });
  });

  return { objects, layers, types: resolved, frames, stats };
}


// Módulo que funciona com negativos: mod(-90, 360) = 270.
export const mod = (a, n) => ((a % n) + n) % n;

// Ângulo, em graus nas coordenadas do Doom, do jogador (camX, camY) até o objeto.
export function angleToThing(thingX, thingY, camX, camY) {
  return Math.atan2(thingY - camY, thingX - camX) * 180 / Math.PI;
}

// Vista 1..8 (como no R_ProjectSprite do Doom): 1 = o objeto olha para o jogador, 5 = de costas.
export function chooseRotation(a, thingAngle) {
  return (Math.floor((mod(a - thingAngle, 360) + 202.5) / 45) % 8) + 1;
}

export const gameTics = (seconds) => Math.floor(seconds * TICS_PER_SECOND);

// Deslocamento por objeto (hash do índice), para as animações não ficarem em sincronia.
export function animOffset(index) {
  let h = Math.imul(index + 1, 0x9E3779B1) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0; // >>> 0: o ^ do JavaScript devolve inteiro com sinal
  return h % 1000;
}

// Letra do quadro atual da animação parada.
export function frameAt(frames, ticsPerFrame, tics, offset) {
  if (frames.length === 1 || ticsPerFrame <= 0) return frames[0];
  return frames[Math.floor((tics + offset) / ticsPerFrame) % frames.length];
}

// Layout da instância (32 bytes, como uma struct WGSL de alinhamento 16):
//   base vec3<f32> @0, layer u32 @12, lightnum u32 @16, flags u32 @20, preenchimento @24..31.
export const INSTANCE_STRIDE = 32;
export const INSTANCE_OFFSETS = { base: 0, layer: 12, lightnum: 16, flags: 20 };
export const FLAG_MIRRORED = 1;
export const FLAG_FULLBRIGHT = 2;
export const FLAG_FUZZ = 4;

// Escreve as instâncias de todos os objetos em `buffer` (ArrayBuffer) e devolve quantas.
// objects: [{ x, y, angle, base: [wx, wy, wz], lightnum, type, offset }], com type =
//   { frames, tics, fullbright, fuzz, frameLayers: Map letra -> [8 x { layer, mirrored }] }.
// cam: { x, y } nas coordenadas do Doom.
export function writeInstances(buffer, objects, cam, tics) {
  const f32 = new Float32Array(buffer);
  const u32 = new Uint32Array(buffer);
  let n = 0;
  for (const obj of objects) {
    const type = obj.type;
    const letter = frameAt(type.frames, type.tics, tics, obj.offset);
    const view = type.frameLayers.get(letter)[chooseRotation(angleToThing(obj.x, obj.y, cam.x, cam.y), obj.angle) - 1];
    const o = n * (INSTANCE_STRIDE / 4);
    f32[o] = obj.base[0]; f32[o + 1] = obj.base[1]; f32[o + 2] = obj.base[2];
    u32[o + 3] = view.layer;
    u32[o + 4] = obj.lightnum;
    u32[o + 5] = (view.mirrored ? FLAG_MIRRORED : 0) | (type.fullbright ? FLAG_FULLBRIGHT : 0) | (type.fuzz ? FLAG_FUZZ : 0);
    n++;
  }
  return n;
}

// Escreve instâncias a partir de itens já resolvidos (etapa 15: monstros em estado, corpos, efeitos).
// items: [{ x, y, angle, base: [wx, wy, wz], lightnum, views: [8 x { layer, mirrored }], fullbright, fuzz }].
// cam: { x, y } nas coordenadas do Doom. Devolve quantas instâncias foram escritas.
export function writeSpriteInstances(buffer, items, cam) {
  const f32 = new Float32Array(buffer);
  const u32 = new Uint32Array(buffer);
  const capacity = Math.floor(buffer.byteLength / INSTANCE_STRIDE);
  let n = 0;
  for (const it of items) {
    if (n >= capacity) break;
    const view = it.views[chooseRotation(angleToThing(it.x, it.y, cam.x, cam.y), it.angle) - 1];
    const o = n * (INSTANCE_STRIDE / 4);
    f32[o] = it.base[0]; f32[o + 1] = it.base[1]; f32[o + 2] = it.base[2];
    u32[o + 3] = view.layer;
    u32[o + 4] = it.lightnum;
    u32[o + 5] = (view.mirrored ? FLAG_MIRRORED : 0) | (it.fullbright ? FLAG_FULLBRIGHT : 0) | (it.fuzz ? FLAG_FUZZ : 0);
    n++;
  }
  return n;
}
