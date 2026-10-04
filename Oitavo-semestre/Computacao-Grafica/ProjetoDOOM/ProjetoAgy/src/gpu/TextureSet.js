/**
 * Módulo de envio e organização de texturas na GPU via WebGPU.
 * Cria texture arrays para paredes e flats, textura 2D para a paleta iluminada (256x32),
 * e o storage buffer de tamanhos de cada camada.
 */

// Índice do tom de magenta no PLAYPAL (índice 251 = RGB 255, 0, 255)
const MAGENTA_PALETTE_INDEX = 251;
const BLACK_PALETTE_INDEX = 0;

/**
 * Gera os dados de um padrão xadrez 64x64 (magenta e preto) para a camada 0 (fallback).
 * Formato rg8uint: 2 bytes por pixel (R = índice da paleta, G = opacidade 1).
 * @param {number} layerWidth 
 * @param {number} layerHeight 
 * @returns {Uint8Array}
 */
function createCheckerboardData(layerWidth, layerHeight) {
    const data = new Uint8Array(layerWidth * layerHeight * 2);
    const checkSize = 8;

    for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 64; x++) {
            const isMagenta = (Math.floor(x / checkSize) + Math.floor(y / checkSize)) % 2 === 0;
            const colorIdx = isMagenta ? MAGENTA_PALETTE_INDEX : BLACK_PALETTE_INDEX;
            const dst = (y * layerWidth + x) * 2;
            data[dst] = colorIdx;
            data[dst + 1] = 1; // Opacidade = 1
        }
    }
    return data;
}

/**
 * Cria e preenche todos os recursos de textura e storage na GPU para o mapa.
 * 
 * @param {GPUDevice} device Dispositivo WebGPU
 * @param {Object} textureData Resultado de loadTexturesAndFlats
 * @param {GPUBuffer} uniformBuffer Buffer de uniform da cena
 * @param {Uint8Array} litPaletteData Dados RGBA da paleta iluminada (256x32x4 bytes)
 * @param {string} [skyName='SKY1'] Nome da textura de céu
 * @returns {Object}
 */
export function createGpuTextureSet(device, textureData, uniformBuffer, litPaletteData, skyName = 'SKY1') {
    const { flats, wallTextures, stats } = textureData;

    // 1. Validação de limites da GPU
    const limits = device.limits;
    const wallLayerCount = 1 + wallTextures.size;
    const flatLayerCount = 1 + flats.size;
    const maxDimension = Math.max(stats.maxWallWidth, stats.maxWallHeight, 64);

    if (wallLayerCount > limits.maxTextureArrayLayers || flatLayerCount > limits.maxTextureArrayLayers) {
        throw new Error(
            `Número de camadas de textura (${Math.max(wallLayerCount, flatLayerCount)}) excede o limite do dispositivo (${limits.maxTextureArrayLayers}).`
        );
    }

    if (maxDimension > limits.maxTextureDimension2D) {
        throw new Error(
            `Dimensão de textura (${maxDimension}) excede o limite do dispositivo (${limits.maxTextureDimension2D}).`
        );
    }

    // 2. Textura da Paleta Iluminada (256x32, rgba8unorm)
    const litPaletteTexture = device.createTexture({
        label: 'textures.litPaletteTexture',
        size: [256, 32, 1],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    device.queue.writeTexture(
        { texture: litPaletteTexture },
        litPaletteData,
        { bytesPerRow: 256 * 4 },
        [256, 32, 1]
    );

    // 3. Texture Array de Paredes (rg8uint, maxWidth x maxHeight x layerCount)
    const wallWidth = Math.max(64, stats.maxWallWidth);
    const wallHeight = Math.max(64, stats.maxWallHeight);

    const wallTexture = device.createTexture({
        label: 'textures.wallTextureArray',
        size: [wallWidth, wallHeight, wallLayerCount],
        format: 'rg8uint',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    const wallTextureMap = new Map();
    const wallSizesData = new Uint32Array(wallLayerCount * 2);

    // Camada 0: Fallback (xadrez magenta e preto 64x64)
    const wallFallbackData = createCheckerboardData(wallWidth, wallHeight);
    wallSizesData[0] = 64;
    wallSizesData[1] = 64;

    device.queue.writeTexture(
        { texture: wallTexture, origin: [0, 0, 0] },
        wallFallbackData,
        { bytesPerRow: wallWidth * 2 },
        [wallWidth, wallHeight, 1]
    );

    // Preenche camadas subsequentes com as texturas de parede (incluindo o céu)
    let currentWallLayer = 1;
    for (const [name, tex] of wallTextures.entries()) {
        const layer = currentWallLayer++;
        wallTextureMap.set(name, {
            layer,
            width: tex.width,
            height: tex.height,
        });

        wallSizesData[layer * 2 + 0] = tex.width;
        wallSizesData[layer * 2 + 1] = tex.height;

        const layerBytes = new Uint8Array(wallWidth * wallHeight * 2);
        for (let y = 0; y < tex.height; y++) {
            for (let x = 0; x < tex.width; x++) {
                const srcIdx = y * tex.width + x;
                const dstIdx = (y * wallWidth + x) * 2;
                layerBytes[dstIdx] = tex.indices[srcIdx];
                layerBytes[dstIdx + 1] = tex.opacity[srcIdx];
            }
        }

        device.queue.writeTexture(
            { texture: wallTexture, origin: [0, 0, layer] },
            layerBytes,
            { bytesPerRow: wallWidth * 2 },
            [wallWidth, wallHeight, 1]
        );
    }

    // Camada do céu no array de paredes
    const skyTexInfo = wallTextureMap.get(skyName.toUpperCase());
    const skyLayer = skyTexInfo ? skyTexInfo.layer : 0;

    // 4. Storage Buffer de tamanhos das paredes (array<vec2<u32>>)
    const sizesBuffer = device.createBuffer({
        label: 'textures.wallSizesBuffer',
        size: wallSizesData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(sizesBuffer, 0, wallSizesData);

    // 5. Texture Array de Flats (rg8uint, 64x64 x flatLayerCount)
    const flatTexture = device.createTexture({
        label: 'textures.flatTextureArray',
        size: [64, 64, flatLayerCount],
        format: 'rg8uint',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    const flatTextureMap = new Map();

    // Camada 0: Fallback para flats
    const flatFallbackData = createCheckerboardData(64, 64);
    device.queue.writeTexture(
        { texture: flatTexture, origin: [0, 0, 0] },
        flatFallbackData,
        { bytesPerRow: 64 * 2 },
        [64, 64, 1]
    );

    // Preenche camadas dos flats
    let currentFlatLayer = 1;
    for (const [name, flatBytes] of flats.entries()) {
        const layer = currentFlatLayer++;
        flatTextureMap.set(name, {
            layer,
            width: 64,
            height: 64,
        });

        const layerBytes = new Uint8Array(64 * 64 * 2);
        for (let i = 0; i < 4096; i++) {
            layerBytes[i * 2 + 0] = flatBytes[i];
            layerBytes[i * 2 + 1] = 1; // Opacidade = 1
        }

        device.queue.writeTexture(
            { texture: flatTexture, origin: [0, 0, layer] },
            layerBytes,
            { bytesPerRow: 64 * 2 },
            [64, 64, 1]
        );
    }

    // 6. Bind Group Layout e Bind Group
    const bindGroupLayout = device.createBindGroupLayout({
        label: 'textures.bindGroupLayout',
        entries: [
            {
                binding: 0, // Uniforms (MVP + cameraPos + flags)
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: { type: 'uniform' },
            },
            {
                binding: 1, // Wall Sizes Storage Buffer
                visibility: GPUShaderStage.FRAGMENT,
                buffer: { type: 'read-only-storage' },
            },
            {
                binding: 2, // Wall Textures Array
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: 'uint',
                    viewDimension: '2d-array',
                },
            },
            {
                binding: 3, // Flat Textures Array
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: 'uint',
                    viewDimension: '2d-array',
                },
            },
            {
                binding: 4, // Lit Palette Texture (256x32)
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: 'float',
                    viewDimension: '2d',
                },
            },
        ],
    });

    const bindGroup = device.createBindGroup({
        label: 'textures.bindGroup',
        layout: bindGroupLayout,
        entries: [
            { binding: 0, resource: { buffer: uniformBuffer } },
            { binding: 1, resource: { buffer: sizesBuffer } },
            { binding: 2, resource: wallTexture.createView({ label: 'textures.wallTextureView' }) },
            { binding: 3, resource: flatTexture.createView({ label: 'textures.flatTextureView' }) },
            { binding: 4, resource: litPaletteTexture.createView({ label: 'textures.litPaletteView' }) },
        ],
    });

    return {
        wallTextureMap,
        flatTextureMap,
        wallTexture,
        flatTexture,
        litPaletteTexture,
        skyLayer,
        sizesBuffer,
        bindGroupLayout,
        bindGroup,
        wallLayerCount,
        flatLayerCount,
        wallWidth,
        wallHeight,
    };
}
