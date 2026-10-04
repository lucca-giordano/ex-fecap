// Fonte: https://www.shadertoy.com/view/XsjSzR
// Título original: FixingPixelArt / PUBLIC DOMAIN CRT STYLED SCAN-LINE SHADER
// Publicado no Shadertoy por: TimothyLottes
// Autor original: Timothy Lottes
// Licença: Domínio público ("PUBLIC DOMAIN CRT STYLED SCAN-LINE SHADER by Timothy Lottes")
// Adaptação para WGSL (WebGPU puro) no projeto Doom.

// Dureza das scanlines
// -8.0 = suave
// -16.0 = média
const hardScan: f32 = -8.0;

// Dureza dos pixels na scanline
// -2.0 = suave
// -4.0 = duro
const hardPix: f32 = -3.0;

// Curvatura da tela (Warp)
// 0.0 = nenhuma
// 1.0/8.0 = extrema
const warp: vec2<f32> = vec2<f32>(1.0 / 32.0, 1.0 / 24.0);

// Intensidades da máscara de sombra de fósforo
const maskDark: f32 = 0.5;
const maskLight: f32 = 1.5;

// Parâmetros de controle de recursos
const WARP_ENABLED: bool = true;
const MASK_ENABLED: bool = true;

// Conversão de sRGB para Linear
fn ToLinear1(c: f32) -> f32 {
    if (c <= 0.04045) {
        return c / 12.92;
    }
    return pow(max(c + 0.055, 0.0) / 1.055, 2.4);
}

fn ToLinear(c: vec3<f32>) -> vec3<f32> {
    return vec3<f32>(ToLinear1(c.r), ToLinear1(c.g), ToLinear1(c.b));
}

// Conversão de Linear para sRGB
fn ToSrgb1(c: f32) -> f32 {
    if (c < 0.0031308) {
        return c * 12.92;
    }
    return 1.055 * pow(max(c, 0.0), 0.41666) - 0.055;
}

fn ToSrgb(c: vec3<f32>) -> vec3<f32> {
    return vec3<f32>(ToSrgb1(c.r), ToSrgb1(c.g), ToSrgb1(c.b));
}

// Amostragem discreta na resolução emulada com verificação estrita de limites
// Retorna preto fora dos limites válidos da textura
fn Fetch(pos: vec2<f32>, off: vec2<f32>) -> vec3<f32> {
    let res = blitUniforms.internalSize;
    let idx = vec2<i32>(floor(pos * res + off));
    let W = i32(res.x);
    let H = i32(res.y);

    if (idx.x < 0 || idx.x >= W || idx.y < 0 || idx.y >= H) {
        return vec3<f32>(0.0, 0.0, 0.0);
    }

    // Inversão de linha: o Shadertoy tem origem embaixo, o WebGPU tem origem em cima
    let row = H - 1 - idx.y;
    let col = idx.x;

    let texel = textureLoad(sceneTexture, vec2<i32>(col, row), 0);
    return ToLinear(texel.rgb);
}

// Distância em pixels emulados até o texel mais próximo
fn Dist(posInput: vec2<f32>) -> vec2<f32> {
    let pos = posInput * blitUniforms.internalSize;
    return -((pos - floor(pos)) - vec2<f32>(0.5, 0.5));
}

// Gaussiana 1D
fn Gaus(pos: f32, scale: f32) -> f32 {
    return exp2(scale * pos * pos);
}

// Filtro gaussiano de 3 toques ao longo da linha horizontal
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

// Filtro gaussiano de 5 toques ao longo da linha horizontal
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

// Retorna o peso da scanline
fn Scan(pos: vec2<f32>, off: f32) -> f32 {
    let dst = Dist(pos).y;
    return Gaus(dst + off, hardScan);
}

// Combina as três scanlines verticais vizinhas mais próximas
fn Tri(pos: vec2<f32>) -> vec3<f32> {
    let a = Horz3(pos, -1.0);
    let b = Horz5(pos,  0.0);
    let c = Horz3(pos,  1.0);
    let wa = Scan(pos, -1.0);
    let wb = Scan(pos,  0.0);
    let wc = Scan(pos,  1.0);
    return a * wa + b * wb + c * wc;
}

// Distorção de curvatura da tela (Warp)
fn Warp(posInput: vec2<f32>) -> vec2<f32> {
    if (!WARP_ENABLED) {
        return posInput;
    }
    var pos = posInput * 2.0 - 1.0;
    pos = pos * vec2<f32>(1.0 + (pos.y * pos.y) * warp.x, 1.0 + (pos.x * pos.x) * warp.y);
    return pos * 0.5 + 0.5;
}

// Máscara de sombra de fósforo (Shadow mask)
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

// Função principal de pós-processamento CRT
fn crtPostProcess(uv: vec2<f32>, fragCoord: vec2<f32>) -> vec3<f32> {
    let pos = Warp(vec2<f32>(uv.x, 1.0 - uv.y));
    let colorLinear = Tri(pos) * Mask(fragCoord);
    return ToSrgb(colorLinear);
}
