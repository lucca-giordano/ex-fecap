// GPU de um nível (etapa 23): texture arrays de paredes e flats, buffers de geometria estática e dinâmica,
// recursos de sprites e os bind groups que os referenciam. Pipelines, layouts e a paleta são globais e
// chegam prontos em `globals`. Tudo é criado dentro de pushErrorScope('validation'); se algo falhar, o que
// foi criado é destruído e o erro é lançado (o nível atual continua intacto).
// O device chega por parâmetro (os testes usam um device falso no Node).

import { createTextureSet } from './TextureSet.js';
import { SpriteSet } from './SpriteSet.js';
import { MAX_EFFECTS } from '../game/effects.js';
import { MAX_DROPS } from '../game/ItemSystem.js';
import { MAX_MISSILES } from '../game/Missiles.js';

// Objetos de GPU vivos criados por níveis (para verificar vazamentos).
export const liveCounts = { buffers: 0, textures: 0, bindGroups: 0 };
const add = (c, sign = 1) => { for (const k of Object.keys(liveCounts)) liveCounts[k] += sign * (c[k] ?? 0); };

// data: buildLevelData; globals: { textureLayout, paletteView, spritePipeline (ou null) }.
// Devolve { textureSet, walls, flats, staticBuffers, dynamic, sprites, movingEnabled, counts, dispose() }.
export async function uploadLevel(device, data, globals) {
  const owned = [];             // { destroy(), counts }
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const o of owned.reverse()) { o.destroy(); add(o.counts, -1); }
  };
  const own = (destroyable, counts) => {
    owned.push({ destroy: () => destroyable.destroy(), counts });
    add(counts);
    return destroyable;
  };
  const makeBuffer = (bytes, usage, label) => {
    const buffer = own(device.createBuffer({ label, size: Math.max(4, bytes.byteLength), usage: usage | GPUBufferUsage.COPY_DST }), { buffers: 1 });
    device.queue.writeBuffer(buffer, 0, bytes);
    return buffer;
  };
  const result = { walls: data.walls, flats: data.flats, dynamic: null, sprites: null, movingEnabled: true, warnings: [] };

  // 1. Setores móveis (escopo próprio): sem eles, a geometria estática volta sem exclusões (etapa 20).
  const geo = data.dyn;
  if (geo.vertexCount > 0) {
    device.pushErrorScope('validation');
    let error = null;
    const before = owned.length;
    try {
      const max = device.limits.maxBufferSize;
      if (geo.byteLength > max || geo.indices.byteLength > max) throw new Error(`buffers dinâmicos maiores que maxBufferSize (${max})`);
      result.dynamic = {
        geo,
        vb: {
          flat: makeBuffer(geo.vertices, GPUBufferUsage.VERTEX, `${data.name}: setores móveis (vértices, cor por flat)`),
          sector: makeBuffer(geo.sectorVertices, GPUBufferUsage.VERTEX, `${data.name}: setores móveis (vértices, cor por setor)`),
        },
        ib: makeBuffer(geo.indices, GPUBufferUsage.INDEX, `${data.name}: setores móveis (índices)`),
      };
      geo.dirty = false;
    } catch (err) {
      error = err;
    }
    error = error ?? await device.popErrorScope();
    if (error) {
      for (const o of owned.splice(before)) { o.destroy(); add(o.counts, -1); }
      result.dynamic = null;
      result.movingEnabled = false;
      result.warnings.push(`setores móveis desligados neste nível: ${error.message}`);
      const full = data.staticWithoutExclusions();
      result.walls = full.walls;
      result.flats = full.flats;
    }
  }

  // 2. Texturas e geometria estática: qualquer falha cancela o nível inteiro.
  device.pushErrorScope('validation');
  let error = null;
  try {
    const ts = createTextureSet(device, globals.textureLayout, data.textures, null, data.skyName, { paletteView: globals.paletteView });
    owned.push({ destroy: () => ts.destroy(), counts: ts.counts });
    add(ts.counts);
    result.textureSet = ts;
    result.staticBuffers = {
      vertex: makeBuffer(result.walls.vertices, GPUBufferUsage.VERTEX, `${data.name}: paredes (vértices)`),
      index: makeBuffer(result.walls.indices, GPUBufferUsage.INDEX, `${data.name}: paredes (índices)`),
      flat: makeBuffer(result.flats.vertices, GPUBufferUsage.VERTEX, `${data.name}: planos (vértices, cor por flat)`),
      sector: makeBuffer(result.flats.sectorColorVertices, GPUBufferUsage.VERTEX, `${data.name}: planos (vértices, cor por setor)`),
      flatIndex: makeBuffer(result.flats.indices, GPUBufferUsage.INDEX, `${data.name}: planos (índices)`),
    };
  } catch (err) {
    error = err;
  }
  error = error ?? await device.popErrorScope();
  if (error) {
    dispose();
    throw new Error(`${data.name}: falha ao criar a GPU do nível: ${error.message ?? error}`);
  }

  // 3. Sprites (escopo próprio): sem eles, o nível segue sem sprites (como nas etapas anteriores).
  if (globals.spritePipeline && data.spriteScene) {
    device.pushErrorScope('validation');
    let spriteError = null;
    let set = null;
    try {
      const capacity = data.spriteScene.objects.length + MAX_EFFECTS + MAX_DROPS + MAX_MISSILES;
      set = new SpriteSet(device, globals.spritePipeline, data.spriteScene, globals.paletteView, capacity);
      owned.push({ destroy: () => set.destroy(), counts: set.counts });
      add(set.counts);
    } catch (err) {
      spriteError = err;
    }
    spriteError = spriteError ?? await device.popErrorScope();
    if (spriteError) {
      const last = owned.at(-1);
      if (set && last?.counts === set.counts) { owned.pop(); set.destroy(); add(set.counts, -1); }
      result.warnings.push(`sprites desligados neste nível: ${spriteError.message ?? spriteError}`);
    } else {
      result.sprites = set;
    }
  }

  const counts = { buffers: 0, textures: 0, bindGroups: 0 };
  for (const o of owned) for (const k of Object.keys(counts)) counts[k] += o.counts[k] ?? 0;
  return { ...result, counts, dispose };
}
