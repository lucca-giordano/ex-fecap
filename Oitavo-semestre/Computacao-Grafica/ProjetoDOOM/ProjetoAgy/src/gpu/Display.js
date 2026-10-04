import { blitShaderCode } from '../blitShader.js';

export const INTERNAL_HEIGHT = 400;
export const RETRO_WIDTH = 640;
export const RETRO_DISPLAY_ASPECT = 4 / 3;
export const VERTICAL_FOV_RAD = 2 * Math.atan(0.75); // ~1.2870 rad (~73.74 graus)
export const DEFAULT_MODE = 'retro';
export const DEFAULT_CRT = true;

/**
 * Gerenciador de exibição, resolução interna e pós-processamento CRT:
 * - Modo Retro: renderização em 640x400 esticada para proporção 4:3 centralizada.
 * - Modo Moderno: renderização em 400p com largura adaptada à proporção do canvas.
 * - Efeito CRT: scanlines, distorção em barril e máscara de fósforo via Timothy Lottes.
 * - Gerencia texturas fora da tela e executa a passada de blit.
 */
export class Display {
    /**
     * @param {GPUDevice} device 
     * @param {GPUTextureFormat} presentationFormat 
     */
    constructor(device, presentationFormat) {
        this.device = device;
        this.presentationFormat = presentationFormat;
        this.mode = DEFAULT_MODE; // 'retro' | 'modern'
        this.crtEnabled = DEFAULT_CRT;

        this.internalWidth = RETRO_WIDTH;
        this.internalHeight = INTERNAL_HEIGHT;
        this.projAspect = RETRO_DISPLAY_ASPECT;

        this.destX = 0;
        this.destY = 0;
        this.destWidth = RETRO_WIDTH;
        this.destHeight = INTERNAL_HEIGHT;

        this.sceneColorTexture = null;
        this.sceneColorView = null;
        this.sceneDepthTexture = null;
        this.sceneDepthView = null;

        // Uniform buffer de pós-processamento (32 bytes):
        // internalSize: 2f (8B), rectSize: 2f (8B), time: 1f (4B), crt: 1f (4B), padding: 2f (8B)
        this.blitUniformBufferSize = 32;
        this.blitUniformBuffer = device.createBuffer({
            label: 'display.blitUniformBuffer',
            size: this.blitUniformBufferSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // Pipeline de Blit
        this.blitShaderModule = device.createShaderModule({
            label: 'display.blitShaderModule',
            code: blitShaderCode,
        });

        this.blitBindGroupLayout = device.createBindGroupLayout({
            label: 'display.blitBindGroupLayout',
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {
                        sampleType: 'float',
                        viewDimension: '2d',
                    },
                },
            ],
        });

        const blitPipelineLayout = device.createPipelineLayout({
            label: 'display.blitPipelineLayout',
            bindGroupLayouts: [this.blitBindGroupLayout],
        });

        this.blitPipeline = device.createRenderPipeline({
            label: 'display.blitPipeline',
            layout: blitPipelineLayout,
            vertex: {
                module: this.blitShaderModule,
                entryPoint: 'vs_blit',
            },
            fragment: {
                module: this.blitShaderModule,
                entryPoint: 'fs_blit',
                targets: [{ format: presentationFormat }],
            },
            primitive: {
                topology: 'triangle-list',
            },
        });

        this.blitBindGroup = null;
    }

    /**
     * Alterna entre modo retro e moderno.
     * @returns {string} Novo modo ('retro' ou 'modern')
     */
    toggleMode() {
        this.mode = (this.mode === 'retro') ? 'modern' : 'retro';
        return this.mode;
    }

    /**
     * Define explicitamente o modo de exibição.
     * @param {string} mode 'retro' ou 'moderno'/'modern'
     */
    setMode(mode) {
        this.mode = (mode === 'moderno' || mode === 'modern') ? 'modern' : 'retro';
    }

    /**
     * Alterna o efeito CRT ligado/desligado.
     * @returns {boolean} Novo estado
     */
    toggleCrt() {
        this.crtEnabled = !this.crtEnabled;
        return this.crtEnabled;
    }

    /**
     * Define o estado do efeito CRT.
     * @param {boolean} enabled 
     */
    setCrt(enabled) {
        this.crtEnabled = Boolean(enabled);
    }

    /**
     * Atualiza dimensões internas, retângulo de destino e envia os uniforms de pós-processamento.
     * 
     * @param {number} canvasWidth 
     * @param {number} canvasHeight 
     * @param {number} [time=0.0] Tempo decorrido em segundos
     * @returns {boolean} true se houve alteração na resolução interna ou no retângulo de destino
     */
    update(canvasWidth, canvasHeight, time = 0.0) {
        let newInternalWidth, newInternalHeight, newAspect;
        let newDestX, newDestY, newDestWidth, newDestHeight;

        if (this.mode === 'retro') {
            newInternalWidth = RETRO_WIDTH;
            newInternalHeight = INTERNAL_HEIGHT;
            newAspect = RETRO_DISPLAY_ASPECT; // 4/3

            const canvasAspect = canvasWidth / canvasHeight;
            if (canvasAspect > RETRO_DISPLAY_ASPECT) {
                // Canvas mais largo que 4:3 (pillarbox)
                newDestHeight = canvasHeight;
                newDestWidth = Math.round(canvasHeight * RETRO_DISPLAY_ASPECT);
                newDestX = Math.round((canvasWidth - newDestWidth) / 2);
                newDestY = 0;
            } else {
                // Canvas mais alto que 4:3 (letterbox)
                newDestWidth = canvasWidth;
                newDestHeight = Math.round(canvasWidth / RETRO_DISPLAY_ASPECT);
                newDestX = 0;
                newDestY = Math.round((canvasHeight - newDestHeight) / 2);
            }
        } else {
            // Modo Moderno: altura 400, largura proporcional com clamp [320, 1400], pixels quadrados
            newInternalHeight = INTERNAL_HEIGHT;
            const proportionalWidth = Math.round(INTERNAL_HEIGHT * (canvasWidth / canvasHeight));
            newInternalWidth = Math.min(Math.max(proportionalWidth, 320), 1400);
            newAspect = newInternalWidth / newInternalHeight;

            newDestX = 0;
            newDestY = 0;
            newDestWidth = canvasWidth;
            newDestHeight = canvasHeight;
        }

        const sizeChanged = (newInternalWidth !== this.internalWidth) || (newInternalHeight !== this.internalHeight);
        const rectChanged = (newDestX !== this.destX) || (newDestY !== this.destY) ||
                            (newDestWidth !== this.destWidth) || (newDestHeight !== this.destHeight);

        this.internalWidth = newInternalWidth;
        this.internalHeight = newInternalHeight;
        this.projAspect = newAspect;
        this.destX = newDestX;
        this.destY = newDestY;
        this.destWidth = newDestWidth;
        this.destHeight = newDestHeight;

        // Atualiza texturas fora da tela quando o tamanho interno mudar
        if (sizeChanged || !this.sceneColorTexture) {
            if (this.sceneColorTexture) this.sceneColorTexture.destroy();
            if (this.sceneDepthTexture) this.sceneDepthTexture.destroy();

            this.sceneColorTexture = this.device.createTexture({
                label: 'display.sceneColorTexture',
                size: [this.internalWidth, this.internalHeight, 1],
                format: 'rgba8unorm',
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
            });
            this.sceneColorView = this.sceneColorTexture.createView({ label: 'display.sceneColorView' });

            this.sceneDepthTexture = this.device.createTexture({
                label: 'display.sceneDepthTexture',
                size: [this.internalWidth, this.internalHeight, 1],
                format: 'depth24plus',
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
            });
            this.sceneDepthView = this.sceneDepthTexture.createView({ label: 'display.sceneDepthView' });

            // Atualiza bind group do blit
            this.blitBindGroup = this.device.createBindGroup({
                label: 'display.blitBindGroup',
                layout: this.blitBindGroupLayout,
                entries: [
                    { binding: 0, resource: { buffer: this.blitUniformBuffer } },
                    { binding: 1, resource: this.sceneColorView },
                ],
            });
        }

        // Atualiza uniforms do blit / CRT (32 bytes):
        // internalSize: 2f (8B), rectSize: 2f (8B), time: 1f (4B), crt: 1f (4B), padding: 2f (8B)
        const blitData = new Float32Array([
            this.internalWidth, this.internalHeight,
            this.destWidth, this.destHeight,
            time,
            this.crtEnabled ? 1.0 : 0.0,
            0.0, 0.0,
        ]);
        this.device.queue.writeBuffer(this.blitUniformBuffer, 0, blitData);

        return sizeChanged || rectChanged;
    }

    /**
     * Executa a passada de blit, copiando a renderização fora da tela para o canvas.
     * 
     * @param {GPUCommandEncoder} commandEncoder 
     * @param {GPUTextureView} canvasTextureView 
     */
    recordBlitPass(commandEncoder, canvasTextureView) {
        const blitPassDesc = {
            colorAttachments: [
                {
                    view: canvasTextureView,
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        };

        const pass = commandEncoder.beginRenderPass(blitPassDesc);
        pass.setPipeline(this.blitPipeline);
        pass.setViewport(this.destX, this.destY, this.destWidth, this.destHeight, 0.0, 1.0);
        pass.setScissorRect(this.destX, this.destY, this.destWidth, this.destHeight);
        pass.setBindGroup(0, this.blitBindGroup);
        pass.draw(3, 1, 0, 0); // Fullscreen triangle
        pass.end();
    }
}
