// Passada do menu: desenha a imagem 320x200 do menu na textura interna da cena (a mesma da etapa 6),
// depois da cena e antes do blit/CRT, para o CRT valer também para o menu.

import { SCENE_FORMAT } from './Display.js';

export const MENU_W = 320;
export const MENU_H = 200;
const UNIFORM_BYTES = 16; // vec4<f32>: origem x, origem y, escala, 0

// Escala inteira e origem centralizada para uma imagem interna W x H.
export function menuPlacement(W, H) {
  const scale = Math.max(1, Math.min(Math.floor(H / MENU_H), Math.floor(W / MENU_W)));
  return {
    scale,
    ox: Math.floor((W - MENU_W * scale) / 2),
    oy: Math.floor((H - MENU_H * scale) / 2),
  };
}

export class MenuPass {
  // module: menu.wgsl já compilado (createCheckedShaderModule).
  constructor(device, module) {
    this.device = device;
    this.texture = device.createTexture({
      label: 'menu 320x200',
      size: [MENU_W, MENU_H],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.uniformBuffer = device.createBuffer({
      label: 'uniform do menu',
      size: UNIFORM_BYTES,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    console.log(`Uniform do menu: ${UNIFORM_BYTES} bytes (vec4<f32>)`);
    // Sem blending: o descarte no shader faz o papel do teste de alfa.
    this.pipeline = device.createRenderPipeline({
      label: 'menu',
      layout: 'auto',
      vertex: { module, entryPoint: 'vs_main' },
      fragment: { module, entryPoint: 'fs_main', targets: [{ format: SCENE_FORMAT }] },
      primitive: { topology: 'triangle-list' },
    });
    this.bindGroup = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.texture.createView() },
        { binding: 1, resource: { buffer: this.uniformBuffer } },
      ],
    });
  }

  // rgba: Uint8ClampedArray 320x200x4 de composeMenu. Chamado só quando a imagem está suja.
  upload(rgba) {
    this.device.queue.writeTexture({ texture: this.texture }, rgba, { bytesPerRow: MENU_W * 4 }, [MENU_W, MENU_H]);
  }

  // colorView: textura interna da cena; W, H: seu tamanho (lido do Display).
  // clear = true: limpa de preto (tela de título, sem a cena 3D); false: desenha por cima da cena.
  draw(encoder, colorView, W, H, clear) {
    const { scale, ox, oy } = menuPlacement(W, H);
    this.device.queue.writeBuffer(this.uniformBuffer, 0, new Float32Array([ox, oy, scale, 0]));
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: colorView,
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: clear ? 'clear' : 'load',
        storeOp: 'store',
      }],
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(3);
    pass.end();
  }
}
