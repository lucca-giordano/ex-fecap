// Renderização em resolução interna fixa + blit para o canvas, com dois modos de exibição
// (configuração visualMode, lida de core/Settings.js a cada frame):
//   retro:   640x400 exibido num retângulo 4:3 centralizado (pixels 1.2x mais altos, como no monitor
//            original), com barras pretas;
//   moderno: altura 400 e largura proporcional à janela, pixels quadrados, tela inteira.

export const INTERNAL_HEIGHT = 400;
export const RETRO_WIDTH = 640;
export const RETRO_DISPLAY_ASPECT = 4 / 3;
export const SCENE_FORMAT = 'rgba8unorm';
export const DEPTH_FORMAT = 'depth24plus';

const MODERN_MIN_WIDTH = 320;
const MODERN_MAX_WIDTH = 1400;

// Uniform de pós-processamento (struct PostUniforms em blit.wgsl): internalSize vec2, rectSize vec2,
// time f32, crt f32 e 8 bytes de padding = 8 floats = 32 bytes.
const POST_UNIFORM_FLOATS = 8;

export class Display {
  // blitModule: módulo com blit.wgsl + crt.wgsl (ver createCheckedShaderModule).
  // settings: fonte única de visualMode e crt (o Display não guarda cópia).
  constructor(device, canvas, context, canvasFormat, blitModule, settings) {
    this.device = device;
    this.canvas = canvas;
    this.context = context;
    this.settings = settings;
    this.internal = { width: 0, height: 0 };
    this.rect = { x: 0, y: 0, width: 1, height: 1 };
    this.colorTexture = null;
    this.depthTexture = null;
    this.logPending = true; // imprime a configuração no primeiro update e a cada troca de modo

    const module = blitModule;
    this.pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module, entryPoint: 'vs_main' },
      fragment: { module, entryPoint: 'fs_main', targets: [{ format: canvasFormat }] },
      primitive: { topology: 'triangle-list' },
    });
    this.uniformBuffer = device.createBuffer({
      size: 32, // 3 x vec2<f32> (24 bytes), arredondado
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.postData = new Float32Array(POST_UNIFORM_FLOATS);
    this.postBuffer = device.createBuffer({
      label: 'uniform de pós-processamento',
      size: this.postData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    console.log(`Uniform de pós-processamento: ${this.postData.byteLength} bytes ` +
      `(struct WGSL: 32 bytes), buffer de ${this.postBuffer.size} bytes: ` +
      `${this.postData.byteLength <= this.postBuffer.size ? 'cabe' : 'NÃO cabe'}`);
  }

  get retro() {
    return this.settings.get('visualMode') === 'retro';
  }

  get modeLabel() {
    return this.retro ? 'Retro 4:3' : 'Moderno';
  }

  // Aspecto da projeção: o da TELA (4:3) no retro, o da imagem interna no moderno.
  get projectionAspect() {
    return this.retro ? RETRO_DISPLAY_ASPECT : this.internal.width / this.internal.height;
  }

  // Chamado a cada frame: ajusta o canvas à janela, calcula resolução interna e retângulo,
  // e recria as texturas fora da tela só quando o tamanho interno muda.
  update() {
    const dpr = window.devicePixelRatio || 1;
    const cw = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    const ch = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
    // Mudar width/height redimensiona a textura do contexto WebGPU na próxima getCurrentTexture().
    if (this.canvas.width !== cw) this.canvas.width = cw;
    if (this.canvas.height !== ch) this.canvas.height = ch;

    let iw, rect;
    if (this.retro) {
      iw = RETRO_WIDTH;
      // Maior retângulo 4:3 que cabe no canvas, centralizado, em pixels inteiros.
      let w = cw, h = Math.round(cw / RETRO_DISPLAY_ASPECT);
      if (h > ch) { h = ch; w = Math.round(ch * RETRO_DISPLAY_ASPECT); }
      rect = { x: Math.floor((cw - w) / 2), y: Math.floor((ch - h) / 2), width: w, height: h };
    } else {
      iw = Math.min(MODERN_MAX_WIDTH, Math.max(MODERN_MIN_WIDTH, Math.round(INTERNAL_HEIGHT * cw / ch)));
      rect = { x: 0, y: 0, width: cw, height: ch };
    }
    this.rect = rect;

    if (iw !== this.internal.width || INTERNAL_HEIGHT !== this.internal.height) {
      this.internal = { width: iw, height: INTERNAL_HEIGHT };
      this.createTargets();
    }

    if (this.logPending) {
      this.logPending = false;
      console.log(`Exibição ${this.modeLabel}: interna ${iw}x${INTERNAL_HEIGHT}, ` +
        `retângulo ${rect.width}x${rect.height} em (${rect.x}, ${rect.y}), canvas ${cw}x${ch}`);
    }

    this.device.queue.writeBuffer(this.uniformBuffer, 0, new Float32Array([
      rect.x, rect.y, rect.width, rect.height, iw, INTERNAL_HEIGHT,
    ]));
    // internalSize, rectSize, time (reservado), crt, padding.
    this.postData.set([
      iw, INTERNAL_HEIGHT, rect.width, rect.height, performance.now() / 1000, this.settings.get('crt') ? 1 : 0, 0, 0,
    ]);
    this.device.queue.writeBuffer(this.postBuffer, 0, this.postData);
  }

  createTargets() {
    const { width, height } = this.internal;
    this.colorTexture?.destroy();
    this.depthTexture?.destroy();
    this.colorTexture = this.device.createTexture({
      label: 'cena (resolução interna)',
      size: [width, height],
      format: SCENE_FORMAT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.depthTexture = this.device.createTexture({
      label: 'depth (resolução interna)',
      size: [width, height],
      format: DEPTH_FORMAT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.colorView = this.colorTexture.createView();
    this.depthView = this.depthTexture.createView();
    this.bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.colorView },
        { binding: 1, resource: { buffer: this.uniformBuffer } },
        { binding: 2, resource: { buffer: this.postBuffer } },
      ],
    });
  }

  // Segunda passada: limpa o canvas de preto (barras) e desenha a cena no retângulo.
  blit(encoder) {
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    const r = this.rect;
    pass.setViewport(r.x, r.y, r.width, r.height, 0, 1);
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(3);
    pass.end();
  }
}
