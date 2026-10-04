/**
 * Shaders WGSL para renderização do Doom E1M1:
 * - Modo Texturizado (renderMode = 0):
 *     Consulta textura via textureLoad com coordenadas UV e paleta iluminada litPalette (256x32).
 *     Calcula degradação da luz por distância (profundidade z = 1.0 / clip_position.w) e nível de setor (lightnum).
 *     Renderiza céu real em F_SKY1 (ou em todos os tetos com skyTest ativado).
 * - Modo Sólido (renderMode = 1):
 *     Exibe as cores sólidas com iluminação direcional suave (comportamento das etapas anteriores).
 */
export const shaderCode = /* wgsl */ `
struct Uniforms {
    mvp: mat4x4<f32>,            // 64 bytes (offset 0)
    cameraPos: vec4<f32>,       // 16 bytes (offset 64: xyz = camera world position, w = 1.0)
    renderMode: u32,            // 4 bytes (offset 80: 0 = texturizado, 1 = cores sólidas)
    lightingEnabled: u32,       // 4 bytes (offset 84: 0 = off, 1 = on)
    skyLayer: u32,              // 4 bytes (offset 88: índice da camada do céu em wallTextures)
    skyTest: u32,               // 4 bytes (offset 92: 0 = normal, 1 = céu em todos os tetos)
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> wallSizes: array<vec2<u32>>;
@group(0) @binding(2) var wallTextures: texture_2d_array<u32>;
@group(0) @binding(3) var flatTextures: texture_2d_array<u32>;
@group(0) @binding(4) var litPalette: texture_2d<f32>;

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) color: vec3<f32>,
    @location(3) uv: vec2<f32>,
    @location(4) layer: u32,
    @location(5) kind: u32, // 0 = parede, 1 = flat, 2 = céu
    @location(6) lightnum: u32,
};

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) normal: vec3<f32>,
    @location(1) color: vec3<f32>,
    @location(2) uv: vec2<f32>,
    @location(3) @interpolate(flat) layer: u32,
    @location(4) @interpolate(flat) kind: u32,
    @location(5) @interpolate(flat) lightnum: u32,
    @location(6) worldPos: vec3<f32>,
};

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    out.clip_position = uniforms.mvp * vec4<f32>(in.position, 1.0);
    out.normal = in.normal;
    out.color = in.color;
    out.uv = in.uv;
    out.layer = in.layer;
    out.kind = in.kind;
    out.lightnum = in.lightnum;
    out.worldPos = in.position;
    return out;
}

// Módulo com ajuste correto para coordenadas inteiras negativas
fn wrap(i: i32, n: i32) -> i32 {
    return ((i % n) + n) % n;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // 1. Modo de Cores Sólidas (com sombreamento direcional das etapas anteriores)
    if (uniforms.renderMode == 1u) {
        if (in.kind == 2u) {
            // Céu fixo no modo sólido
            return vec4<f32>(in.color, 1.0);
        }
        let lightDir = normalize(vec3<f32>(0.5, 0.7, 0.4));
        let ndotl = max(0.0, dot(normalize(in.normal), lightDir));
        let litColor = in.color * (0.4 + 0.6 * ndotl);
        return vec4<f32>(litColor, 1.0);
    }

    // 2. Modo Texturizado (com paleta COLORMAP do Doom)

    // Céu (kind == 2u OU modo de teste K em tetos com normal.y < -0.5)
    let isSkyPixel = (in.kind == 2u) || (uniforms.skyTest == 1u && in.kind == 1u && in.normal.y < -0.5);
    if (isSkyPixel) {
        let d = in.worldPos - uniforms.cameraPos.xyz;
        // yawDoom: atan2(-d.z, d.x), em radianos, anti-horário a partir do leste
        let yawDoom = atan2(-d.z, d.x);
        let PI = 3.141592653589793;
        let normYaw = fract(yawDoom / (2.0 * PI));
        let skySize = wallSizes[uniforms.skyLayer];
        let coluna = i32(floor(normYaw * 1024.0)) % i32(skySize.x);
        let horiz = max(length(vec2<f32>(d.x, d.z)), 0.000001);
        let tanPitch = d.y / horiz;
        let linha = clamp(i32(floor(100.0 - 133.33 * tanPitch)), 0i, i32(skySize.y) - 1i);

        let texel = textureLoad(wallTextures, vec2<i32>(coluna, linha), uniforms.skyLayer, 0);
        let skyColor = textureLoad(litPalette, vec2<i32>(i32(texel.r), 0), 0);
        return vec4<f32>(skyColor.rgb, 1.0);
    }

    // Paredes (kind = 0)
    if (in.kind == 0u) {
        if (in.layer == 0xFFFFFFFFu) {
            discard;
        }

        let size = wallSizes[in.layer];
        let ix = wrap(i32(floor(in.uv.x)), i32(size.x));
        let iy = wrap(i32(floor(in.uv.y)), i32(size.y));

        let texel = textureLoad(wallTextures, vec2<i32>(ix, iy), in.layer, 0);
        if (texel.g == 0u) {
            discard;
        }

        var level = 0i;
        if (uniforms.lightingEnabled == 1u) {
            let z = max(1.0 / in.clip_position.w, 1.0);
            let startmap = (15i - i32(in.lightnum)) * 4i;
            let j = min(47i, i32(floor(2560.0 / z)));
            level = clamp(startmap - j / 2i, 0i, 31i);
        }

        let palColor = textureLoad(litPalette, vec2<i32>(i32(texel.r), level), 0);
        return vec4<f32>(palColor.rgb, 1.0);
    }

    // Flats: Pisos e Tetos (kind = 1, tamanho fixo 64x64)
    if (in.kind == 1u) {
        if (in.layer == 0xFFFFFFFFu) {
            discard;
        }

        let ix = wrap(i32(floor(in.uv.x)), 64);
        let iy = wrap(i32(floor(in.uv.y)), 64);

        let texel = textureLoad(flatTextures, vec2<i32>(ix, iy), in.layer, 0);

        var level = 0i;
        if (uniforms.lightingEnabled == 1u) {
            let z = max(1.0 / in.clip_position.w, 1.0);
            let startmap = (15i - i32(in.lightnum)) * 4i;
            let j = min(127i, i32(floor(z / 16.0)));
            let scale = i32(floor(160.0 / f32(j + 1i)));
            level = clamp(startmap - scale / 2i, 0i, 31i);
        }

        let palColor = textureLoad(litPalette, vec2<i32>(i32(texel.r), level), 0);
        return vec4<f32>(palColor.rgb, 1.0);
    }

    return vec4<f32>(1.0, 0.0, 1.0, 1.0);
}
`;

export const sceneVertexBufferLayout = {
    arrayStride: 56, // 14 palavras * 4 bytes
    attributes: [
        { shaderLocation: 0, offset: 0,  format: 'float32x3' }, // position
        { shaderLocation: 1, offset: 12, format: 'float32x3' }, // normal
        { shaderLocation: 2, offset: 24, format: 'float32x3' }, // color (modo sólido)
        { shaderLocation: 3, offset: 36, format: 'float32x2' }, // uv
        { shaderLocation: 4, offset: 44, format: 'uint32' },    // layer
        { shaderLocation: 5, offset: 48, format: 'uint32' },    // kind (0 = parede, 1 = flat, 2 = céu)
        { shaderLocation: 6, offset: 52, format: 'uint32' },    // lightnum (0 a 15)
    ],
};

export function getScenePipelineDescriptor(shaderModule, pipelineLayout, cullMode = 'back', colorFormat = 'rgba8unorm', depthFormat = 'depth24plus') {
    return {
        label: `scene.pipeline${cullMode === 'back' ? 'CullBack' : 'NoCull'}`,
        layout: pipelineLayout,
        vertex: {
            module: shaderModule,
            entryPoint: 'vs_main',
            buffers: [sceneVertexBufferLayout],
        },
        fragment: {
            module: shaderModule,
            entryPoint: 'fs_main',
            targets: [{ format: colorFormat }],
        },
        primitive: {
            topology: 'triangle-list',
            cullMode: cullMode,
            frontFace: 'ccw',
        },
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: depthFormat,
        },
    };
}
