// Menu: copia a imagem 320x200 do menu para a textura interna da cena, com escala inteira e
// centralizada, ANTES do blit/CRT. Sem sampler e sem blending: alfa 0 é descartado.

struct MenuUniforms {
  params : vec4<f32>, // origem x, origem y, escala, 0 (alinhamento)
};

@group(0) @binding(0) var menuTex : texture_2d<f32>;
@group(0) @binding(1) var<uniform> mu : MenuUniforms;

const MENU_SIZE = vec2<i32>(320, 200);

// Triângulo que cobre a tela inteira, sem vertex buffer: vértices (-1,-1), (3,-1), (-1,3).
@vertex
fn vs_main(@builtin(vertex_index) i : u32) -> @builtin(position) vec4<f32> {
  let p = vec2<f32>(f32((i << 1u) & 2u), f32(i & 2u)) * 2.0 - 1.0;
  return vec4<f32>(p, 0.0, 1.0);
}

@fragment
fn fs_main(@builtin(position) pos : vec4<f32>) -> @location(0) vec4<f32> {
  let p = vec2<i32>(floor(pos.xy));
  let rel = p - vec2<i32>(mu.params.xy);
  // Testa antes da divisão: a divisão inteira de negativos arredonda para zero.
  if (rel.x < 0 || rel.y < 0) {
    discard;
  }
  let m = rel / i32(mu.params.z);
  if (m.x >= MENU_SIZE.x || m.y >= MENU_SIZE.y) {
    discard;
  }
  let c = textureLoad(menuTex, m, 0);
  if (c.a == 0.0) {
    discard; // pixel transparente do menu: a cena (ou o preto) continua visível
  }
  return vec4<f32>(c.rgb, 1.0);
}
