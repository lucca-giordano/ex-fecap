/**
 * Módulo WebGPU para renderização de sprites 3D estilo Doom.
 * Gerencia a Texture Array rg8uint, buffers de metadados e instâncias, pipeline e render pass.
 */

const SPRITE_SHADER_WGSL = /* wgsl */ `
struct SpriteUniforms {
    viewProj: mat4x4<f32>,       // 64 bytes (offset 0)
    cameraRight: vec4<f32>,     // 16 bytes (offset 64: xyz = right vector, w = 0.0)
    cameraPos: vec4<f32>,       // 16 bytes (offset 80: xyz = cam position, w = 1.0)
    lightingEnabled: u32,       // 4 bytes (offset 96)
    pad0: u32,                  // 4 bytes (offset 100)
    pad1: u32,                  // 4 bytes (offset 104)
    pad2: u32,                  // 4 bytes (offset 108)
};

struct SpriteInstance {
    position: vec3<f32>,        // 12 bytes (offset 0)
    layer: u32,                 // 4 bytes (offset 12)
    lightnum: u32,              // 4 bytes (offset 16)
    flags: u32,                 // 4 bytes (offset 20: bit 0 = mirrored, bit 1 = fullbright, bit 2 = fuzz)
    pad0: u32,                  // 4 bytes (offset 24)
    pad1: u32,                  // 4 bytes (offset 28)
};

struct SpriteMetadata {
    width: u32,                 // 4 bytes
    height: u32,                // 4 bytes
    leftOffset: i32,            // 4 bytes
    topOffset: i32,             // 4 bytes
};

@group(0) @binding(0) var<uniform> uniforms: SpriteUniforms;
@group(0) @binding(1) var<storage, read> instances: array<SpriteInstance>;
@group(0) @binding(2) var<storage, read> spriteMeta: array<SpriteMetadata>;
@group(0) @binding(3) var spriteTextures: texture_2d_array<u32>;
@group(0) @binding(4) var litPalette: texture_2d<f32>;

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) @interpolate(flat) layer: u32,
    @location(2) @interpolate(flat) lightnum: u32,
    @location(3) @interpolate(flat) flags: u32,
    @location(4) @interpolate(flat) spriteWidth: u32,
    @location(5) @interpolate(flat) spriteHeight: u32,
};

@vertex
fn vs_main(
    @builtin(vertex_index) vertex_index: u32,
    @builtin(instance_index) instance_index: u32
) -> VertexOutput {
    var out: VertexOutput;
    let inst = instances[instance_index];
    let spriteInfo = spriteMeta[inst.layer];

    // Procedural quad de 6 vértices (2 triângulos)
    // corner.x: 0 = borda esquerda, 1 = borda direita
    // corner.y: 0 = topo, 1 = base (chão)
    var corners = array<vec2<f32>, 6>(
        vec2<f32>(0.0, 1.0), // inf-esq
        vec2<f32>(1.0, 1.0), // inf-dir
        vec2<f32>(0.0, 0.0), // sup-esq

        vec2<f32>(0.0, 0.0), // sup-esq
        vec2<f32>(1.0, 1.0), // inf-dir
        vec2<f32>(1.0, 0.0)  // sup-dir
    );

    let corner = corners[vertex_index];
    let W = f32(spriteInfo.width);
    let H = f32(spriteInfo.height);
    let L = f32(spriteInfo.leftOffset);
    let T = f32(spriteInfo.topOffset);

    // Deslocamento horizontal ao longo do vetor horizontal direito da câmera:
    // Estende-se de -L até W - L
    let horizOffset = -L + corner.x * W;

    // Deslocamento vertical acima da base:
    // Estende-se de T - H até T
    let vertOffset = T - corner.y * H;

    // Posição no mundo: sempre em pé e perpendicular ao chão
    let worldPos = inst.position + uniforms.cameraRight.xyz * horizOffset + vec3<f32>(0.0, vertOffset, 0.0);

    out.clip_position = uniforms.viewProj * vec4<f32>(worldPos, 1.0);
    out.uv = vec2<f32>(corner.x * W, corner.y * H);
    out.layer = inst.layer;
    out.lightnum = inst.lightnum;
    out.flags = inst.flags;
    out.spriteWidth = spriteInfo.width;
    out.spriteHeight = spriteInfo.height;

    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Efeito Fuzz (tipo 58 - Spectre): descarte em xadrez na tela
    if ((in.flags & 4u) != 0u) {
        let screenCoord = vec2<i32>(floor(in.clip_position.xy));
        if ((screenCoord.x + screenCoord.y) % 2 != 0) {
            discard;
        }
    }

    var u = i32(floor(in.uv.x));
    let v = i32(floor(in.uv.y));

    // Se espelhado horizontalmente (bit 0), inverte a coluna
    if ((in.flags & 1u) != 0u) {
        u = i32(in.spriteWidth) - 1i - u;
    }

    // Limites de proteção
    if (u < 0i || u >= i32(in.spriteWidth) || v < 0i || v >= i32(in.spriteHeight)) {
        discard;
    }

    let texel = textureLoad(spriteTextures, vec2<i32>(u, v), i32(in.layer), 0i);
    if (texel.g == 0u) {
        discard; // Pixel transparente
    }

    // Cálculo da iluminação por setor com COLORMAP (mesma fórmula das paredes)
    var level = 0i;
    let isFullbright = (in.flags & 2u) != 0u;

    if (uniforms.lightingEnabled == 1u && !isFullbright) {
        let z = max(1.0 / in.clip_position.w, 1.0);
        let startmap = (15i - i32(in.lightnum)) * 4i;
        let j = min(47i, i32(floor(2560.0 / z)));
        level = clamp(startmap - j / 2i, 0i, 31i);
    }

    let palColor = textureLoad(litPalette, vec2<i32>(i32(texel.r), level), 0i);
    return vec4<f32>(palColor.rgb, 1.0);
}
`;

import {
    createShaderModuleChecked,
    createRenderPipelineChecked,
} from './gpuChecks.js';

export { SPRITE_SHADER_WGSL };

export function getSpritePipelineDescriptor(
    shaderModule,
    colorFormat = 'rgba8unorm',
    depthFormat = 'depth24plus',
    entryPointVs = 'vs_main',
    entryPointFs = 'fs_main'
) {
    return {
        label: 'sprites.pipeline',
        layout: 'auto',
        vertex: {
            module: shaderModule,
            entryPoint: entryPointVs,
        },
        fragment: {
            module: shaderModule,
            entryPoint: entryPointFs,
            targets: [{ format: colorFormat }],
        },
        primitive: {
            topology: 'triangle-list',
            cullMode: 'none',
        },
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: depthFormat,
        },
    };
}
export class SpriteSet {
    /**
     * @param {GPUDevice} device 
     * @param {Object} spriteRegistry Registro construído por buildSpriteRegistry
     * @param {GPUTexture} litPaletteTexture Textura litPalette (256x32)
     * @param {string} [colorFormat='rgba8unorm'] 
     * @param {string} [depthFormat='depth24plus'] 
     */
    constructor(device, spriteRegistry, litPaletteTexture, colorFormat = 'rgba8unorm', depthFormat = 'depth24plus') {
        this.device = device;
        this.registry = spriteRegistry;
        this.litPaletteTexture = litPaletteTexture;
        this.colorFormat = colorFormat;
        this.depthFormat = depthFormat;

        this.pipeline = null;
        this.bindGroup = null;
        this.uniformBuffer = null;
        this.instanceBuffer = null;
        this.metaBuffer = null;
        this.textureArray = null;

        this.maxInstances = 512;
        this.instanceCount = 0;
        this.supported = false;
        this.lastError = null;

        this._allocateBuffers();
    }

    /**
     * Aloca texturas e buffers na GPU com labels descritivos.
     * @private
     */
    _allocateBuffers() {
        const { device, registry } = this;
        const layersCount = Math.max(1, registry.layersCount);
        const width = Math.max(1, registry.maxWidth);
        const height = Math.max(1, registry.maxHeight);

        // 1. Texture Array (rg8uint)
        this.textureArray = device.createTexture({
            label: 'sprites.textureArray',
            size: [width, height, layersCount],
            format: 'rg8uint',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });

        // Envia dados de cada camada para a GPU
        for (let layer = 0; layer < registry.layersCount; layer++) {
            const lumpIdx = registry.lumpIndicesArray[layer];
            const dec = registry.decodedLumps.get(lumpIdx);
            if (!dec) continue;

            const layerBytes = new Uint8Array(width * height * 2);
            for (let y = 0; y < dec.height; y++) {
                for (let x = 0; x < dec.width; x++) {
                    const srcIdx = y * dec.width + x;
                    const dstIdx = (y * width + x) * 2;
                    layerBytes[dstIdx] = dec.indices[srcIdx];
                    layerBytes[dstIdx + 1] = dec.opacity[srcIdx];
                }
            }

            device.queue.writeTexture(
                { texture: this.textureArray, origin: [0, 0, layer] },
                layerBytes,
                { bytesPerRow: width * 2 },
                [width, height, 1]
            );
        }

        // 2. Buffer de Metadados (Storage somente leitura)
        const metaArray = new Int32Array(layersCount * 4);
        for (let layer = 0; layer < registry.layersCount; layer++) {
            const m = registry.metadata[layer];
            metaArray[layer * 4 + 0] = m.width;
            metaArray[layer * 4 + 1] = m.height;
            metaArray[layer * 4 + 2] = m.leftOffset;
            metaArray[layer * 4 + 3] = m.topOffset;
        }

        this.metaBuffer = device.createBuffer({
            label: 'sprites.metaBuffer',
            size: Math.max(16, metaArray.byteLength),
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(this.metaBuffer, 0, metaArray);

        // 3. Buffer de Uniforms (112 bytes)
        this.uniformBuffer = device.createBuffer({
            label: 'sprites.uniformBuffer',
            size: 112,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // 4. Buffer de Instâncias (Storage somente leitura, 32 bytes por instância)
        this.instanceBuffer = device.createBuffer({
            label: 'sprites.instanceBuffer',
            size: this.maxInstances * 32,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
    }

    /**
     * Compila shader module e cria render pipeline de forma checada.
     * @param {Object} [options]
     * @param {boolean} [options.breakPipeline=false] Se verdadeiro, usa entry point inválido para teste de fallback
     * @returns {Promise<boolean>}
     */
    async init({ breakPipeline = false } = {}) {
        const { device } = this;
        const shaderRes = await createShaderModuleChecked(device, {
            label: 'sprites.shaderModule',
            code: SPRITE_SHADER_WGSL,
        });

        if (!shaderRes.ok) {
            this.supported = false;
            this.lastError = shaderRes.error;
            console.error('[sprites.shaderModule] Falha ao compilar shader:', shaderRes.error);
            return false;
        }

        const shaderModule = shaderRes.value;
        const vsEntry = breakPipeline ? 'non_existent_vs' : 'vs_main';
        const fsEntry = breakPipeline ? 'non_existent_fs' : 'fs_main';

        const pipelineDesc = getSpritePipelineDescriptor(
            shaderModule,
            this.colorFormat,
            this.depthFormat,
            vsEntry,
            fsEntry
        );

        const pipelineRes = await createRenderPipelineChecked(device, pipelineDesc);
        if (!pipelineRes.ok) {
            this.supported = false;
            this.lastError = pipelineRes.error;
            console.error('[sprites.pipeline] Falha ao criar pipeline:', pipelineRes.error);
            return false;
        }

        this.pipeline = pipelineRes.value;

        this.bindGroup = device.createBindGroup({
            label: 'sprites.bindGroup',
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer } },
                { binding: 1, resource: { buffer: this.instanceBuffer } },
                { binding: 2, resource: { buffer: this.metaBuffer } },
                { binding: 3, resource: this.textureArray.createView({ label: 'sprites.textureArrayView', dimension: '2d-array' }) },
                { binding: 4, resource: this.litPaletteTexture.createView({ label: 'sprites.litPaletteView' }) },
            ],
        });

        this.supported = true;
        return true;
    }

    /**
     * Atualiza o buffer de instâncias na GPU.
     * Redimensiona o buffer se a quantidade de instâncias ultrapassar a capacidade atual.
     * @param {ArrayBuffer} instanceArrayBuffer Buffer de 32 bytes por instância
     * @param {number} count Quantidade de instâncias
     */
    updateInstances(instanceArrayBuffer, count) {
        this.instanceCount = count;
        if (count === 0 || !this.supported || !this.pipeline) return;

        const neededSize = count * 32;
        if (neededSize > this.instanceBuffer.size) {
            this.instanceBuffer.destroy();
            this.maxInstances = Math.max(count * 2, this.maxInstances * 2);
            this.instanceBuffer = this.device.createBuffer({
                label: 'sprites.instanceBuffer',
                size: this.maxInstances * 32,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            });

            // Recria bind group com o novo buffer de instâncias
            this.bindGroup = this.device.createBindGroup({
                label: 'sprites.bindGroup',
                layout: this.pipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: this.uniformBuffer } },
                    { binding: 1, resource: { buffer: this.instanceBuffer } },
                    { binding: 2, resource: { buffer: this.metaBuffer } },
                    { binding: 3, resource: this.textureArray.createView({ label: 'sprites.textureArrayView', dimension: '2d-array' }) },
                    { binding: 4, resource: this.litPaletteTexture.createView({ label: 'sprites.litPaletteView' }) },
                ],
            });
        }

        this.device.queue.writeBuffer(this.instanceBuffer, 0, instanceArrayBuffer, 0, neededSize);
    }

    /**
     * Atualiza os uniforms da passada de sprites.
     * @param {Float32Array|Array<number>} viewProj Matriz MVP 4x4
     * @param {Array<number>} cameraRight Vetor [x, y, z] horizontal direito da câmera normalizado
     * @param {Array<number>} cameraPos Vetor [x, y, z] posição da câmera no mundo
     * @param {boolean} lightingEnabled Se iluminação com COLORMAP está ativa
     */
    updateUniforms(viewProj, cameraRight, cameraPos, lightingEnabled) {
        if (!this.supported) return;

        const buffer = new ArrayBuffer(112);
        const f32 = new Float32Array(buffer);
        const u32 = new Uint32Array(buffer);

        // viewProj (mat4x4, 16 floats, offset 0..15)
        for (let i = 0; i < 16; i++) {
            f32[i] = viewProj[i];
        }

        // cameraRight (vec4, offset 16..19)
        f32[16] = cameraRight[0];
        f32[17] = cameraRight[1];
        f32[18] = cameraRight[2];
        f32[19] = 0.0;

        // cameraPos (vec4, offset 20..23)
        f32[20] = cameraPos[0];
        f32[21] = cameraPos[1];
        f32[22] = cameraPos[2];
        f32[23] = 1.0;

        // lightingEnabled (u32, offset 24)
        u32[24] = lightingEnabled ? 1 : 0;
        u32[25] = 0;
        u32[26] = 0;
        u32[27] = 0;

        this.device.queue.writeBuffer(this.uniformBuffer, 0, buffer);
    }

    /**
     * Grava a passada de desenho dos sprites.
     * Executada com colorAttachment e depthAttachment em loadOp "load" e storeOp "store".
     * @param {GPUCommandEncoder} commandEncoder 
     * @param {GPUTextureView} colorView Textura colorida da cena
     * @param {GPUTextureView} depthView Textura de profundidade da cena
     */
    recordRenderPass(commandEncoder, colorView, depthView) {
        if (this.instanceCount === 0 || !this.supported || !this.pipeline) return;

        const pass = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: colorView,
                    loadOp: 'load',
                    storeOp: 'store',
                },
            ],
            depthStencilAttachment: {
                view: depthView,
                depthLoadOp: 'load',
                depthStoreOp: 'store',
            },
        });

        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.bindGroup);
        pass.draw(6, this.instanceCount, 0, 0);
        pass.end();
    }
}
