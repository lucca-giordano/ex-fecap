// Partículas de poeira e brasas: ADAPTAÇÃO do exemplo "Particles" do WebGPU Samples.
// Fonte: https://github.com/webgpu/webgpu-samples/tree/main/sample/particles
// Projeto: WebGPU Samples (webgpu/webgpu-samples). Autores: WebGPU Samples Contributors.
// Licença: BSD-3-Clause (texto integral em CREDITS.md).
// Original sem modificações em src/shaders/external/particles/; todas as alterações estão listadas
// em docs/shaders/particles.md ("Adaptações"). Nomes e estrutura seguem o original.
//
// Coordenadas do mundo do renderizador: Y para cima, unidades do Doom.
// Os valores visuais (quantidade, tamanho, vida, velocidades, cores) vêm dos uniforms, montados a
// partir dos parâmetros de src/particles/particleConfig.js.

////////////////////////////////////////////////////////////////////////////////
// Utilities
////////////////////////////////////////////////////////////////////////////////
// A pseudo random number. Initialized with init_rand(), updated with rand().
var<private> rnd : vec4u;

// Initializes the random number generator.
fn init_rand(invocation_id : u32, seed : vec4u) {
  const A = vec4(1741651 * 1009,
                 140893  * 1609 * 13,
                 6521    * 983  * 7  * 2,
                 1109    * 509  * 83 * 11 * 3);
  rnd = (A * vec4u(invocation_id)) ^ seed;
}

// Returns a random number between 0 and 1.
fn rand() -> f32 {
  const C = vec4(60493  * 9377,
                 11279  * 2539 * 23,
                 7919   * 631  * 5  * 3,
                 1277   * 211  * 19 * 7 * 2);

  rnd = (rnd * C) ^ (rnd.yzwx >> vec4(4u));
  return f32(rnd.x ^ rnd.y) / f32(0xffffffff);
}

const PI = 3.14159265358979;
const KIND_DUST = 0.0;
const KIND_EMBER = 1.0;
const NEAR = 1.0; // plano near da projeção da cena

// Balanço horizontal: amplitude proporcional à velocidade (poeira) ou à deriva (brasa).
const DUST_SWAY_FACTOR = 0.25;
const DUST_SWAY_PERIOD = 5.0;  // segundos
const EMBER_SWAY_FACTOR = 0.5;
const EMBER_SWAY_PERIOD = 2.0;
const DUST_VERTICAL_FACTOR = 0.5; // velocidade vertical máxima da poeira = speed * 0.5

////////////////////////////////////////////////////////////////////////////////
// Vertex shader
////////////////////////////////////////////////////////////////////////////////
struct RenderParams {
  viewProj : mat4x4f,
  sizeParams : vec4f, // sizeScale, minPixels, maxPixels, fadeFraction
  view : vec4f,       // tanHalfFov, larguraInterna, alturaInterna, time
  flags : vec4u,      // pixelSnap, iluminação, sem fade (diagnóstico), 0
  palette : vec4u,    // índice poeira, brasa quente, brasa fria, lightnum da poeira
  ember : vec4f,      // flickerHz, 0, 0, 0
}
@binding(0) @group(0) var<uniform> render_params : RenderParams;
@binding(1) @group(0) var litPalette : texture_2d<f32>; // 256 x 32 (etapa 6)

struct VertexInput {
  @location(0) position : vec3f, // por instância
  @location(1) life : f32,       // por instância
  @location(2) kind : f32,       // por instância
  @location(3) params : vec4f,   // por instância: lifeTotal, phase, worldSize, geração (0 = não nasceu)
  @location(4) quad_pos : vec2f, // por vértice: -1..+1
}

struct VertexOutput {
  @builtin(position) position : vec4f,
  @location(0) @interpolate(flat) color_index : u32,
  @location(1) @interpolate(flat) level : u32,
}

// Mesma fórmula dos chãos e tetos da etapa 6 (walls.wgsl), com z = profundidade de vista.
fn flatLightLevel(lightnum : u32, z : f32) -> i32 {
  let startmap = (15 - i32(lightnum)) * 4;
  let j = min(127, i32(floor(max(z, 1.0) / 16.0)));
  let scale = 160 / (j + 1);
  return clamp(startmap - scale / 2, 0, 31);
}

// Hash simples para a cintilação das brasas.
fn hash2(p : vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(12.9898, 78.233))) * 43758.5453);
}

// Vértice fora do volume de recorte: o triângulo some.
fn hidden() -> VertexOutput {
  var out : VertexOutput;
  out.position = vec4f(2.0, 2.0, 2.0, 1.0);
  out.color_index = 0u;
  out.level = 0u;
  return out;
}

@vertex
fn vs_main(in : VertexInput) -> VertexOutput {
  let lifeTotal = in.params.x;
  let phase = in.params.y;
  let worldSize = in.params.z;
  let born = in.params.w > 0.0;
  let rp = render_params;
  let W = rp.view.y;
  let H = rp.view.z;
  let time = rp.view.w;

  // Centro em clip space; w = profundidade de vista (antes da divisão perspectiva).
  let center = rp.viewProj * vec4f(in.position, 1.0);
  let w = center.w;
  if (!born || w < NEAR) {
    return hidden();
  }

  // 1-3. Tamanho em pixels da imagem interna: cresce ao se aproximar, limitado a [min, max].
  let upp = w * 2.0 * rp.view.x / H;
  let basePx = worldSize * rp.sizeParams.x / upp;
  var sizePx = clamp(round(basePx), rp.sizeParams.y, rp.sizeParams.z);

  // 4. Fade por encolhimento ao nascer e ao morrer.
  let fadeFraction = rp.sizeParams.w;
  var fade = 1.0;
  if (fadeFraction > 0.0 && rp.flags.z == 0u) {
    let age = lifeTotal - in.life;
    fade = clamp(min(age, in.life) / (fadeFraction * lifeTotal), 0.0, 1.0);
  }
  sizePx = round(sizePx * fade);
  if (sizePx < 1.0) {
    return hidden();
  }

  // 5. Quad alinhado à tela em pixels internos (já é um billboard).
  let ndc = center.xy / w;
  let p = vec2f((ndc.x * 0.5 + 0.5) * W, (0.5 - ndc.y * 0.5) * H);
  // 6. Muito fora da tela: não desenha.
  if (p.x < -sizePx || p.x > W + sizePx || p.y < -sizePx || p.y > H + sizePx) {
    return hidden();
  }
  var c = p;
  if (rp.flags.x == 1u) {
    // Alinhado à grade: tamanho ímpar centraliza no meio do pixel, par na borda entre pixels.
    let odd = (i32(sizePx) & 1) == 1;
    c = select(round(p), floor(p) + 0.5, odd);
  }
  let corner = c + in.quad_pos * (sizePx * 0.5);
  let cornerNdc = vec2f(corner.x / W * 2.0 - 1.0, 1.0 - corner.y / H * 2.0);

  var out : VertexOutput;
  // Mesmos z e w do centro em todos os vértices: profundidade constante no quad.
  out.position = vec4f(cornerNdc * w, center.z, w);

  let lit = rp.flags.y == 1u;
  if (in.kind == KIND_EMBER) {
    // Brasa: brilho máximo, alterna entre quente e fria em flickerHz.
    let flick = hash2(vec2f(phase, floor(time * rp.ember.x)));
    out.color_index = select(rp.palette.z, rp.palette.y, flick < 0.5);
    out.level = 0u;
  } else {
    out.color_index = rp.palette.x;
    out.level = select(0u, u32(flatLightLevel(rp.palette.w, w)), lit);
  }
  return out;
}

////////////////////////////////////////////////////////////////////////////////
// Fragment shader
////////////////////////////////////////////////////////////////////////////////
@fragment
fn fs_main(in : VertexOutput) -> @location(0) vec4f {
  // Quad opaco com a cor da paleta iluminada (sem o recorte circular nem alfa do original).
  let color = textureLoad(litPalette, vec2i(i32(in.color_index), i32(in.level)), 0);
  return vec4f(color.rgb, 1.0);
}

////////////////////////////////////////////////////////////////////////////////
// Simulation Compute shader
////////////////////////////////////////////////////////////////////////////////
struct SimulationParams {
  deltaTime : f32,
  time : f32,
  count : u32,        // partículas ativas
  emberRatio : f32,
  generation : f32,   // muda no "Reiniciar partículas"
  _pad0 : f32,
  _pad1 : f32,
  _pad2 : f32,
  seed : vec4u,
  cameraPos : vec4f,  // w não usado
  boxHalf : vec4f,    // boxHalfXZ, boxHalfY, boxHalfXZ, 0
  dust : vec4f,       // lifeMin, lifeMax, speed, size
  emberLife : vec4f,  // lifeMin, lifeMax, riseMin, riseMax
  emberMove : vec4f,  // drift, size, 0, 0
}

struct Particle {
  position : vec3f,
  life     : f32,
  velocity : vec3f,
  kind     : f32,   // 0 = poeira, 1 = brasa
  params   : vec4f, // lifeTotal, phase, worldSize, geração (0 = buffer zerado, ainda não nasceu)
}

struct Particles {
  particles : array<Particle>,
}

@binding(0) @group(0) var<uniform> sim_params : SimulationParams;
@binding(1) @group(0) var<storage, read_write> data : Particles;

// Envolvimento relativo à câmera, por componente: ((d + h) - 2h * floor((d + h) / 2h)) - h.
// Não usa %, que trunca em direção a zero e erra para negativos.
fn wrap_box(d : vec3f, h : vec3f) -> vec3f {
  return ((d + h) - 2.0 * h * floor((d + h) / (2.0 * h))) - h;
}

// Velocidade horizontal com direção e módulo aleatórios (módulo até max_speed).
fn rand_horizontal(max_speed : f32) -> vec2f {
  let angle = rand() * 2.0 * PI;
  return vec2f(cos(angle), sin(angle)) * (rand() * max_speed);
}

fn spawn(particle : ptr<function, Particle>, first : bool) {
  let s = sim_params;
  (*particle).position = s.cameraPos.xyz + (vec3f(rand(), rand(), rand()) * 2.0 - 1.0) * s.boxHalf.xyz;
  var lifeTotal : f32;
  if (rand() < s.emberRatio) {
    (*particle).kind = KIND_EMBER;
    lifeTotal = mix(s.emberLife.x, s.emberLife.y, rand());
    let drift = rand_horizontal(s.emberMove.x);
    (*particle).velocity = vec3f(drift.x, mix(s.emberLife.z, s.emberLife.w, rand()), drift.y);
    (*particle).params.z = s.emberMove.y;
  } else {
    (*particle).kind = KIND_DUST;
    lifeTotal = mix(s.dust.x, s.dust.y, rand());
    let drift = rand_horizontal(s.dust.z);
    (*particle).velocity = vec3f(drift.x, (rand() * 2.0 - 1.0) * s.dust.z * DUST_VERTICAL_FACTOR, drift.y);
    (*particle).params.z = s.dust.w;
  }
  (*particle).params.x = lifeTotal;
  (*particle).params.y = rand() * 2.0 * PI; // fase do balanço e da cintilação
  (*particle).params.w = s.generation;
  // Primeiro nascimento (ou reinício): vida escalonada entre 0 e o total, para não morrerem juntas.
  (*particle).life = select(lifeTotal, rand() * lifeTotal, first);
}

@compute @workgroup_size(64)
fn simulate(@builtin(global_invocation_id) global_invocation_id : vec3u) {
  let idx = global_invocation_id.x;
  // A última workgroup pode passar do número de partículas ativas.
  if (idx >= sim_params.count) {
    return;
  }

  init_rand(idx, sim_params.seed);

  var particle = data.particles[idx];
  let dt = sim_params.deltaTime;

  // Age each particle. If the lifetime has gone negative, then the particle is dead and should be
  // respawned. Geração diferente (buffer zerado ou "Reiniciar partículas"): renasce escalonada.
  particle.life = particle.life - dt;
  let restart = particle.params.w != sim_params.generation;
  if (restart || particle.life <= 0.0) {
    spawn(&particle, restart);
  } else {
    // Basic velocity integration, com um balanço lento no plano horizontal.
    let isEmber = particle.kind == KIND_EMBER;
    let amp = select(sim_params.dust.z * DUST_SWAY_FACTOR, sim_params.emberMove.x * EMBER_SWAY_FACTOR, isEmber);
    let period = select(DUST_SWAY_PERIOD, EMBER_SWAY_PERIOD, isEmber);
    let a = sim_params.time * 2.0 * PI / period + particle.params.y;
    let sway = vec3f(sin(a), 0.0, cos(a)) * amp;
    particle.position = particle.position + dt * (particle.velocity + sway);
  }

  // Mantém a partícula na caixa ao redor da câmera (reaparece do lado oposto).
  let h = sim_params.boxHalf.xyz;
  particle.position = sim_params.cameraPos.xyz + wrap_box(particle.position - sim_params.cameraPos.xyz, h);

  // Store the new particle value
  data.particles[idx] = particle;
}
