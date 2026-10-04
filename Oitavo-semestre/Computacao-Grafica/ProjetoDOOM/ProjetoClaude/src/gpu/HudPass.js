// Passada da camada de interface (pistola + barra de status), no padrão do MenuPass (sem alterá-lo):
// textura 320x200 atualizada só quando suja, escala inteira centralizada, extensão lateral da barra.

import { SCENE_FORMAT } from './Display.js';
import { menuPlacement } from './MenuPass.js';

export const HUD_W = 320;
export const HUD_H = 200;
const UNIFORM_BYTES = 16; // vec4<f32>: origem x, origem y, escala, 0

export class HudPass {
  // Devolve a passada pronta, ou null se a validação falhar (erro completo no console e no quadro).
  // module: hud.wgsl já compilado; report(err): mostra no quadro vermelho de erros.
  static async create(device, module, report) {
    device.pushErrorScope('validation');
    let pipeline = null;
    let pass = null;
    let asyncError = null;
    try {
      pipeline = await device.createRenderPipelineAsync({
        label: 'hud: pipeline',
        layout: 'auto',
        vertex: { module, entryPoint: 'hud_vs' },
        fragment: { module, entryPoint: 'hud_fs', targets: [{ format: SCENE_FORMAT }] },
        primitive: { topology: 'triangle-list' },
      });
      pass = new HudPass(device, pipeline);
    } catch (err) {
      asyncError = err;
    }
    const scopeError = await device.popErrorScope();
    const error = asyncError ?? scopeError;
    if (error) {
      const message = `HUD (pistola e barra) desligado nesta sessão: ${error.message ?? error}`;
      console.error(message, error);
      report?.(new Error(message));
      return null;
    }
    return pass;
  }

  constructor(device, pipeline) {
    this.device = device;
    this.pipeline = pipeline;
    this.texture = device.createTexture({
      label: 'hud: textura 320x200',
      size: [HUD_W, HUD_H],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.uniformBuffer = device.createBuffer({
      label: 'hud: uniform',
      size: UNIFORM_BYTES,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.bindGroup = device.createBindGroup({
      label: 'hud: bind group',
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.texture.createView({ label: 'hud: view' }) },
        { binding: 1, resource: { buffer: this.uniformBuffer } },
      ],
    });
  }

  // rgba: Uint8ClampedArray 320x200x4 de composeHud. Chamado só quando a imagem está suja.
  upload(rgba) {
    this.device.queue.writeTexture({ texture: this.texture }, rgba, { bytesPerRow: HUD_W * 4 }, [HUD_W, HUD_H]);
  }

  // Desenha sobre a textura interna da cena (load/store, sem depth). W, H: tamanho dela (Display).
  draw(encoder, colorView, W, H) {
    const { scale, ox, oy } = menuPlacement(W, H); // mesmas regras de escala e posição do menu
    this.device.queue.writeBuffer(this.uniformBuffer, 0, new Float32Array([ox, oy, scale, 0]));
    const pass = encoder.beginRenderPass({
      label: 'hud: passada',
      colorAttachments: [{ view: colorView, loadOp: 'load', storeOp: 'store' }],
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(3);
    pass.end();
  }
}
