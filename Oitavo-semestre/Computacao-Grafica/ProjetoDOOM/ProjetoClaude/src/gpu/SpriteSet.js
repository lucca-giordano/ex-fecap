// Sprites na GPU: texture array das imagens, metadados por camada, instâncias por objeto,
// pipeline e passada. A montagem da cena (quais lumps, quais objetos) vem de spriteLogic.js.

import { SCENE_FORMAT, DEPTH_FORMAT } from './Display.js';
import { INSTANCE_STRIDE, INSTANCE_OFFSETS } from '../sprites/spriteLogic.js';

export const SPRITE_UNIFORM_SIZE = 112; // viewProj 64 + right 16 + cameraPos 16 + params vec4u 16

export class SpriteSet {
  // Devolve null se algo falhar (erro completo no console e em `report`); o jogo segue sem sprites.
  // module: walls.wgsl + sprites.wgsl compilados; scene: resultado de buildSpriteScene;
  // litPaletteView: paleta iluminada 256x32 (TextureSet); capacity: instâncias por frame
  // (etapa 15: objetos do mapa + efeitos). Pipeline, texturas, buffers e bind group são criados
  // dentro de pushErrorScope('validation'): só são usados se a validação passar.
  static async create(device, module, scene, litPaletteView, { capacity = scene.objects.length, report } = {}) {
    device.pushErrorScope('validation');
    let set = null;
    let error = null;
    try {
      const pipeline = await SpriteSet.createPipeline(device, module);
      set = new SpriteSet(device, pipeline, scene, litPaletteView, capacity);
    } catch (err) {
      error = err;
    }
    const scopeError = await device.popErrorScope();
    error = error ?? scopeError;
    if (error) {
      set?.destroy();
      const message = `Sprites desligados nesta sessão: ${error.message ?? error}`;
      console.error(message, error);
      report?.(new Error(message));
      return null;
    }
    return set;
  }

  // Etapa 23: a pipeline é global (criada uma vez); cada nível cria só os recursos (new SpriteSet).
  static createPipeline(device, module) {
    return device.createRenderPipelineAsync({
      label: 'sprites: pipeline',
      layout: 'auto',
      vertex: {
        module,
        entryPoint: 'sp_vs',
        buffers: [{
          arrayStride: INSTANCE_STRIDE,
          stepMode: 'instance',
          attributes: [
            { shaderLocation: 0, offset: INSTANCE_OFFSETS.base, format: 'float32x3' },
            { shaderLocation: 1, offset: INSTANCE_OFFSETS.layer, format: 'uint32' },
            { shaderLocation: 2, offset: INSTANCE_OFFSETS.lightnum, format: 'uint32' },
            { shaderLocation: 3, offset: INSTANCE_OFFSETS.flags, format: 'uint32' },
          ],
        }],
      },
      // Sem blending: pixels opacos com teste e escrita de profundidade; os transparentes são descartados.
      fragment: { module, entryPoint: 'sp_fs', targets: [{ format: SCENE_FORMAT }] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: true, depthCompare: 'less' },
    });
  }

  // Recursos do nível (texture array, metadados, instâncias, uniform e bind group).
  destroy() {
    for (const o of [this.texture, this.metaBuffer, this.instanceBuffer, this.uniformBuffer]) o?.destroy();
  }

  get counts() {
    return { textures: 1, buffers: 3, bindGroups: 1 };
  }

  constructor(device, pipeline, scene, litPaletteView, capacity) {
    this.device = device;
    this.pipeline = pipeline;
    const { layers } = scene;

    // Texture array rg8uint: uma camada por lump; cada sprite no canto superior esquerdo.
    const layerW = Math.max(1, ...layers.map((l) => l.patch.width));
    const layerH = Math.max(1, ...layers.map((l) => l.patch.height));
    const { maxTextureArrayLayers, maxTextureDimension2D } = device.limits;
    if (layers.length > maxTextureArrayLayers || layerW > maxTextureDimension2D || layerH > maxTextureDimension2D) {
      throw new Error(`Sprites: ${layers.length} camadas de ${layerW}x${layerH} excedem os limites do dispositivo ` +
        `(${maxTextureArrayLayers} camadas, ${maxTextureDimension2D} px)`);
    }
    // Limites conferidos ANTES de criar qualquer objeto (etapa 23: uma falha não deixa nada vivo).
    const metaBytes = Math.max(1, layers.length) * 4 * 4;
    const instanceBytes = Math.max(1, capacity) * INSTANCE_STRIDE;
    const { maxStorageBufferBindingSize, maxBufferSize } = device.limits;
    for (const [name, bytes] of [['metadados', metaBytes], ['instâncias', instanceBytes]]) {
      if (bytes > maxStorageBufferBindingSize || bytes > maxBufferSize) {
        throw new Error(`Sprites: buffer de ${name} com ${bytes} bytes excede maxStorageBufferBindingSize ` +
          `(${maxStorageBufferBindingSize}) ou maxBufferSize (${maxBufferSize})`);
      }
    }
    this.texture = device.createTexture({
      label: 'sprites: texture array',
      size: [layerW, layerH, Math.max(1, layers.length)],
      format: 'rg8uint',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    const meta = new Int32Array(Math.max(1, layers.length) * 4);
    layers.forEach(({ patch }, i) => {
      const data = new Uint8Array(layerW * layerH * 2);
      for (let y = 0; y < patch.height; y++) {
        for (let x = 0; x < patch.width; x++) {
          const s = y * patch.width + x, d = (y * layerW + x) * 2;
          data[d] = patch.indices[s];
          data[d + 1] = patch.opacity[s];
        }
      }
      device.queue.writeTexture({ texture: this.texture, origin: [0, 0, i] }, data,
        { bytesPerRow: layerW * 2, rowsPerImage: layerH }, [layerW, layerH, 1]);
      meta.set([patch.width, patch.height, patch.leftOffset, patch.topOffset], i * 4);
    });
    // Instâncias: objetos do mapa + efeitos (capacity), reescritas a cada frame.
    this.instanceData = new ArrayBuffer(instanceBytes);
    this.metaBuffer = device.createBuffer({
      label: 'sprites: metadados', size: meta.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(this.metaBuffer, 0, meta);
    this.instanceBuffer = device.createBuffer({
      label: 'sprites: instâncias', size: this.instanceData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.uniformBuffer = device.createBuffer({
      label: 'sprites: uniform', size: SPRITE_UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.bindGroup = device.createBindGroup({
      label: 'sprites: bind group',
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 1, resource: { buffer: this.uniformBuffer } },
        { binding: 2, resource: this.texture.createView({ label: 'sprites: view', dimension: '2d-array' }) },
        { binding: 3, resource: { buffer: this.metaBuffer } },
        { binding: 4, resource: litPaletteView },
      ],
    });
    this.capacity = Math.max(1, capacity);
    this.info = { layers: layers.length, layerW, layerH, instances: this.capacity, instanceBytes: this.instanceData.byteLength };
  }

  // viewProj (column-major), right: direita horizontal da câmera [x, y, z], cameraPos [x, y, z].
  writeUniforms(viewProj, right, cameraPos, lighting) {
    const data = new ArrayBuffer(SPRITE_UNIFORM_SIZE);
    const f32 = new Float32Array(data);
    f32.set(viewProj, 0);
    f32.set([...right, 0], 16);
    f32.set([...cameraPos, 1], 20);
    new Uint32Array(data).set([lighting ? 1 : 0, 0, 0, 0], 24);
    this.device.queue.writeBuffer(this.uniformBuffer, 0, data);
  }

  writeInstances(count) {
    this.device.queue.writeBuffer(this.instanceBuffer, 0, this.instanceData, 0, count * INSTANCE_STRIDE);
  }

  // Passada própria depois da cena e antes das partículas, sobre a cor e o depth da cena (load/store).
  encodeDraw(encoder, colorView, depthView, count) {
    const pass = encoder.beginRenderPass({
      label: 'sprites: passada',
      colorAttachments: [{ view: colorView, loadOp: 'load', storeOp: 'store' }],
      depthStencilAttachment: { view: depthView, depthLoadOp: 'load', depthStoreOp: 'store' },
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.setVertexBuffer(0, this.instanceBuffer);
    pass.draw(6, count, 0, 0);
    pass.end();
  }
}
