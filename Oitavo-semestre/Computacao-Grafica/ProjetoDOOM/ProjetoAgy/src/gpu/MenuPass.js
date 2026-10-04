/**
 * Shader WGSL para renderização do menu 320x200 sobre a cena.
 * Projeta fullscreen triangle e mapeia coordenadas fracionárias para pixels inteiros do menu,
 * descartando pixels fora da moldura ou com canal alfa zerado.
 */
export const menuShaderCode = /* wgsl */ `
struct MenuUniforms {
    params: vec4<f32>, // x: ox, y: oy, z: scale, w: unused
};

@group(0) @binding(0) var<uniform> u_menu: MenuUniforms;
@group(0) @binding(1) var t_menu: texture_2d<f32>;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
};

@vertex
fn vs_menu(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var pos = array<vec2<f32>, 3>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 3.0, -1.0),
        vec2<f32>(-1.0,  3.0)
    );
    var out: VertexOutput;
    out.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
    return out;
}

@fragment
fn fs_menu(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
    let ox = u_menu.params.x;
    let oy = u_menu.params.y;
    let scale = u_menu.params.z;

    let px = floor(fragCoord.x);
    let py = floor(fragCoord.y);

    let mx = i32(floor((px - ox) / scale));
    let my = i32(floor((py - oy) / scale));

    if (mx < 0 || mx >= 320 || my < 0 || my >= 200) {
        discard;
    }

    let color = textureLoad(t_menu, vec2<i32>(mx, my), 0);
    if (color.a == 0.0) {
        discard;
    }

    return color;
}
`;

export function getMenuPipelineDescriptor(shaderModule, layout = 'auto', colorFormat = 'rgba8unorm') {
    return {
        label: 'menu.pipeline',
        layout,
        vertex: {
            module: shaderModule,
            entryPoint: 'vs_menu',
        },
        fragment: {
            module: shaderModule,
            entryPoint: 'fs_menu',
            targets: [{ format: colorFormat }],
        },
        primitive: {
            topology: 'triangle-list',
        },
    };
}

/**
 * Passada de GPU para desenhar a imagem de 320x200 do menu diretamente na textura
 * da cena interna antes do pós-processamento CRT.
 */
export class MenuPass {
    /**
     * @param {GPUDevice} device 
     */
    constructor(device) {
        this.device = device;
        this.width = 320;
        this.height = 200;
        this.bytesPerRow = 320 * 4; // 1280 bytes (múltiplo exato de 256)
        this.supported = true;
        this.lastError = null;

        // Textura do menu (320x200 rgba8unorm)
        this.menuTexture = device.createTexture({
            label: 'menu.texture',
            size: [this.width, this.height, 1],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
        });
        this.menuTextureView = this.menuTexture.createView({ label: 'menu.textureView' });

        // Uniform buffer de 16 bytes: vec4<f32>(ox, oy, escala, 0.0)
        this.uniformBufferSize = 16;
        this.uniformBuffer = device.createBuffer({
            label: 'menu.uniformBuffer',
            size: this.uniformBufferSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // Módulo do shader
        this.shaderModule = device.createShaderModule({
            label: 'menu.shaderModule',
            code: menuShaderCode,
        });

        // Bind Group Layout
        this.bindGroupLayout = device.createBindGroupLayout({
            label: 'menu.bindGroupLayout',
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

        this.bindGroup = device.createBindGroup({
            label: 'menu.bindGroup',
            layout: this.bindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer } },
                { binding: 1, resource: this.menuTextureView },
            ],
        });

        const pipelineLayout = device.createPipelineLayout({
            label: 'menu.pipelineLayout',
            bindGroupLayouts: [this.bindGroupLayout],
        });

        try {
            this.pipeline = device.createRenderPipeline(
                getMenuPipelineDescriptor(this.shaderModule, pipelineLayout, 'rgba8unorm')
            );
        } catch (err) {
            console.error('[MenuPass] Falha ao criar pipeline:', err);
            this.supported = false;
            this.lastError = err;
        }
    }

    /**
     * Envia o buffer de pixels RGBA para a GPU.
     * @param {Uint8ClampedArray|Uint8Array} pixels Buffer de 320x200x4 bytes
     */
    uploadPixels(pixels) {
        this.device.queue.writeTexture(
            { texture: this.menuTexture },
            pixels,
            { bytesPerRow: this.bytesPerRow, rowsPerImage: this.height },
            [this.width, this.height, 1]
        );
    }

    /**
     * Grava a passada de renderização do menu no Command Encoder.
     * 
     * @param {GPUCommandEncoder} commandEncoder 
     * @param {GPUTextureView} sceneColorView 
     * @param {number} sceneWidth Largura da textura interna da cena
     * @param {number} sceneHeight Altura da textura interna da cena
     * @param {boolean} started Indica se o jogo já iniciou
     */
    recordPass(commandEncoder, sceneColorView, sceneWidth, sceneHeight, started) {
        if (!this.supported || !this.pipeline) return;

        // Cálculo de escala inteira e centralização
        const scale = Math.max(1, Math.min(
            Math.floor(sceneHeight / this.height),
            Math.floor(sceneWidth / this.width)
        ));
        const ox = Math.floor((sceneWidth - this.width * scale) / 2);
        const oy = Math.floor((sceneHeight - this.height * scale) / 2);

        // Atualiza uniform buffer
        const uniformData = new Float32Array([ox, oy, scale, 0.0]);
        this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);

        // Quando started = true: preserva a cena com loadOp = 'load'
        // Quando started = false: limpa com preto opaco
        const passDesc = {
            colorAttachments: [
                {
                    view: sceneColorView,
                    loadOp: started ? 'load' : 'clear',
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    storeOp: 'store',
                },
            ],
        };

        const pass = commandEncoder.beginRenderPass(passDesc);
        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.bindGroup);
        pass.draw(3, 1, 0, 0); // Fullscreen triangle
        pass.end();
    }
}
