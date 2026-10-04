import {
    MAX_PARTICLES,
    PARTICLE_STRUCT_SIZE,
    SIMULATION_UBO_SIZE,
    DRAW_UBO_SIZE,
    DEFAULT_PARTICLE_PARAMS,
    packSimulationUniforms,
    packDrawUniforms,
    createInitialParticleData,
} from './particleConfig.js';

import {
    createShaderModuleChecked,
    createComputePipelineChecked,
    createRenderPipelineChecked,
} from '../gpu/gpuChecks.js';

export function getParticleComputePipelineDescriptor(shaderModule, layout = 'auto') {
    return {
        label: 'particles.computePipeline',
        layout,
        compute: {
            module: shaderModule,
            entryPoint: 'simulate',
        },
    };
}

export function getParticleRenderPipelineDescriptor(shaderModule, layout = 'auto', colorFormat = 'rgba8unorm', depthFormat = 'depth24plus') {
    return {
        label: 'particles.renderPipeline',
        layout,
        vertex: {
            module: shaderModule,
            entryPoint: 'vs_main',
            buffers: [
                {
                    // Instâncias de partículas
                    arrayStride: PARTICLE_STRUCT_SIZE,
                    stepMode: 'instance',
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: 'float32x3' }, // position
                        { shaderLocation: 1, offset: 12, format: 'float32' },   // life
                        { shaderLocation: 2, offset: 16, format: 'float32x3' }, // velocity
                        { shaderLocation: 3, offset: 28, format: 'float32' },   // kind
                        { shaderLocation: 4, offset: 32, format: 'float32x4' }, // params
                    ],
                },
                {
                    // Vértices do Quad local
                    arrayStride: 8,
                    stepMode: 'vertex',
                    attributes: [
                        { shaderLocation: 5, offset: 0, format: 'float32x2' }, // quad_pos
                    ],
                },
            ],
        },
        fragment: {
            module: shaderModule,
            entryPoint: 'fs_main',
            targets: [
                {
                    format: colorFormat,
                },
            ],
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

/**
 * Gerenciador da simulação e desenho das partículas de poeira e brasas.
 * Aloca buffers na GPU, cria as pipelines de compute e renderização, e grava os passes de comando.
 */
export class ParticleSystem {
    /**
     * @param {GPUDevice} device 
     * @param {GPUTexture} litPaletteTexture Textura 256x32 da paleta iluminada
     * @param {Object} paletteIndices Índices encontrados no PLAYPAL { dustIdx, warmEmberIdx, coldEmberIdx }
     * @param {Object} [particleParams] Instância de ParticleParams ou objeto com parâmetros
     */
    constructor(device, litPaletteTexture, paletteIndices, particleParams = null) {
        this.device = device;
        this.litPaletteTexture = litPaletteTexture;
        this.paletteIndices = paletteIndices;
        this.particleParams = particleParams;

        this.freeze = false;
        this.disableFade = false;

        this.supported = false;
        this.lastError = null;
        this.computePipeline = null;
        this.renderPipeline = null;
        this.particlesBuffer = null;
        this.quadVertexBuffer = null;

        this.simUniformBuffer = null;
        this.simUniformArray = new Uint8Array(SIMULATION_UBO_SIZE);
        this.computeBindGroup = null;

        this.drawUniformBuffer = null;
        this.drawUniformArray = new Uint8Array(DRAW_UBO_SIZE);
        this.drawBindGroup = null;
    }

    /**
     * Atualiza os índices de paleta (quando as cores são alteradas).
     * @param {Object} paletteIndices 
     */
    updatePaletteIndices(paletteIndices) {
        this.paletteIndices = paletteIndices;
    }

    /**
     * Reseta todas as partículas com vidas escalonadas em torno da câmera.
     * @param {Array<number>} [cameraPos=[0, 41, 0]]
     */
    resetParticles(cameraPos = [0, 41, 0]) {
        if (!this.supported || !this.particlesBuffer) return;
        const currentParams = this.particleParams ? (this.particleParams.get ? this.particleParams.get() : this.particleParams) : DEFAULT_PARTICLE_PARAMS;
        const initialParticleData = createInitialParticleData(MAX_PARTICLES, cameraPos, currentParams);
        this.device.queue.writeBuffer(this.particlesBuffer, 0, initialParticleData);
    }

    /**
     * Inicializa pipelines e buffers na GPU com tratamento de erros.
     * @param {string} [shaderCode] Código WGSL opcional (se nulo, busca via fetch)
     * @returns {Promise<boolean>} Retorna true se inicializado com sucesso
     */
    async init(shaderCode = null) {
        try {
            // 1. Carregamento do código do shader se não fornecido diretamente
            if (!shaderCode) {
                const response = await fetch('src/shaders/particles.wgsl');
                if (!response.ok) {
                    throw new Error(`Falha ao carregar src/shaders/particles.wgsl (HTTP ${response.status})`);
                }
                shaderCode = await response.text();
            }

            // 2. Validação e registro de limites da GPU
            const limits = this.device.limits;
            const requiredBufferSize = MAX_PARTICLES * PARTICLE_STRUCT_SIZE;
            if (requiredBufferSize > limits.maxStorageBufferBindingSize || requiredBufferSize > limits.maxBufferSize) {
                throw new Error(`Buffer de partículas (${requiredBufferSize} B) excede limites do dispositivo (maxStorageBufferBindingSize: ${limits.maxStorageBufferBindingSize}).`);
            }
            if (limits.maxComputeWorkgroupSizeX < 64) {
                throw new Error(`maxComputeWorkgroupSizeX (${limits.maxComputeWorkgroupSizeX}) é inferior a 64.`);
            }

            // 3. Criação do módulo de shader checado
            const shaderRes = await createShaderModuleChecked(this.device, {
                label: 'particles.shaderModule',
                code: shaderCode,
            });

            if (!shaderRes.ok) {
                this.lastError = shaderRes.error;
                console.error('[particles.shaderModule] Falha ao compilar:', shaderRes.error);
                return false;
            }

            const shaderModule = shaderRes.value;

            // 4. Criação dos Buffers de Uniform
            this.simUniformBuffer = this.device.createBuffer({
                label: 'particles.simUniformBuffer',
                size: SIMULATION_UBO_SIZE,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });

            this.drawUniformBuffer = this.device.createBuffer({
                label: 'particles.drawUniformBuffer',
                size: DRAW_UBO_SIZE,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });

            // 5. Criação do Buffer de Partículas (STORAGE | VERTEX | COPY_DST)
            this.particlesBuffer = this.device.createBuffer({
                label: 'particles.instancedBuffer',
                size: requiredBufferSize,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            });

            // Popula partículas com vidas escalonadas
            const currentParams = this.particleParams ? (this.particleParams.get ? this.particleParams.get() : this.particleParams) : DEFAULT_PARTICLE_PARAMS;
            const initialParticleData = createInitialParticleData(MAX_PARTICLES, [0, 41, 0], currentParams);
            this.device.queue.writeBuffer(this.particlesBuffer, 0, initialParticleData);

            // 6. Buffer de Vértices do Quad (6 vértices vec2f em [-1, 1])
            this.quadVertexBuffer = this.device.createBuffer({
                label: 'particles.quadVertexBuffer',
                size: 6 * 2 * 4,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            });
            const quadVertices = new Float32Array([
                -1.0, -1.0,
                +1.0, -1.0,
                -1.0, +1.0,
                -1.0, +1.0,
                +1.0, -1.0,
                +1.0, +1.0,
            ]);
            this.device.queue.writeBuffer(this.quadVertexBuffer, 0, quadVertices);

            // 7. Pipeline de Computação checada
            const computeDesc = getParticleComputePipelineDescriptor(shaderModule, 'auto');
            const computeRes = await createComputePipelineChecked(this.device, computeDesc);
            if (!computeRes.ok) {
                this.lastError = computeRes.error;
                console.error('[particles.computePipeline] Falha na pipeline de compute:', computeRes.error);
                return false;
            }
            this.computePipeline = computeRes.value;

            this.computeBindGroup = this.device.createBindGroup({
                label: 'particles.computeBindGroup',
                layout: this.computePipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: this.simUniformBuffer } },
                    { binding: 1, resource: { buffer: this.particlesBuffer } },
                ],
            });

            // 8. Pipeline de Renderização checada
            const renderDesc = getParticleRenderPipelineDescriptor(shaderModule, 'auto', 'rgba8unorm', 'depth24plus');
            const renderRes = await createRenderPipelineChecked(this.device, renderDesc);
            if (!renderRes.ok) {
                this.lastError = renderRes.error;
                console.error('[particles.renderPipeline] Falha na pipeline de render:', renderRes.error);
                return false;
            }
            this.renderPipeline = renderRes.value;

            this.drawBindGroup = this.device.createBindGroup({
                label: 'particles.drawBindGroup',
                layout: this.renderPipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: this.drawUniformBuffer } },
                    { binding: 1, resource: this.litPaletteTexture.createView() },
                ],
            });

            this.supported = true;

            const initialCount = currentParams.count ?? 1200;
            console.log(
                `[Particles GPU] Inicializado com sucesso. Struct: ${PARTICLE_STRUCT_SIZE} B, Buffer: ${requiredBufferSize} B (${MAX_PARTICLES} partículas), SimUBO: ${SIMULATION_UBO_SIZE} B, DrawUBO: ${DRAW_UBO_SIZE} B. Partículas ativas iniciais: ${initialCount}.`
            );

            return true;
        } catch (err) {
            console.error('[Particles] Falha ao inicializar o sistema de partículas:', err);
            this.supported = false;
            return false;
        }
    }

    /**
     * Grava a passada de computação (simulação).
     * @param {GPUCommandEncoder} commandEncoder 
     * @param {number} dt Delta time em segundos
     * @param {number} time Tempo absoluto
     * @param {Array<number>} cameraPos [x, y, z] da câmera
     * @param {number} activeCount Quantidade de partículas ativas
     * @param {Object} [params] Objeto de parâmetros atualizados
     */
    recordComputePass(commandEncoder, dt, time, cameraPos, activeCount, params = null) {
        if (!this.supported || activeCount <= 0) return;

        const p = params || (this.particleParams ? (this.particleParams.get ? this.particleParams.get() : this.particleParams) : DEFAULT_PARTICLE_PARAMS);
        const actualDt = this.freeze ? 0.0 : Math.min(dt, 0.1);

        // Gera semente pseudoaleatória de 128 bits
        const seed = [
            Math.floor(Math.random() * 0xffffffff),
            Math.floor(Math.random() * 0xffffffff),
            Math.floor(Math.random() * 0xffffffff),
            Math.floor(Math.random() * 0xffffffff),
        ];

        packSimulationUniforms(
            {
                cameraPos,
                seed,
                deltaTime: actualDt,
                time,
                params: p,
            },
            this.simUniformArray.buffer
        );

        this.device.queue.writeBuffer(this.simUniformBuffer, 0, this.simUniformArray.buffer);

        const computePass = commandEncoder.beginComputePass({
            label: 'Particles Compute Pass (Simulate)',
        });
        computePass.setPipeline(this.computePipeline);
        computePass.setBindGroup(0, this.computeBindGroup);
        computePass.dispatchWorkgroups(Math.ceil(activeCount / 64));
        computePass.end();
    }

    /**
     * Grava a passada de renderização das partículas sobre a cena 3D com teste de profundidade.
     * @param {GPUCommandEncoder} commandEncoder 
     * @param {GPUTextureView} colorView Visão de cor da textura interna (loadOp: load)
     * @param {GPUTextureView} depthView Visão de profundidade da cena (loadOp: load, storeOp: store)
     * @param {Object} renderData Dados de câmera e iluminação
     * @param {Object} [params] Objeto de parâmetros
     */
    recordRenderPass(commandEncoder, colorView, depthView, renderData, params = null) {
        if (!this.supported || renderData.activeCount <= 0) return;

        const p = params || (this.particleParams ? (this.particleParams.get ? this.particleParams.get() : this.particleParams) : DEFAULT_PARTICLE_PARAMS);

        packDrawUniforms(
            {
                viewProj: renderData.viewProj,
                cameraPos: renderData.cameraPos,
                internalWidth: renderData.internalWidth,
                internalHeight: renderData.internalHeight,
                time: renderData.time,
                dustIdx: this.paletteIndices.dustIdx,
                warmEmberIdx: this.paletteIndices.warmEmberIdx,
                coldEmberIdx: this.paletteIndices.coldEmberIdx,
                lightingEnabled: renderData.lightingEnabled,
                params: p,
                disableFade: this.disableFade,
            },
            this.drawUniformArray.buffer
        );

        this.device.queue.writeBuffer(this.drawUniformBuffer, 0, this.drawUniformArray.buffer);

        const renderPassDesc = {
            label: 'Particles Render Pass',
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
        };

        const renderPass = commandEncoder.beginRenderPass(renderPassDesc);
        renderPass.setPipeline(this.renderPipeline);
        renderPass.setBindGroup(0, this.drawBindGroup);
        renderPass.setVertexBuffer(0, this.particlesBuffer);
        renderPass.setVertexBuffer(1, this.quadVertexBuffer);
        renderPass.draw(6, renderData.activeCount, 0, 0);
        renderPass.end();
    }
}
