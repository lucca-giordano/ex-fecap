// Linha de base da geometria estática do E1M1 (etapa 20, parte 0). Uso: node tools/baseline-geometry.mjs
// Grava em tools/baselines/geometry-e1m1.json o SHA-256 dos bytes de vertices e indices de buildWalls
// e buildFlats, com as contagens. tools/check-specials.mjs compara a geometria atual contra esse arquivo.
//
// No jogo, os mapas nome -> camada vêm de createTextureSet (WebGPU). Aqui eles são montados com a MESMA
// regra, sem GPU: camada 0 = xadrez de reserva e depois uma camada por textura, na ordem de inserção
// do Map devolvido por loadTextures (paredes: { layer, width, height }; flats: 64x64).

import fs from 'node:fs';
import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import { WadFile } from '../src/wad/WadFile.js';
import { loadMap } from '../src/wad/MapData.js';
import { loadTextures, usedTextureNames } from '../src/wad/Textures.js';
import { skyNameForMap } from '../src/wad/Colormap.js';
import { buildWalls } from '../src/map/buildWalls.js';
import { buildFlats } from '../src/map/buildFlats.js';

export const BASELINE_PATH = new URL('./baselines/geometry-e1m1.json', import.meta.url);

// Mesma regra de createTextureSet (src/gpu/TextureSet.js) para os índices de camada.
export function layerMaps(textures) {
  const wallLayers = new Map();
  let n = 1;
  for (const [name, t] of textures.wallTextures) wallLayers.set(name, { layer: n++, width: t.width, height: t.height });
  const flatLayers = new Map();
  n = 1;
  for (const name of textures.flats.keys()) flatLayers.set(name, { layer: n++, width: 64, height: 64 });
  return { wallLayers, flatLayers };
}

// SHA-256 dos BYTES do array tipado (vertices é Float32Array; indices, Uint32Array).
const sha = (typed) => crypto.createHash('sha256').update(Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength)).digest('hex');

// Geometria estática do mapa, como o jogo monta. wallNames: função que devolve os nomes de parede pedidos
// (padrão: os do mapa mais o céu, como em main.js); options: repassado a buildWalls e buildFlats.
export function staticGeometry(wad, mapName = 'E1M1', { wallNames = null, build = null } = {}) {
  const map = loadMap(wad, mapName);
  const used = usedTextureNames(map);
  used.walls.add(skyNameForMap(mapName));
  const names = wallNames ? wallNames(map, used.walls) : used.walls;
  const textures = loadTextures(wad, names, used.flats);
  const { wallLayers, flatLayers } = layerMaps(textures);
  const walls = build ? build.walls(map, wallLayers) : buildWalls(map, wallLayers);
  const flats = build ? build.flats(map, flatLayers) : buildFlats(map, flatLayers);
  return { map, walls, flats, wallLayers, flatLayers };
}

export function geometryDigest(walls, flats) {
  return {
    walls: { vertexCount: walls.vertexCount, indexCount: walls.indices.length, vertices: sha(walls.vertices), indices: sha(walls.indices) },
    flats: { vertexCount: flats.vertexCount, indexCount: flats.indices.length, vertices: sha(flats.vertices), indices: sha(flats.indices) },
  };
}

export function loadWad() {
  const bytes = fs.readFileSync(new URL('../assets/freedoom1.wad', import.meta.url));
  return new WadFile(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

// Executado diretamente (não quando importado pelo check-specials): grava a linha de base. Ela registra a
// geometria de ANTES da refatoração da etapa 20; uma existente só é sobrescrita com --force.
if (process.argv[1]?.endsWith('baseline-geometry.mjs')) {
  if (fs.existsSync(BASELINE_PATH) && !process.argv.includes('--force')) {
    console.log(`Linha de base já existe (${BASELINE_PATH.pathname}); use --force para sobrescrever.`);
    process.exit(0);
  }
  const { walls, flats } = staticGeometry(loadWad());
  const digest = { map: 'E1M1', createdAt: new Date().toISOString(), ...geometryDigest(walls, flats) };
  fs.mkdirSync(new URL('./baselines/', import.meta.url), { recursive: true });
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(digest, null, 2)}\n`);
  console.log(JSON.stringify(digest, null, 2));
}
