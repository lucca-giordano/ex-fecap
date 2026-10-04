// Efeito CRT: ADAPTAÇÃO para WGSL do "PUBLIC DOMAIN CRT STYLED SCAN-LINE SHADER", de Timothy Lottes.
// Fonte: https://www.shadertoy.com/view/XsjSzR (página "FixingPixelArt", publicada por TimothyLottes).
// Licença do original: domínio público, conforme o cabeçalho do próprio código.
// Original sem modificações em src/shaders/external/crt.glsl; todas as alterações estão listadas
// em docs/shaders/crt.md ("Adaptações"). Nomes e estrutura seguem o original para comparação.
//
// Este arquivo é concatenado com blit.wgsl (WGSL não tem #include) e usa de lá:
//   scene : textura interna da cena;  post : uniform de pós-processamento (internalSize, rectSize).

// Opções do projeto (não existem no original).
const MASK_ENABLED = true; // false = sem máscara de fósforo (equivale a maskDark = maskLight = 1.0)
const WARP_ENABLED = true; // false = sem curvatura (a curvatura corta as bordas da imagem)

// Hardness of scanline.
//  -8.0 = soft
// -16.0 = medium
const hardScan : f32 = -8.0;  // original: float hardScan=-8.0;

// Hardness of pixels in scanline.
// -2.0 = soft
// -4.0 = hard
const hardPix : f32 = -3.0;   // original: float hardPix=-3.0;

// Display warp.
// 0.0 = none
// 1.0/8.0 = extreme
const warp : vec2<f32> = vec2<f32>(1.0 / 32.0, 1.0 / 24.0); // original: vec2(1.0/32.0,1.0/24.0)

// Amount of shadow mask.
const maskDark : f32 = 0.5;   // original: float maskDark=0.5;
const maskLight : f32 = 1.5;  // original: float maskLight=1.5;

// Emulated input resolution.
// Original: #define res (iResolution.xy/6.0). Aqui é a resolução interna do jogo, para as
// scanlines coincidirem com as linhas da imagem interna.
fn res() -> vec2<f32> {
  return post.internalSize;
}

//------------------------------------------------------------------------

// sRGB to Linear.
// Mantida: a textura interna (rgba8unorm) e o canvas não são sRGB, então a conversão é necessária.
// max(..., 0.0): pow com base negativa é indefinido em WGSL (e select avalia os dois lados).
fn ToLinear1(c : f32) -> f32 {
  return select(pow(max((c + 0.055) / 1.055, 0.0), 2.4), c / 12.92, c <= 0.04045);
}
fn ToLinear(c : vec3<f32>) -> vec3<f32> {
  return vec3<f32>(ToLinear1(c.r), ToLinear1(c.g), ToLinear1(c.b));
}

// Linear to sRGB.
fn ToSrgb1(c : f32) -> f32 {
  return select(1.055 * pow(max(c, 0.0), 0.41666) - 0.055, c * 12.92, c < 0.0031308);
}
fn ToSrgb(c : vec3<f32>) -> vec3<f32> {
  return vec3<f32>(ToSrgb1(c.r), ToSrgb1(c.g), ToSrgb1(c.b));
}

// Nearest emulated sample given floating point position and texel offset.
// Also zero's off screen.
// pos e off seguem o Shadertoy (origem embaixo). Sem sampler: índice inteiro + textureLoad.
// A checagem de limites é feita no índice: a original (sobre pos arredondado) aceitava o índice
// igual a W ou H, um texel além do fim da textura.
fn Fetch(pos : vec2<f32>, off : vec2<f32>) -> vec3<f32> {
  let size = vec2<i32>(post.internalSize);
  let idx = vec2<i32>(floor(pos * res() + off));
  if (idx.x < 0 || idx.x >= size.x || idx.y < 0 || idx.y >= size.y) {
    return vec3<f32>(0.0, 0.0, 0.0);
  }
  // A textura tem a linha 0 em cima; o Shadertoy, embaixo.
  let row = size.y - 1 - idx.y;
  return ToLinear(textureLoad(scene, vec2<i32>(idx.x, row), 0).rgb);
}

// Distance in emulated pixels to nearest texel.
fn Dist(pos : vec2<f32>) -> vec2<f32> {
  let p = pos * res();
  return -((p - floor(p)) - vec2<f32>(0.5, 0.5));
}

// 1D Gaussian.
fn Gaus(pos : f32, scale : f32) -> f32 {
  return exp2(scale * pos * pos);
}

// 3-tap Gaussian filter along horz line.
fn Horz3(pos : vec2<f32>, off : f32) -> vec3<f32> {
  let b = Fetch(pos, vec2<f32>(-1.0, off));
  let c = Fetch(pos, vec2<f32>( 0.0, off));
  let d = Fetch(pos, vec2<f32>( 1.0, off));
  let dst = Dist(pos).x;
  // Convert distance to weight.
  let scale = hardPix;
  let wb = Gaus(dst - 1.0, scale);
  let wc = Gaus(dst + 0.0, scale);
  let wd = Gaus(dst + 1.0, scale);
  // Return filtered sample.
  return (b * wb + c * wc + d * wd) / (wb + wc + wd);
}

// 5-tap Gaussian filter along horz line.
fn Horz5(pos : vec2<f32>, off : f32) -> vec3<f32> {
  let a = Fetch(pos, vec2<f32>(-2.0, off));
  let b = Fetch(pos, vec2<f32>(-1.0, off));
  let c = Fetch(pos, vec2<f32>( 0.0, off));
  let d = Fetch(pos, vec2<f32>( 1.0, off));
  let e = Fetch(pos, vec2<f32>( 2.0, off));
  let dst = Dist(pos).x;
  // Convert distance to weight.
  let scale = hardPix;
  let wa = Gaus(dst - 2.0, scale);
  let wb = Gaus(dst - 1.0, scale);
  let wc = Gaus(dst + 0.0, scale);
  let wd = Gaus(dst + 1.0, scale);
  let we = Gaus(dst + 2.0, scale);
  // Return filtered sample.
  return (a * wa + b * wb + c * wc + d * wd + e * we) / (wa + wb + wc + wd + we);
}

// Return scanline weight.
fn Scan(pos : vec2<f32>, off : f32) -> f32 {
  let dst = Dist(pos).y;
  return Gaus(dst + off, hardScan);
}

// Allow nearest three lines to effect pixel.
fn Tri(pos : vec2<f32>) -> vec3<f32> {
  let a = Horz3(pos, -1.0);
  let b = Horz5(pos, 0.0);
  let c = Horz3(pos, 1.0);
  let wa = Scan(pos, -1.0);
  let wb = Scan(pos, 0.0);
  let wc = Scan(pos, 1.0);
  return a * wa + b * wb + c * wc;
}

// Distortion of scanlines, and end of screen alpha.
fn Warp(pos : vec2<f32>) -> vec2<f32> {
  if (!WARP_ENABLED) {
    return pos;
  }
  var p = pos * 2.0 - 1.0;
  p *= vec2<f32>(1.0 + (p.y * p.y) * warp.x, 1.0 + (p.x * p.x) * warp.y);
  return p * 0.5 + 0.5;
}

// Shadow mask.
// pos em pixels REAIS da tela (retângulo de exibição, origem embaixo), período de 6 pixels:
// pode gerar moiré em projetores ou telas de alta densidade (desligue com MASK_ENABLED).
fn Mask(pos : vec2<f32>) -> vec3<f32> {
  if (!MASK_ENABLED) {
    return vec3<f32>(1.0, 1.0, 1.0);
  }
  var p = pos;
  p.x += p.y * 3.0;
  var mask = vec3<f32>(maskDark, maskDark, maskDark);
  p.x = fract(p.x / 6.0);
  if (p.x < 0.333) {
    mask.r = maskLight;
  } else if (p.x < 0.666) {
    mask.g = maskLight;
  } else {
    mask.b = maskLight;
  }
  return mask;
}

// Entry. Só o painel completo do original (Warp + Tri + Mask).
// fragCoord: pixels do retângulo de exibição, origem embaixo (como no Shadertoy).
// iResolution do original = post.rectSize.
fn crtMainImage(fragCoord : vec2<f32>) -> vec3<f32> {
  let pos = Warp(fragCoord / post.rectSize);
  let color = Tri(pos) * Mask(fragCoord);
  return ToSrgb(color);
}
