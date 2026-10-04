// Blit: copia a imagem renderizada na resolução interna para o retângulo de exibição do canvas,
// passando por postProcess (efeito CRT opcional, em crt.wgsl, concatenado a este arquivo).
// Leitura com textureLoad (sem sampler).

struct BlitUniforms {
  origin : vec2<f32>,    // canto superior esquerdo do retângulo de destino, em pixels do canvas
  size : vec2<f32>,      // tamanho do retângulo de destino, em pixels do canvas
  internal : vec2<f32>,  // tamanho da textura interna
};

// Uniform de pós-processamento: 32 bytes.
// Offsets (regras de alinhamento do WGSL: vec2<f32> alinha em 8, f32 em 4):
//   internalSize 0, rectSize 8, time 16, crt 20, _pad 24 -> tamanho 32.
struct PostUniforms {
  internalSize : vec2<f32>, // tamanho da textura interna (res do CRT)
  rectSize : vec2<f32>,     // tamanho do retângulo de exibição (iResolution do CRT)
  time : f32,               // reservado (o CRT não usa)
  crt : f32,                // 0.0 = desligado, 1.0 = ligado
  _pad : vec2<f32>,
};

@group(0) @binding(0) var scene : texture_2d<f32>;
@group(0) @binding(1) var<uniform> blit : BlitUniforms;
@group(0) @binding(2) var<uniform> post : PostUniforms;

// Triângulo que cobre a tela inteira, sem vertex buffer: vértices (-1,-1), (3,-1), (-1,3).
@vertex
fn vs_main(@builtin(vertex_index) i : u32) -> @builtin(position) vec4<f32> {
  let p = vec2<f32>(f32((i << 1u) & 2u), f32(i & 2u)) * 2.0 - 1.0;
  return vec4<f32>(p, 0.0, 1.0);
}

// Leitura nearest da etapa 6, com o mesmo cálculo de coordenada de origem.
fn nearest(rel : vec2<f32>) -> vec3<f32> {
  let src = vec2<i32>(floor(rel * blit.internal / blit.size));
  let texel = clamp(src, vec2<i32>(0, 0), vec2<i32>(blit.internal) - vec2<i32>(1, 1));
  return textureLoad(scene, texel, 0).rgb;
}

// Pós-processamento.
// rel: pixel relativo ao retângulo (usado só no caminho sem efeito, para ser idêntico à etapa 6);
// uv: posição normalizada no retângulo, origem em cima;
// fragCoord: pixels do retângulo no estilo Shadertoy (origem embaixo).
fn postProcess(rel : vec2<f32>, uv : vec2<f32>, fragCoord : vec2<f32>) -> vec3<f32> {
  if (post.crt < 0.5) {
    return nearest(rel);
  }
  return crtMainImage(fragCoord);
}

@fragment
fn fs_main(@builtin(position) pos : vec4<f32>) -> @location(0) vec4<f32> {
  // pos.xy está em pixels do canvas (centro do pixel); o viewport limita ao retângulo.
  let rel = pos.xy - blit.origin;
  let uv = rel / blit.size;
  let fragCoord = vec2<f32>(uv.x * post.rectSize.x, (1.0 - uv.y) * post.rectSize.y);
  return vec4<f32>(postProcess(rel, uv, fragCoord), 1.0);
}
