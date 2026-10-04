////////////////////////////////////////////////////////////////////////////////
// Efeito Externo nº 2: Simulação e Renderização de Partículas (Poeira e Brasas)
//
// Baseado no exemplo "Particles" do repositório WebGPU Samples:
// Fonte: https://github.com/webgpu/webgpu-samples/tree/main/sample/particles
// Autores: WebGPU Samples Contributors
// Licença: BSD-3-Clause
//
// Esta versão é uma adaptação para o projeto Doom WebGPU puro:
// - Volume 3D centrado na câmera com envolvimento toroidal.
// - Struct Particle adaptada para 48 bytes (sem cor nos dados brutos).
// - Quads alinhados à tela (screen-aligned quad) com pixelSnap e tamanho em pixels.
// - Integração com a paleta PLAYPAL/COLORMAP do Freedoom (litPalette 256x32).
// - Compatível com teste e escrita no depth buffer da cena 3D.
////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////
// Gerador Pseudoaleatório (mantido do exemplo original)
////////////////////////////////////////////////////////////////////////////////
var<private> rnd : vec4<u32>;

fn init_rand(invocation_id : u32, seed : vec4<u32>) {
    const A = vec4<u32>(
        1741651u * 1009u,
        140893u  * 1609u * 13u,
        6521u    * 983u  * 7u  * 2u,
        1109u    * 509u  * 83u * 11u * 3u
    );
    rnd = (A * vec4<u32>(invocation_id)) ^ seed;
}

fn rand() -> f32 {
    const C = vec4<u32>(
        60493u  * 9377u,
        11279u  * 2539u * 23u,
        7919u   * 631u  * 5u  * 3u,
        1277u   * 211u  * 19u * 7u * 2u
    );

    rnd = (rnd * C) ^ (rnd.yzwx >> vec4<u32>(4u));
    return f32(rnd.x ^ rnd.y) / f32(0xffffffffu);
}

////////////////////////////////////////////////////////////////////////////////
// Passada de Computação (Simulação) - 112 bytes UBO
////////////////////////////////////////////////////////////////////////////////
struct SimulationParams {
    cameraPos : vec4<f32>,       // offset 0, 16 bytes
    seed : vec4<u32>,            // offset 16, 16 bytes
    timeParams : vec4<f32>,      // offset 32, 16 bytes (deltaTime, time, boxHalfXZ, boxHalfY)
    spawnParams1 : vec4<f32>,    // offset 48, 16 bytes (activeCount, emberRatio, dustSpeed, dustSize)
    dustLife : vec4<f32>,        // offset 64, 16 bytes (dustLifeMin, dustLifeMax, pad0, pad1)
    emberMotion : vec4<f32>,     // offset 80, 16 bytes (emberRiseMin, emberRiseMax, emberDrift, emberSize)
    emberLife : vec4<f32>,       // offset 96, 16 bytes (emberLifeMin, emberLifeMax, pad2, pad3)
};

struct Particle {
    position : vec3<f32>,        // offset 0, 12 bytes
    life : f32,                  // offset 12, 4 bytes
    velocity : vec3<f32>,        // offset 16, 12 bytes (align 16)
    kind : f32,                  // offset 28, 4 bytes (0 = poeira, 1 = brasa)
    params : vec4<f32>,          // offset 32, 16 bytes (x=lifeTotal, y=phase, z=worldSize, w=unused)
};

struct Particles {
    particles : array<Particle>,
};

@binding(0) @group(0) var<uniform> sim_params : SimulationParams;
@binding(1) @group(0) var<storage, read_write> data : Particles;

@compute @workgroup_size(64)
fn simulate(@builtin(global_invocation_id) global_invocation_id : vec3<u32>) {
    let idx = global_invocation_id.x;
    let activeCount = u32(sim_params.spawnParams1.x);
    if (idx >= activeCount) {
        return;
    }

    init_rand(idx, sim_params.seed);
    var particle = data.particles[idx];

    let dt = sim_params.timeParams.x;
    let time = sim_params.timeParams.y;
    let boxHalfXZ = sim_params.timeParams.z;
    let boxHalfY = sim_params.timeParams.w;

    let emberRatio = sim_params.spawnParams1.y;
    let dustSpeed = sim_params.spawnParams1.z;
    let dustSize = sim_params.spawnParams1.w;

    let dustLifeMin = sim_params.dustLife.x;
    let dustLifeMax = sim_params.dustLife.y;

    let emberRiseMin = sim_params.emberMotion.x;
    let emberRiseMax = sim_params.emberMotion.y;
    let emberDrift = sim_params.emberMotion.z;
    let emberSize = sim_params.emberMotion.w;

    let emberLifeMin = sim_params.emberLife.x;
    let emberLifeMax = sim_params.emberLife.y;

    // Envelhecimento da partícula
    particle.life = particle.life - dt;

    // Se morreu, renasce com os parâmetros dinâmicos atuais
    if (particle.life <= 0.0) {
        let isEmber = rand() < emberRatio;
        let kind = select(0.0, 1.0, isEmber);
        particle.kind = kind;

        let rx = (rand() * 2.0 - 1.0) * boxHalfXZ;
        let ry = (rand() * 2.0 - 1.0) * boxHalfY;
        let rz = (rand() * 2.0 - 1.0) * boxHalfXZ;
        particle.position = sim_params.cameraPos.xyz + vec3<f32>(rx, ry, rz);

        let phase = rand() * 6.2831853;

        if (isEmber) {
            let lifeRange = max(0.001, emberLifeMax - emberLifeMin);
            let lifeTotal = emberLifeMin + rand() * lifeRange;
            particle.life = lifeTotal;
            let riseRange = max(0.0, emberRiseMax - emberRiseMin);
            let vy = emberRiseMin + rand() * riseRange;
            let vx = (rand() * 2.0 - 1.0) * emberDrift;
            let vz = (rand() * 2.0 - 1.0) * emberDrift;
            particle.velocity = vec3<f32>(vx, vy, vz);
            particle.params = vec4<f32>(lifeTotal, phase, emberSize, 0.0);
        } else {
            let lifeRange = max(0.001, dustLifeMax - dustLifeMin);
            let lifeTotal = dustLifeMin + rand() * lifeRange;
            particle.life = lifeTotal;
            let vx = (rand() * 2.0 - 1.0) * dustSpeed;
            let vy = (rand() * 2.0 - 1.0) * (dustSpeed * 0.5);
            let vz = (rand() * 2.0 - 1.0) * dustSpeed;
            particle.velocity = vec3<f32>(vx, vy, vz);
            particle.params = vec4<f32>(lifeTotal, phase, dustSize, 0.0);
        }
    } else {
        // Balanço suave com base no tempo e fase
        var vel = particle.velocity;
        if (particle.kind > 0.5) {
            let sway = sin(time * 3.0 + particle.params.y) * 4.0;
            vel.x = vel.x + sway;
            vel.z = vel.z + cos(time * 2.5 + particle.params.y) * 4.0;
        } else {
            let sway = sin(time * 1.5 + particle.params.y) * 2.0;
            vel.x = vel.x + sway;
            vel.z = vel.z + cos(time * 1.2 + particle.params.y) * 2.0;
        }

        particle.position = particle.position + vel * dt;

        // Envolvimento toroidal relativo à câmera
        let h = vec3<f32>(boxHalfXZ, boxHalfY, boxHalfXZ);
        let twoH = 2.0 * h;
        let d = particle.position - sim_params.cameraPos.xyz;
        let wrappedD = ((d + h) - twoH * floor((d + h) / twoH)) - h;
        particle.position = sim_params.cameraPos.xyz + wrappedD;
    }

    data.particles[idx] = particle;
}

////////////////////////////////////////////////////////////////////////////////
// Passada Gráfica (Vértice e Fragmento) - 144 bytes UBO
////////////////////////////////////////////////////////////////////////////////
struct DrawParams {
    viewProj : mat4x4<f32>,        // offset 0, 64 bytes
    cameraPos : vec4<f32>,         // offset 64, 16 bytes
    screenParams : vec4<f32>,      // offset 80, 16 bytes (internalWidth, internalHeight, tanHalfFov, time)
    renderParams : vec4<f32>,      // offset 96, 16 bytes (sizeScale, minPixels, maxPixels, fadeFraction)
    paletteIndices : vec4<u32>,    // offset 112, 16 bytes (dustIdx, warmEmberIdx, coldEmberIdx, lightingEnabled)
    configFlags : vec4<f32>,       // offset 128, 16 bytes (pixelSnap, flickerHz, dustLightnum, disableFade)
};

@binding(0) @group(0) var<uniform> draw_params : DrawParams;
@binding(1) @group(0) var litPalette : texture_2d<f32>;

struct VertexInput {
    @location(0) position : vec3<f32>,
    @location(1) life : f32,
    @location(2) velocity : vec3<f32>,
    @location(3) kind : f32,
    @location(4) params : vec4<f32>,
    @location(5) quad_pos : vec2<f32>, // -1..+1
};

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
    @location(0) @interpolate(flat) kind : f32,
    @location(1) @interpolate(flat) phase : f32,
    @location(2) viewDepth : f32,
};

@vertex
fn vs_main(in : VertexInput) -> VertexOutput {
    var out : VertexOutput;

    let clipCenter = draw_params.viewProj * vec4<f32>(in.position, 1.0);
    let w = clipCenter.w;

    let W = draw_params.screenParams.x;
    let H = draw_params.screenParams.y;
    let tanHalfFov = draw_params.screenParams.z;

    let worldSize = in.params.z;
    let sizeScale = draw_params.renderParams.x;
    let minPixels = draw_params.renderParams.y;
    let maxPixels = draw_params.renderParams.z;
    let fadeFraction = draw_params.renderParams.w;
    let disableFade = draw_params.configFlags.w > 0.5;

    // 1. Unidades de mundo por pixel
    let upp = (max(w, 0.001) * 2.0 * tanHalfFov) / H;

    // 2. Tamanho base em pixels
    let basePx = (worldSize * sizeScale) / upp;

    // 3. Limite entre minPixels e maxPixels
    var sizePx = clamp(round(basePx), minPixels, maxPixels);

    // 4. Fade nas pontas da vida útil
    let lifeTotal = in.params.x;
    let age = lifeTotal - in.life;
    var fade = 1.0;
    if (!disableFade && fadeFraction > 0.0) {
        fade = clamp(min(age, in.life) / (fadeFraction * lifeTotal), 0.0, 1.0);
    }
    sizePx = round(sizePx * fade);

    // Centro em coordenadas de pixel interno
    let ndcX = clipCenter.x / max(w, 0.0001);
    let ndcY = clipCenter.y / max(w, 0.0001);
    let px = (ndcX * 0.5 + 0.5) * W;
    let py = (0.5 - ndcY * 0.5) * H;

    // 6. Descarte se atrás do plano near (1.0), menor que 1 pixel ou longe da tela
    if (w < 1.0 || sizePx < 1.0 || px < -sizePx || px > (W + sizePx) || py < -sizePx || py > (H + sizePx)) {
        out.position = vec4<f32>(0.0, 0.0, 2.0, 1.0); // Colapso / fora do depth frustum
        out.kind = in.kind;
        out.phase = in.params.y;
        out.viewDepth = w;
        return out;
    }

    // 5. Ajuste de pixelSnap
    var c = vec2<f32>(px, py);
    let pixelSnap = draw_params.configFlags.x > 0.5;
    if (pixelSnap) {
        let isOdd = (i32(sizePx) % 2) != 0;
        if (isOdd) {
            c = floor(c) + vec2<f32>(0.5, 0.5);
        } else {
            c = round(c);
        }
    }

    // Cantos do quad billboard em espaço de tela
    let cornerPx = c + in.quad_pos * (sizePx * 0.5);

    // Conversão de volta para NDC
    let cornerNdcX = (cornerPx.x / W) * 2.0 - 1.0;
    let cornerNdcY = 1.0 - (cornerPx.y / H) * 2.0;

    out.position = vec4<f32>(cornerNdcX * w, cornerNdcY * w, clipCenter.z, w);
    out.kind = in.kind;
    out.phase = in.params.y;
    out.viewDepth = w;

    return out;
}

@fragment
fn fs_main(in : VertexOutput) -> @location(0) vec4<f32> {
    let isEmber = in.kind > 0.5;
    let time = draw_params.screenParams.w;
    let lightingEnabled = draw_params.paletteIndices.w == 1u;
    let flickerHz = draw_params.configFlags.y;
    let dustLightnum = u32(draw_params.configFlags.z);

    var palIndex = 0u;
    var level = 0i;

    if (isEmber) {
        level = 0i;
        let stepTime = floor(time * flickerHz);
        let flicker = fract(sin(stepTime * 127.1 + in.phase * 311.7) * 43758.5453);
        palIndex = select(draw_params.paletteIndices.y, draw_params.paletteIndices.z, flicker < 0.5);
    } else {
        palIndex = draw_params.paletteIndices.x;

        if (lightingEnabled) {
            let z = max(in.viewDepth, 1.0);
            let startmap = (15i - i32(dustLightnum)) * 4i;
            let j = min(127i, i32(floor(z / 16.0)));
            let scale = i32(floor(160.0 / f32(j + 1i)));
            level = clamp(startmap - scale / 2i, 0i, 31i);
        } else {
            level = 0i;
        }
    }

    let texelColor = textureLoad(litPalette, vec2<i32>(i32(palIndex), level), 0);
    return vec4<f32>(texelColor.rgb, 1.0);
}
