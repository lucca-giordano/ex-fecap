// Partículas na GPU: buffer, passada de compute (simulate) e passada de desenho (vs_main/fs_main).
// Segue a forma do exemplo "Particles": o buffer de partículas é STORAGE na simulação e VERTEX
// (stepMode 'instance') no desenho, mais um quad buffer de 6 vértices.

import { SCENE_FORMAT, DEPTH_FORMAT } from './Display.js';
import {
  MAX_PARTICLES, PARTICLE_STRIDE, PARTICLE_OFFSETS, SIM_UNIFORM_SIZE, RENDER_UNIFORM_SIZE,
  WORKGROUP_SIZE, workgroupCount,
} from '../particles/particleConfig.js';

const QUAD = new Float32Array([-1, -1, +1, -1, -1, +1, -1, +1, +1, -1, +1, +1]); // igual ao exemplo

export class ParticlePass {
  // Devolve null se a criação falhar (o erro completo vai para o console); o jogo segue sem partículas.
  // module: particles.wgsl já compilado; litPaletteView: paleta iluminada 256x32 (TextureSet).
  static async create(device, module, litPaletteView) {
    const bufferSize = MAX_PARTICLES * PARTICLE_STRIDE;
    const lim = device.limits;
    console.log(`Partículas: limites do dispositivo: maxStorageBufferBindingSize ${lim.maxStorageBufferBindingSize}, ` +
      `maxComputeWorkgroupSizeX ${lim.maxComputeWorkgroupSizeX}, ` +
      `maxComputeInvocationsPerWorkgroup ${lim.maxComputeInvocationsPerWorkgroup}, ` +
      `maxStorageBuffersPerShaderStage ${lim.maxStorageBuffersPerShaderStage}, ` +
      `maxVertexBuffers ${lim.maxVertexBuffers}, maxVertexAttributes ${lim.maxVertexAttributes}`);
    if (bufferSize > lim.maxStorageBufferBindingSize || WORKGROUP_SIZE > lim.maxComputeWorkgroupSizeX ||
        WORKGROUP_SIZE > lim.maxComputeInvocationsPerWorkgroup) {
      console.error('Partículas: o dispositivo não suporta o tamanho de buffer ou de workgroup necessário');
      return null;
    }
    try {
      const computePipeline = await device.createComputePipelineAsync({
        label: 'partículas: simulate',
        layout: 'auto',
        compute: { module, entryPoint: 'simulate' },
      });
      const renderPipeline = await device.createRenderPipelineAsync({
        label: 'partículas: desenho',
        layout: 'auto',
        vertex: {
          module,
          entryPoint: 'vs_main',
          buffers: [
            {
              // instanced particles buffer
              arrayStride: PARTICLE_STRIDE,
              stepMode: 'instance',
              attributes: [
                { shaderLocation: 0, offset: PARTICLE_OFFSETS.position, format: 'float32x3' },
                { shaderLocation: 1, offset: PARTICLE_OFFSETS.life, format: 'float32' },
                { shaderLocation: 2, offset: PARTICLE_OFFSETS.kind, format: 'float32' },
                { shaderLocation: 3, offset: PARTICLE_OFFSETS.params, format: 'float32x4' },
              ],
            },
            {
              // quad vertex buffer
              arrayStride: 2 * 4,
              stepMode: 'vertex',
              attributes: [{ shaderLocation: 4, offset: 0, format: 'float32x2' }],
            },
          ],
        },
        // Sem blending: quad opaco.
        fragment: { module, entryPoint: 'fs_main', targets: [{ format: SCENE_FORMAT }] },
        primitive: { topology: 'triangle-list' },
        depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: true, depthCompare: 'less' },
      });
      return new ParticlePass(device, computePipeline, renderPipeline, litPaletteView, bufferSize);
    } catch (err) {
      console.error('Partículas: falha ao criar as pipelines; recurso desligado nesta sessão.', err);
      return null;
    }
  }

  constructor(device, computePipeline, renderPipeline, litPaletteView, bufferSize) {
    this.device = device;
    this.computePipeline = computePipeline;
    this.renderPipeline = renderPipeline;

    // Buffer zerado na criação: params.w = 0 marca "ainda não nasceu" (o shader faz o primeiro nascimento).
    this.particlesBuffer = device.createBuffer({
      label: 'partículas',
      size: bufferSize,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE,
    });
    this.quadVertexBuffer = device.createBuffer({
      label: 'partículas: quad',
      size: QUAD.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    new Float32Array(this.quadVertexBuffer.getMappedRange()).set(QUAD);
    this.quadVertexBuffer.unmap();

    this.simulationUBOBuffer = device.createBuffer({
      label: 'partículas: uniform da simulação',
      size: SIM_UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.uniformBuffer = device.createBuffer({
      label: 'partículas: uniform do desenho',
      size: RENDER_UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.computeBindGroup = device.createBindGroup({
      layout: computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.simulationUBOBuffer } },
        { binding: 1, resource: { buffer: this.particlesBuffer } },
      ],
    });
    this.renderBindGroup = device.createBindGroup({
      layout: renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: litPaletteView },
      ],
    });
    console.log(`Partículas: struct ${PARTICLE_STRIDE} bytes, buffer ${bufferSize} bytes (${MAX_PARTICLES} partículas), ` +
      `uniform da simulação ${SIM_UNIFORM_SIZE} bytes, uniform do desenho ${RENDER_UNIFORM_SIZE} bytes`);
  }

  // simData / renderData: ArrayBuffers de packSimUniforms / packRenderUniforms.
  writeUniforms(simData, renderData) {
    this.device.queue.writeBuffer(this.simulationUBOBuffer, 0, simData);
    this.device.queue.writeBuffer(this.uniformBuffer, 0, renderData);
  }

  encodeCompute(encoder, count) {
    const pass = encoder.beginComputePass({ label: 'partículas: simulate' });
    pass.setPipeline(this.computePipeline);
    pass.setBindGroup(0, this.computeBindGroup);
    pass.dispatchWorkgroups(workgroupCount(count));
    pass.end();
  }

  // Desenha sobre a cena já pronta, usando o depth buffer dela (load/store).
  encodeDraw(encoder, colorView, depthView, count) {
    const pass = encoder.beginRenderPass({
      label: 'partículas',
      colorAttachments: [{ view: colorView, loadOp: 'load', storeOp: 'store' }],
      depthStencilAttachment: { view: depthView, depthLoadOp: 'load', depthStoreOp: 'store' },
    });
    pass.setPipeline(this.renderPipeline);
    pass.setBindGroup(0, this.renderBindGroup);
    pass.setVertexBuffer(0, this.particlesBuffer);
    pass.setVertexBuffer(1, this.quadVertexBuffer);
    pass.draw(6, count, 0, 0);
    pass.end();
  }
}
