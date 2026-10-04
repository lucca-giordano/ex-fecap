// Shader das paredes e dos flats.
// Modo texturizado (mode = 1): índice lido do texture array com textureLoad, cor da paleta
//   iluminada (COLORMAP) no nível de luz calculado como no Doom; céu calculado pela direção do raio.
// Modo sólido (mode = 0): cor por vértice com sombreamento por uma luz direcional fixa.

struct Uniforms {
  viewProj : mat4x4<f32>,
  camPos : vec4<f32>,   // posição da câmera no mundo (w não usado; vec4 evita o alinhamento de vec3)
  mode : u32,           // 0 = sólido, 1 = texturizado
  lighting : u32,       // 0 = tudo no nível 0 (tecla L)
  skyTest : u32,        // 1 = todos os tetos usam o céu (tecla K)
  skyLayer : u32,       // camada da textura do céu no array de paredes
};

@group(0) @binding(0) var<uniform> u : Uniforms;

@group(1) @binding(0) var wallTex : texture_2d_array<u32>;  // R = índice, G = opacidade
@group(1) @binding(1) var flatTex : texture_2d_array<u32>;
@group(1) @binding(2) var litPalette : texture_2d<f32>;     // 256 x 32: (índice, nível de luz)
@group(1) @binding(3) var<storage, read> wallSizes : array<vec2<u32>>;

const LIGHT_DIR = vec3<f32>(0.57, 0.40, 0.72);
const NO_TEXTURE = 0xFFFFFFFFu;
const KIND_WALL = 0u;
const KIND_FLAT = 1u;
const KIND_SKY = 2u;
const PI = 3.14159265358979;

struct VSOut {
  @builtin(position) pos : vec4<f32>,
  @location(0) normal : vec3<f32>,
  @location(1) color : vec3<f32>,
  @location(2) uv : vec2<f32>,
  @location(3) @interpolate(flat) layer : u32,
  @location(4) @interpolate(flat) kind : u32,
  @location(5) @interpolate(flat) light : u32,
  @location(6) worldPos : vec3<f32>,
  // w do clip space = distância ao longo da direção da câmera (profundidade de vista).
  // Com interpolação perspectivo-correta o valor no pixel é exato. É o mesmo z que 1/position.w
  // daria, sem depender da convenção de position.w no fragmento.
  @location(7) viewDepth : f32,
};

@vertex
fn vs_main(@location(0) position : vec3<f32>,
           @location(1) normal : vec3<f32>,
           @location(2) color : vec3<f32>,
           @location(3) uv : vec2<f32>,
           @location(4) layer : u32,
           @location(5) kind : u32,
           @location(6) light : u32) -> VSOut {
  var out : VSOut;
  out.pos = u.viewProj * vec4<f32>(position, 1.0);
  out.normal = normal;
  out.color = color;
  out.uv = uv;
  out.layer = layer;
  out.kind = kind;
  out.light = light;
  out.worldPos = position;
  out.viewDepth = out.pos.w;
  return out;
}

// Módulo que funciona com negativos: wrap(-1, 64) = 63.
fn wrap(i : i32, n : i32) -> i32 {
  return ((i % n) + n) % n;
}

fn solidColor(in : VSOut) -> vec4<f32> {
  // Normal (0,0,0) marca superfícies sem sombreamento (teto de céu).
  if (length(in.normal) < 0.5) {
    return vec4<f32>(in.color, 1.0);
  }
  let shade = 0.4 + 0.6 * max(0.0, dot(normalize(in.normal), normalize(LIGHT_DIR)));
  return vec4<f32>(in.color * shade, 1.0);
}

// Nível do COLORMAP (0 = claro, 31 = escuro), reproduzindo o Doom original.
// lightnum: 0..15; z: profundidade de vista em unidades do Doom.
fn lightLevel(lightnum : u32, isWall : bool, z : f32) -> i32 {
  let startmap = (15 - i32(lightnum)) * 4;
  let zz = max(z, 1.0);
  if (isWall) {
    // Paredes: escala da coluna = 160 / z em ponto fixo >> 12 -> 2560 / z.
    let j = min(47, i32(floor(2560.0 / zz)));
    return clamp(startmap - j / 2, 0, 31);
  }
  // Chãos e tetos: tabela zlight do Doom (z >> 4 e escala 160 / (j + 1)).
  let j = min(127, i32(floor(zz / 16.0)));
  let scale = 160 / (j + 1);
  return clamp(startmap - scale / 2, 0, 31);
}

fn paletteColor(index : u32, level : i32) -> vec4<f32> {
  return vec4<f32>(textureLoad(litPalette, vec2<i32>(i32(index), level), 0).rgb, 1.0);
}

// Céu: depende só da direção do raio, nunca da posição da câmera nem da geometria.
fn skyColor(worldPos : vec3<f32>) -> vec4<f32> {
  let d = worldPos - u.camPos.xyz;
  let size = vec2<i32>(wallSizes[u.skyLayer]);
  // No mundo o y do Doom é -z: ângulo anti-horário a partir do leste, como no Doom.
  let yawDoom = atan2(-d.z, d.x);
  // 1024 colunas por volta completa (uma textura de 256 colunas se repete 4 vezes).
  let col = i32(floor(fract(yawDoom / (2.0 * PI)) * 1024.0)) % size.x;
  let horiz = max(length(vec2<f32>(d.x, d.z)), 0.000001);
  let tanPitch = d.y / horiz;
  // Linha 100 no horizonte; 133.33 = 160 / 1.2 (meia largura de 320 / correção de pixel).
  let row = clamp(i32(floor(100.0 - 133.33 * tanPitch)), 0, size.y - 1);
  let texel = textureLoad(wallTex, vec2<i32>(col, row), u.skyLayer, 0);
  return paletteColor(texel.r, 0);
}

@fragment
fn fs_main(in : VSOut) -> @location(0) vec4<f32> {
  if (u.mode == 0u) {
    return solidColor(in);
  }

  // Teto de céu, ou qualquer teto (normal para baixo) com o teste do céu (K) ligado.
  let isCeiling = in.kind == KIND_FLAT && in.normal.y < -0.5;
  if (in.kind == KIND_SKY || (u.skyTest == 1u && isCeiling)) {
    return skyColor(in.worldPos);
  }
  if (in.layer == NO_TEXTURE) {
    discard;
  }

  // UVs em texels (1 texel = 1 unidade do Doom); floor + wrap repete a textura.
  var texel : vec4<u32>;
  if (in.kind == KIND_WALL) {
    let size = vec2<i32>(wallSizes[in.layer]);
    let ix = wrap(i32(floor(in.uv.x)), size.x);
    let iy = wrap(i32(floor(in.uv.y)), size.y);
    texel = textureLoad(wallTex, vec2<i32>(ix, iy), in.layer, 0);
  } else {
    let ix = wrap(i32(floor(in.uv.x)), 64);
    let iy = wrap(i32(floor(in.uv.y)), 64);
    texel = textureLoad(flatTex, vec2<i32>(ix, iy), in.layer, 0);
  }

  if (texel.g == 0u) {
    discard; // pixel transparente da textura composta
  }

  var level = 0;
  if (u.lighting == 1u) {
    level = lightLevel(in.light, in.kind == KIND_WALL, in.viewDepth);
  }
  return paletteColor(texel.r, level);
}
