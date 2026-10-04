/**
 * Shaders WGSL para a passada de Blit com integração do efeito CRT.
 * - Fullscreen triangle gerado diretamente no vertex shader sem vertex buffer.
 * - Uniform buffer de 32 bytes (internalSize, rectSize, time, crt, padding).
 * - Quando crt == 0.0: amostragem nearest pura pixel-a-pixel (idêntica à Etapa 6).
 * - Quando crt == 1.0: pós-processamento CRT de Timothy Lottes (scanlines, curvatura e máscara).
 */
export const blitShaderCode = /* wgsl */ `
struct BlitUniforms {
    internalSize: vec2<f32>, // offset 0 (8B)
    rectSize: vec2<f32>,     // offset 8 (8B)
    time: f32,               // offset 16 (4B)
    crt: f32,                // offset 20 (4B: 0.0 = desligado, 1.0 = ligado)
    padding: vec2<f32>,      // offset 24 (8B)
};

@group(0) @binding(0) var<uniform> blitUniforms: BlitUniforms;
@group(0) @binding(1) var sceneTexture: texture_2d<f32>;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@vertex
fn vs_blit(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var pos = array<vec2<f32>, 3>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 3.0, -1.0),
        vec2<f32>(-1.0,  3.0)
    );
    var uvs = array<vec2<f32>, 3>(
        vec2<f32>(0.0, 1.0),
        vec2<f32>(2.0, 1.0),
        vec2<f32>(0.0, -1.0)
    );
    var out: VertexOutput;
    out.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
    out.uv = uvs[vertexIndex];
    return out;
}

// =========================================================================
// Efeito CRT: Portado do shader "PUBLIC DOMAIN CRT STYLED SCAN-LINE SHADER"
// por Timothy Lottes (https://www.shadertoy.com/view/XsjSzR).
// =========================================================================

const hardScan: f32 = -8.0;
const hardPix: f32 = -3.0;
const warp: vec2<f32> = vec2<f32>(1.0 / 32.0, 1.0 / 24.0);
const maskDark: f32 = 0.5;
const maskLight: f32 = 1.5;

const WARP_ENABLED: bool = true;
const MASK_ENABLED: bool = true;

fn ToLinear1(c: f32) -> f32 {
    if (c <= 0.04045) {
        return c / 12.92;
    }
    return pow(max(c + 0.055, 0.0) / 1.055, 2.4);
}

fn ToLinear(c: vec3<f32>) -> vec3<f32> {
    return vec3<f32>(ToLinear1(c.r), ToLinear1(c.g), ToLinear1(c.b));
}

fn ToSrgb1(c: f32) -> f32 {
    if (c < 0.0031308) {
        return c * 12.92;
    }
    return 1.055 * pow(max(c, 0.0), 0.41666) - 0.055;
}

fn ToSrgb(c: vec3<f32>) -> vec3<f32> {
    return vec3<f32>(ToSrgb1(c.r), ToSrgb1(c.g), ToSrgb1(c.b));
}

fn Fetch(pos: vec2<f32>, off: vec2<f32>) -> vec3<f32> {
    let res = blitUniforms.internalSize;
    let idx = vec2<i32>(floor(pos * res + off));
    let W = i32(res.x);
    let H = i32(res.y);

    if (idx.x < 0 || idx.x >= W || idx.y < 0 || idx.y >= H) {
        return vec3<f32>(0.0, 0.0, 0.0);
    }

    let row = H - 1 - idx.y;
    let col = idx.x;

    let texel = textureLoad(sceneTexture, vec2<i32>(col, row), 0);
    return ToLinear(texel.rgb);
}

fn Dist(posInput: vec2<f32>) -> vec2<f32> {
    let pos = posInput * blitUniforms.internalSize;
    return -((pos - floor(pos)) - vec2<f32>(0.5, 0.5));
}

fn Gaus(pos: f32, scale: f32) -> f32 {
    return exp2(scale * pos * pos);
}

fn Horz3(pos: vec2<f32>, off: f32) -> vec3<f32> {
    let b = Fetch(pos, vec2<f32>(-1.0, off));
    let c = Fetch(pos, vec2<f32>( 0.0, off));
    let d = Fetch(pos, vec2<f32>( 1.0, off));
    let dst = Dist(pos).x;
    let scale = hardPix;
    let wb = Gaus(dst - 1.0, scale);
    let wc = Gaus(dst + 0.0, scale);
    let wd = Gaus(dst + 1.0, scale);
    return (b * wb + c * wc + d * wd) / (wb + wc + wd);
}

fn Horz5(pos: vec2<f32>, off: f32) -> vec3<f32> {
    let a = Fetch(pos, vec2<f32>(-2.0, off));
    let b = Fetch(pos, vec2<f32>(-1.0, off));
    let c = Fetch(pos, vec2<f32>( 0.0, off));
    let d = Fetch(pos, vec2<f32>( 1.0, off));
    let e = Fetch(pos, vec2<f32>( 2.0, off));
    let dst = Dist(pos).x;
    let scale = hardPix;
    let wa = Gaus(dst - 2.0, scale);
    let wb = Gaus(dst - 1.0, scale);
    let wc = Gaus(dst + 0.0, scale);
    let wd = Gaus(dst + 1.0, scale);
    let we = Gaus(dst + 2.0, scale);
    return (a * wa + b * wb + c * wc + d * wd + e * we) / (wa + wb + wc + wd + we);
}

fn Scan(pos: vec2<f32>, off: f32) -> f32 {
    let dst = Dist(pos).y;
    return Gaus(dst + off, hardScan);
}

fn Tri(pos: vec2<f32>) -> vec3<f32> {
    let a = Horz3(pos, -1.0);
    let b = Horz5(pos,  0.0);
    let c = Horz3(pos,  1.0);
    let wa = Scan(pos, -1.0);
    let wb = Scan(pos,  0.0);
    let wc = Scan(pos,  1.0);
    return a * wa + b * wb + c * wc;
}

fn Warp(posInput: vec2<f32>) -> vec2<f32> {
    if (!WARP_ENABLED) {
        return posInput;
    }
    var pos = posInput * 2.0 - 1.0;
    pos = pos * vec2<f32>(1.0 + (pos.y * pos.y) * warp.x, 1.0 + (pos.x * pos.x) * warp.y);
    return pos * 0.5 + 0.5;
}

fn Mask(posInput: vec2<f32>) -> vec3<f32> {
    if (!MASK_ENABLED) {
        return vec3<f32>(1.0, 1.0, 1.0);
    }
    var pos = posInput;
    pos.x += pos.y * 3.0;
    var mask = vec3<f32>(maskDark, maskDark, maskDark);
    pos.x = fract(pos.x / 6.0);
    if (pos.x < 0.333) {
        mask.r = maskLight;
    } else if (pos.x < 0.666) {
        mask.g = maskLight;
    } else {
        mask.b = maskLight;
    }
    return mask;
}

fn crtPostProcess(uv: vec2<f32>, fragCoord: vec2<f32>) -> vec3<f32> {
    let pos = Warp(vec2<f32>(uv.x, 1.0 - uv.y));
    let colorLinear = Tri(pos) * Mask(fragCoord);
    return ToSrgb(colorLinear);
}

/**
 * Função de pós-processamento do blit.
 * Com crt < 0.5: amostragem nearest pura idêntica à da Etapa 6.
 * Com crt >= 0.5: efeito CRT com scanlines e shadow mask.
 */
fn postProcess(uv: vec2<f32>, fragCoord: vec2<f32>) -> vec3<f32> {
    if (blitUniforms.crt < 0.5) {
        let srcX = clamp(i32(floor(uv.x * blitUniforms.internalSize.x)), 0i, i32(blitUniforms.internalSize.x) - 1i);
        let srcY = clamp(i32(floor(uv.y * blitUniforms.internalSize.y)), 0i, i32(blitUniforms.internalSize.y) - 1i);
        return textureLoad(sceneTexture, vec2<i32>(srcX, srcY), 0).rgb;
    }
    return crtPostProcess(uv, fragCoord);
}

@fragment
fn fs_blit(in: VertexOutput) -> @location(0) vec4<f32> {
    // fragCoord no padrão Shadertoy (origem no canto inferior esquerdo)
    let fragCoord = vec2<f32>(in.uv.x * blitUniforms.rectSize.x, (1.0 - in.uv.y) * blitUniforms.rectSize.y);
    let finalColor = postProcess(in.uv, fragCoord);
    return vec4<f32>(finalColor, 1.0);
}
`;

export function getBlitPipelineDescriptor(shaderModule, presentationFormat, layout = 'auto') {
    return {
        label: 'display.blitPipeline',
        layout,
        vertex: {
            module: shaderModule,
            entryPoint: 'vs_blit',
        },
        fragment: {
            module: shaderModule,
            entryPoint: 'fs_blit',
            targets: [{ format: presentationFormat }],
        },
        primitive: {
            topology: 'triangle-list',
        },
    };
}
