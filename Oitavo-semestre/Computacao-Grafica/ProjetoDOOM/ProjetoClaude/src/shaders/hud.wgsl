// Camada de interface (pistola + barra de status): copia a imagem 320x200 para a textura interna da
// cena, com escala inteira e centralizada, depois de cena/sprites/partículas e antes do menu e do
// blit/CRT. Baseado em menu.wgsl, com a extensão lateral da barra: nas linhas da barra (168 a 199),
// os pixels fora da imagem centralizada repetem a coluna de borda, para a barra ocupar a largura toda.

struct HudUniforms {
  params : vec4<f32>, // origem x, origem y, escala, 0 (alinhamento)
};

@group(0) @binding(0) var hudTex : texture_2d<f32>;
@group(0) @binding(1) var<uniform> hudU : HudUniforms;

const HUD_SIZE = vec2<i32>(320, 200);
const HUD_BAR_Y = 168;

// Triângulo que cobre a tela inteira, sem vertex buffer: vértices (-1,-1), (3,-1), (-1,3).
@vertex
fn hud_vs(@builtin(vertex_index) i : u32) -> @builtin(position) vec4<f32> {
  let p = vec2<f32>(f32((i << 1u) & 2u), f32(i & 2u)) * 2.0 - 1.0;
  return vec4<f32>(p, 0.0, 1.0);
}

@fragment
fn hud_fs(@builtin(position) pos : vec4<f32>) -> @location(0) vec4<f32> {
  let p = vec2<i32>(floor(pos.xy));
  let rel = p - vec2<i32>(hudU.params.xy);
  let s = i32(hudU.params.z);
  // Linha: testa antes da divisão (a divisão inteira de negativos arredonda para zero).
  if (rel.y < 0) {
    discard;
  }
  let my = rel.y / s;
  if (my >= HUD_SIZE.y) {
    discard;
  }
  var mx : i32;
  if (my >= HUD_BAR_Y) {
    // Linhas da barra: fora da imagem, repete a coluna de borda (x limitado a [0, 319]).
    mx = clamp(select(rel.x / s, -1, rel.x < 0), 0, HUD_SIZE.x - 1);
  } else {
    if (rel.x < 0) {
      discard;
    }
    mx = rel.x / s;
    if (mx >= HUD_SIZE.x) {
      discard;
    }
  }
  let c = textureLoad(hudTex, vec2<i32>(mx, my), 0);
  if (c.a == 0.0) {
    discard; // transparente: a cena continua visível
  }
  return vec4<f32>(c.rgb, 1.0);
}
