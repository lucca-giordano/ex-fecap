/**
 * Definição da geometria de uma sala simples em unidades do Doom.
 * 
 * Dimensões:
 * - Largura (X): de -256 a +256 (512 unidades)
 * - Profundidade (Z): de -256 a +256 (512 unidades)
 * - Altura (Y): chão em 0, teto em 128 unidades (altura clássica do Doom)
 * 
 * 6 superfícies distintas, cada uma com uma cor temática:
 * 1. Chão (Y = 0)        - Cinza ardósia / concreto
 * 2. Teto (Y = 128)      - Azul escuro industrial
 * 3. Parede Norte (-Z)   - Vermelho Doom
 * 4. Parede Sul (+Z)     - Azul petróleo
 * 5. Parede Leste (+X)   - Verde militar
 * 6. Parede Oeste (-X)   - Amarelo mostarda
 * 
 * A orientação dos vértices é anti-horária (CCW) olhando de dentro da sala,
 * permitindo o uso seguro de back-face culling (cullMode: 'back').
 */

export function createRoomGeometry() {
    // 7 floats por vértice: [pos.x, pos.y, pos.z, cor.r, cor.g, cor.b, cor.a]
    const vertices = [];
    const indices = [];

    const faces = [
        // 1. Chão (normal apontando para cima +Y)
        {
            color: [0.35, 0.32, 0.28, 1.0], // Cinza / Concreto
            corners: [
                [-256, 0,  256],
                [ 256, 0,  256],
                [ 256, 0, -256],
                [-256, 0, -256],
            ]
        },
        // 2. Teto (normal apontando para baixo -Y)
        {
            color: [0.18, 0.24, 0.38, 1.0], // Azul escuro
            corners: [
                [-256, 128, -256],
                [ 256, 128, -256],
                [ 256, 128,  256],
                [-256, 128,  256],
            ]
        },
        // 3. Parede Norte (fundo em -Z, normal apontando para +Z)
        {
            color: [0.78, 0.18, 0.18, 1.0], // Vermelho
            corners: [
                [-256,   0, -256],
                [ 256,   0, -256],
                [ 256, 128, -256],
                [-256, 128, -256],
            ]
        },
        // 4. Parede Sul (atrás em +Z, normal apontando para -Z)
        {
            color: [0.20, 0.45, 0.80, 1.0], // Azul
            corners: [
                [ 256,   0,  256],
                [-256,   0,  256],
                [-256, 128,  256],
                [ 256, 128,  256],
            ]
        },
        // 5. Parede Leste (direita em +X, normal apontando para -X)
        {
            color: [0.20, 0.70, 0.30, 1.0], // Verde
            corners: [
                [ 256,   0, -256],
                [ 256,   0,  256],
                [ 256, 128,  256],
                [ 256, 128, -256],
            ]
        },
        // 6. Parede Oeste (esquerda em -X, normal apontando para +X)
        {
            color: [0.85, 0.72, 0.18, 1.0], // Amarelo
            corners: [
                [-256,   0,  256],
                [-256,   0, -256],
                [-256, 128, -256],
                [-256, 128,  256],
            ]
        },
    ];

    let vertexOffset = 0;

    for (const face of faces) {
        // Insere os 4 vértices do quad
        for (let i = 0; i < 4; i++) {
            const [x, y, z] = face.corners[i];
            const [r, g, b, a] = face.color;
            vertices.push(x, y, z, r, g, b, a);
        }

        // Insere 2 triângulos (6 índices) por quad
        indices.push(
            vertexOffset + 0,
            vertexOffset + 1,
            vertexOffset + 2,
            vertexOffset + 0,
            vertexOffset + 2,
            vertexOffset + 3
        );

        vertexOffset += 4;
    }

    return {
        vertexData: new Float32Array(vertices),
        indexData: new Uint16Array(indices),
        indexCount: indices.length,
    };
}
