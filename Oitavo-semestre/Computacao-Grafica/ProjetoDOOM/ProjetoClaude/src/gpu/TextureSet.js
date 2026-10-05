// Envia paleta, texturas de parede e flats para a GPU e monta o bind group de texturas.
//
// Formato rg8uint: R = índice da paleta, G = opacidade (0 ou 1). O shader lê com textureLoad
// (coordenadas inteiras, sem sampler e sem filtro), então nada é suavizado.

const FALLBACK_SIZE = 64;
const FLAT_SIZE = 64;

// Xadrez magenta e preto de 8 em 8 pixels, no mesmo formato das texturas decodificadas.
function checker(magentaIndex) {
  const n = FALLBACK_SIZE;
  const indices = new Uint8Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) indices[y * n + x] = ((x >> 3) + (y >> 3)) & 1 ? magentaIndex : 0;
  }
  return { width: n, height: n, indices, opacity: new Uint8Array(n * n).fill(1) };
}

// Entrada da paleta mais próxima de (255, 0, 255). O Doom tem magentas puros (ex.: 250).
function nearestPaletteIndex(palette, r, g, b) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < 256; i++) {
    const d = (palette[i * 3] - r) ** 2 + (palette[i * 3 + 1] - g) ** 2 + (palette[i * 3 + 2] - b) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

// Junta índice e opacidade em um buffer rg8 do tamanho da camada (textura no canto superior esquerdo).
function packLayer(layerW, layerH, tex) {
  const data = new Uint8Array(layerW * layerH * 2);
  for (let y = 0; y < tex.height; y++) {
    for (let x = 0; x < tex.width; x++) {
      const s = y * tex.width + x, d = (y * layerW + x) * 2;
      data[d] = tex.indices[s];
      data[d + 1] = tex.opacity[s];
    }
  }
  return data;
}

function checkLimits(device, label, width, height, layers) {
  const { maxTextureArrayLayers, maxTextureDimension2D } = device.limits;
  if (layers > maxTextureArrayLayers) {
    throw new Error(`${label}: ${layers} camadas excedem maxTextureArrayLayers (${maxTextureArrayLayers})`);
  }
  if (width > maxTextureDimension2D || height > maxTextureDimension2D) {
    throw new Error(`${label}: ${width}x${height} excede maxTextureDimension2D (${maxTextureDimension2D})`);
  }
}

function createArray(device, label, width, height, layerData) {
  checkLimits(device, label, width, height, layerData.length);
  const texture = device.createTexture({
    label,
    size: [width, height, layerData.length],
    format: 'rg8uint',
    dimension: '2d',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  // Uma camada por vez; bytesPerRow = largura da camada * 2 bytes (rg8).
  layerData.forEach((data, layer) => {
    device.queue.writeTexture(
      { texture, origin: [0, 0, layer] },
      data,
      { bytesPerRow: width * 2, rowsPerImage: height },
      [width, height, 1],
    );
  });
  return texture;
}

// Layout do grupo 1 (texturas), compartilhado com o pipeline.
export function createTextureBindGroupLayout(device) {
  return device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'uint', viewDimension: '2d-array' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'uint', viewDimension: '2d-array' } },
      // Paleta iluminada 256x32 (coluna = índice, linha = nível de luz).
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
    ],
  });
}

// Mapas nome -> camada, sem GPU (etapa 23: a geometria de um nível é montada antes do upload).
// Mesma regra de createTextureSet: camada 0 = xadrez de reserva, depois uma por textura, na ordem do Map.
export function textureLayerMaps(textures) {
  const wallLayers = new Map();
  let n = 1;
  for (const [name, t] of textures.wallTextures) wallLayers.set(name, { layer: n++, width: t.width, height: t.height });
  const flatLayers = new Map();
  n = 1;
  for (const name of textures.flats.keys()) flatLayers.set(name, { layer: n++, width: FLAT_SIZE, height: FLAT_SIZE });
  return { wallLayers, flatLayers };
}

// Paleta iluminada 256x32 rgba8unorm (etapa 23: global, criada uma vez e compartilhada pelos níveis,
// pelos sprites e pelas partículas). Devolve { texture, view }.
export function createLitPaletteTexture(device, litPalette) {
  const levels = litPalette.length / (256 * 4);
  const texture = device.createTexture({
    label: 'paleta iluminada',
    size: [256, levels],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  device.queue.writeTexture({ texture }, litPalette, { bytesPerRow: 256 * 4 }, [256, levels]);
  return { texture, view: texture.createView({ label: 'paleta iluminada: view' }) };
}

// textures: resultado de loadTextures (palette, flats, wallTextures).
// litPalette: imagem 256x32 RGBA de buildLitPalette. skyName: textura de parede do céu.
// options.paletteView (etapa 23): paleta global já criada; sem ela, a paleta é criada aqui (etapa 5).
// O resultado tem destroy(), que libera os texture arrays, o buffer de tamanhos e a paleta própria.
export function createTextureSet(device, layout, textures, litPalette, skyName, options = {}) {
  const { palette, flats, wallTextures } = textures;
  const fallback = checker(nearestPaletteIndex(palette, 255, 0, 255));

  // --- Paredes: camada 0 = fallback, depois uma camada por textura ---
  const wallLayers = new Map();
  let layerW = FALLBACK_SIZE, layerH = FALLBACK_SIZE;
  for (const t of wallTextures.values()) {
    layerW = Math.max(layerW, t.width);
    layerH = Math.max(layerH, t.height);
  }
  const wallData = [packLayer(layerW, layerH, fallback)];
  const sizes = [FALLBACK_SIZE, FALLBACK_SIZE];
  for (const [name, t] of wallTextures) {
    wallLayers.set(name, { layer: wallData.length, width: t.width, height: t.height });
    wallData.push(packLayer(layerW, layerH, t));
    sizes.push(t.width, t.height);
  }
  const wallArray = createArray(device, 'texturas de parede', layerW, layerH, wallData);

  // Tamanho real de cada camada (o shader faz o módulo com ele, não com o tamanho da camada).
  const sizeData = new Uint32Array(sizes);
  const sizeBuffer = device.createBuffer({
    label: 'tamanhos das texturas',
    size: sizeData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(sizeBuffer, 0, sizeData);

  // --- Flats: 64x64, camada 0 = fallback ---
  const flatLayers = new Map();
  const flatData = [packLayer(FLAT_SIZE, FLAT_SIZE, fallback)];
  for (const [name, pixels] of flats) {
    flatLayers.set(name, { layer: flatData.length, width: FLAT_SIZE, height: FLAT_SIZE });
    const data = new Uint8Array(FLAT_SIZE * FLAT_SIZE * 2);
    for (let i = 0; i < pixels.length; i++) { data[i * 2] = pixels[i]; data[i * 2 + 1] = 1; }
    flatData.push(data);
  }
  const flatArray = createArray(device, 'flats', FLAT_SIZE, FLAT_SIZE, flatData);

  // --- Paleta iluminada: 256x32 rgba8unorm, valores sRGB enviados sem conversão ---
  // Substitui a paleta 256x1 da etapa 5: a linha 0 é a paleta original.
  const own = options.paletteView ? null : createLitPaletteTexture(device, litPalette);
  const litPaletteView = options.paletteView ?? own.view;
  const bindGroup = device.createBindGroup({
    label: 'texturas do nível: bind group',
    layout,
    entries: [
      { binding: 0, resource: wallArray.createView({ dimension: '2d-array' }) },
      { binding: 1, resource: flatArray.createView({ dimension: '2d-array' }) },
      { binding: 2, resource: litPaletteView },
      { binding: 3, resource: { buffer: sizeBuffer } },
    ],
  });

  // Céu: carregado no mesmo array das paredes; sem ele, usa o fallback (camada 0).
  const sky = wallLayers.get(skyName) ?? { layer: 0, width: FALLBACK_SIZE, height: FALLBACK_SIZE };

  return {
    bindGroup,
    wallLayers,
    flatLayers,
    sky: { name: skyName, ...sky },
    litPaletteView, // também usada pelas partículas (etapa 10)
    // Etapa 23: GPU do nível (a paleta global não é destruída aqui).
    destroy() {
      wallArray.destroy();
      flatArray.destroy();
      sizeBuffer.destroy();
      own?.texture.destroy();
    },
    counts: { textures: 2 + (own ? 1 : 0), buffers: 1, bindGroups: 1 },
    info: {
      walls: { width: layerW, height: layerH, layers: wallData.length },
      flats: { width: FLAT_SIZE, height: FLAT_SIZE, layers: flatData.length },
    },
  };
}
