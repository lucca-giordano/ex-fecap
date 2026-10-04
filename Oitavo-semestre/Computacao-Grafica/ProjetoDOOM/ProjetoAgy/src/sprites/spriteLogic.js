/**
 * Lógica pura de posicionamento, seleção de vistas, quadros de animação
 * e empacotamento de instâncias de sprites para a GPU.
 * Totalmente desacoplada da WebGPU e do DOM.
 */

/**
 * Operação de módulo euclidiano que lida corretamente com números negativos.
 * @param {number} n 
 * @param {number} m 
 * @returns {number}
 */
export function mod(n, m) {
    return ((n % m) + m) % m;
}

/**
 * Calcula o ângulo visual do jogador até o objeto nas coordenadas do Doom (graus).
 * @param {number} camX X da câmera nas coordenadas do Doom (igual a worldX)
 * @param {number} camY Y da câmera nas coordenadas do Doom (igual a -worldZ)
 * @param {number} thingX X do objeto nas coordenadas do Doom
 * @param {number} thingY Y do objeto nas coordenadas do Doom
 * @returns {number} Ângulo em graus no intervalo [0, 360)
 */
export function computeViewAngle(camX, camY, thingX, thingY) {
    const rad = Math.atan2(thingY - camY, thingX - camX);
    let deg = (rad * 180.0) / Math.PI;
    return mod(deg, 360.0);
}

/**
 * Escolhe o número da vista (1 a 8) com base no ângulo da linha de visão e orientação do objeto.
 * Se o objeto não possui rotação (vista única), retorna 0.
 * 
 * Regra:
 * rot = floor(((a - thingAngle) mod 360 + 202.5) / 45) mod 8
 * vista = rot + 1
 * 
 * Âncoras de teste:
 * - thingAngle = 0 (Leste), a = 180 (olhando do Leste para o objeto) -> vista 1 (frente)
 * - thingAngle = 0 (Leste), a = 0 (olhando do Oeste para o objeto) -> vista 5 (costas)
 * - thingAngle = 90 (Norte), a = 270 (olhando do Norte) -> vista 1 (frente)
 * - thingAngle = 270, a = 45 -> vista 8
 * 
 * @param {number} a Ângulo da linha de visão (graus)
 * @param {number} thingAngle Ângulo do objeto (graus)
 * @param {boolean} [hasRotations=true] Se falso, retorna 0 (vista única)
 * @returns {number} 0 (única) ou 1 a 8
 */
export function selectViewNumber(a, thingAngle, hasRotations = true) {
    if (!hasRotations) return 0;
    const diff = mod(a - thingAngle, 360.0);
    const rot = mod(Math.floor((diff + 202.5) / 45.0), 8);
    return rot + 1;
}

/**
 * Gera um deslocamento determinístico de fase de animação para cada objeto com base em seu índice.
 * Evita que todos os objetos (tochas, barris, bônus) pisquem em perfeita sincronia.
 * @param {number} thingIndex 
 * @returns {number}
 */
export function getThingOffset(thingIndex) {
    let h = (thingIndex * 2654435761) >>> 0;
    h = ((h ^ (h >>> 16)) * 2246822519) >>> 0;
    return h % 1000;
}

/**
 * Determina o quadro da animação atual em função dos tics do jogo e do desfasamento.
 * @param {string} validFrames Sequência de letras válidas (ex: "ABCDCB")
 * @param {number} tics Relógio de jogo em tics do Doom (35 tics/s)
 * @param {number} ticsPerFrame Duração de cada quadro em tics
 * @param {number} [phaseOffset=0] Deslocamento em tics específico do objeto
 * @returns {string} Letra do quadro atual
 */
export function selectAnimationFrame(validFrames, tics, ticsPerFrame, phaseOffset = 0) {
    if (!validFrames || validFrames.length <= 1) {
        return validFrames ? validFrames[0] : 'A';
    }
    const idx = Math.floor((tics + phaseOffset) / Math.max(1, ticsPerFrame)) % validFrames.length;
    return validFrames[idx];
}

/**
 * Empacota a lista de instâncias de sprites em um ArrayBuffer com layout de 32 bytes por instância:
 * - offset  0: position (vec3<f32>, 12 bytes: worldX, worldY, worldZ)
 * - offset 12: layer (u32, 4 bytes)
 * - offset 16: lightnum (u32, 4 bytes)
 * - offset 20: flags (u32, 4 bytes: bit 0 = espelhado, bit 1 = fullbright, bit 2 = fuzz)
 * - offset 24: pad0 (u32, 4 bytes)
 * - offset 28: pad1 (u32, 4 bytes)
 * 
 * @param {Array<Object>} instanceList 
 * @returns {ArrayBuffer}
 */
export function packSpriteInstances(instanceList) {
    const count = instanceList.length;
    const buffer = new ArrayBuffer(count * 32);
    const f32 = new Float32Array(buffer);
    const u32 = new Uint32Array(buffer);

    for (let i = 0; i < count; i++) {
        const inst = instanceList[i];
        const base = i * 8; // 8 elementos de 32 bits = 32 bytes

        // position (vec3<f32>)
        f32[base + 0] = inst.worldPos[0];
        f32[base + 1] = inst.worldPos[1];
        f32[base + 2] = inst.worldPos[2];

        // layer (u32)
        u32[base + 3] = inst.layer;

        // lightnum (u32)
        u32[base + 4] = inst.lightnum;

        // flags (u32): bit 0 = mirrored, bit 1 = fullbright, bit 2 = fuzz
        let flags = 0;
        if (inst.mirrored) flags |= 0x1;
        if (inst.fullbright) flags |= 0x2;
        if (inst.fuzz) flags |= 0x4;
        u32[base + 5] = flags;

        // padding de alinhamento WGSL
        u32[base + 6] = 0;
        u32[base + 7] = 0;
    }

    return buffer;
}
