// Sprites dos objetos do mapa (THINGS): quads de pé, alinhados ao plano da tela, como no Doom.
//
// Este arquivo é concatenado DEPOIS de walls.wgsl (WGSL não tem #include) para reaproveitar
// lightLevel(), a mesma regra de luz das paredes. Os nomes daqui começam com sp/sprite e os bindings
// usam o grupo 0 nos números 1 a 4, para não colidir com as variáveis de walls.wgsl.

struct SpriteUniforms {
  viewProj : mat4x4f,
  right : vec4f,      // direita HORIZONTAL da câmera, normalizada (w não usado)
  cameraPos : vec4f,  // w não usado
  params : vec4u,     // iluminação (0/1), 0, 0, 0
}

@group(0) @binding(1) var<uniform> spU : SpriteUniforms;
@group(0) @binding(2) var spriteTex : texture_2d_array<u32>;          // R = índice, G = opacidade
@group(0) @binding(3) var<storage, read> spriteMeta : array<vec4i>;   // width, height, leftOffset, topOffset
@group(0) @binding(4) var spritePalette : texture_2d<f32>;            // paleta iluminada 256 x 32

const SPRITE_MIRRORED = 1u;
const SPRITE_FULLBRIGHT = 2u;
const SPRITE_FUZZ = 4u;

struct SpriteIn {
  @location(0) base : vec3f,   // base do objeto no mundo (chão do setor)
  @location(1) layer : u32,
  @location(2) lightnum : u32,
  @location(3) flags : u32,
}

struct SpriteOut {
  @builtin(position) pos : vec4f,
  @location(0) texel : vec2f, // u em [0, width] (esquerda -> direita), v em [0, height] (topo -> base)
  @location(1) @interpolate(flat) layer : u32,
  @location(2) @interpolate(flat) lightnum : u32,
  @location(3) @interpolate(flat) flags : u32,
  @location(4) viewDepth : f32, // w do clip space, como nas paredes
}

@vertex
fn sp_vs(@builtin(vertex_index) vi : u32, inst : SpriteIn) -> SpriteOut {
  // Cantos dos 2 triângulos: x 0 = esquerda, 1 = direita; y 0 = base, 1 = topo.
  var corners = array<vec2f, 6>(
    vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),
    vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0));
  let c = corners[vi];
  let m = spriteMeta[inst.layer];
  let w = f32(m.x);
  let h = f32(m.y);
  let left = f32(m.z);
  let top = f32(m.w);
  // Em unidades do Doom (1 texel = 1 unidade): ao longo da direita, de -leftOffset a width - leftOffset;
  // na vertical, de topOffset - height a topOffset acima da base. O quad fica sempre de pé.
  let along = mix(-left, w - left, c.x);
  let up = mix(top - h, top, c.y);
  let world = inst.base + spU.right.xyz * along + vec3f(0.0, up, 0.0);

  var out : SpriteOut;
  out.pos = spU.viewProj * vec4f(world, 1.0);
  out.texel = vec2f(c.x * w, (1.0 - c.y) * h);
  out.layer = inst.layer;
  out.lightnum = inst.lightnum;
  out.flags = inst.flags;
  out.viewDepth = out.pos.w;
  return out;
}

@fragment
fn sp_fs(in : SpriteOut) -> @location(0) vec4f {
  // Fuzz (espectro): aproximação em xadrez do efeito original.
  if ((in.flags & SPRITE_FUZZ) != 0u && ((i32(floor(in.pos.x)) + i32(floor(in.pos.y))) & 1) == 1) {
    discard;
  }
  let m = spriteMeta[in.layer];
  var col = clamp(i32(floor(in.texel.x)), 0, m.x - 1);
  let row = clamp(i32(floor(in.texel.y)), 0, m.y - 1);
  if ((in.flags & SPRITE_MIRRORED) != 0u) {
    col = m.x - 1 - col; // vista espelhada: mesmo lump, colunas invertidas
  }
  let t = textureLoad(spriteTex, vec2i(col, row), in.layer, 0);
  if (t.g == 0u) {
    discard; // pixel transparente do sprite
  }
  var level = 0;
  if (spU.params.x == 1u && (in.flags & SPRITE_FULLBRIGHT) == 0u) {
    level = lightLevel(in.lightnum, true, in.viewDepth); // mesma regra das paredes (walls.wgsl)
  }
  return vec4f(textureLoad(spritePalette, vec2i(i32(t.r), level), 0).rgb, 1.0);
}
