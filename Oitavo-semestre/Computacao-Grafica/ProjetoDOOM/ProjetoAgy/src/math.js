/**
 * Utilitários matemáticos para computação gráfica 3D e WebGPU.
 * Trabalha com matrizes 4x4 em formato column-major (padrão de shaders WGSL)
 * e vetores 3D usando Float32Array.
 */

export function mat4Create() {
    const out = new Float32Array(16);
    out[0] = 1;
    out[5] = 1;
    out[10] = 1;
    out[15] = 1;
    return out;
}

/**
 * Matriz de projeção perspectiva ajustada para o espaço de clip do WebGPU (Z entre [0, 1]).
 * @param {Float32Array} out Matriz de saída 4x4
 * @param {number} fovYRad Campo de visão vertical em radianos
 * @param {number} aspect Razão de aspecto (largura / altura)
 * @param {number} near Plano próximo
 * @param {number} far Plano distante
 */
export function mat4Perspective(out, fovYRad, aspect, near, far) {
    const f = 1.0 / Math.tan(fovYRad / 2.0);
    const rangeInv = 1.0 / (near - far);

    out[0] = f / aspect;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;

    out[4] = 0;
    out[5] = f;
    out[6] = 0;
    out[7] = 0;

    out[8] = 0;
    out[9] = 0;
    out[10] = far * rangeInv;
    out[11] = -1;

    out[12] = 0;
    out[13] = 0;
    out[14] = near * far * rangeInv;
    out[15] = 0;

    return out;
}

/**
 * Matriz de visualização LookAt (câmera).
 * @param {Float32Array} out Matriz de saída 4x4
 * @param {Array<number>} eye Posição do observador
 * @param {Array<number>} target Ponto para onde o observador olha
 * @param {Array<number>} up Vetor apontando para cima no espaço de mundo
 */
export function mat4LookAt(out, eye, target, up) {
    // Vetor para trás (forward invertido): z = normalize(eye - target)
    let z0 = eye[0] - target[0];
    let z1 = eye[1] - target[1];
    let z2 = eye[2] - target[2];
    let len = Math.hypot(z0, z1, z2);
    if (len === 0) {
        z2 = 1;
    } else {
        z0 /= len;
        z1 /= len;
        z2 /= len;
    }

    // Vetor direita: x = normalize(up x z)
    let x0 = up[1] * z2 - up[2] * z1;
    let x1 = up[2] * z0 - up[0] * z2;
    let x2 = up[0] * z1 - up[1] * z0;
    len = Math.hypot(x0, x1, x2);
    if (len === 0) {
        x0 = 1;
    } else {
        x0 /= len;
        x1 /= len;
        x2 /= len;
    }

    // Vetor cima real: y = z x x
    const y0 = z1 * x2 - z2 * x1;
    const y1 = z2 * x0 - z0 * x2;
    const y2 = z0 * x1 - z1 * x0;

    // Matriz column-major
    out[0] = x0;
    out[1] = y0;
    out[2] = z0;
    out[3] = 0;

    out[4] = x1;
    out[5] = y1;
    out[6] = z1;
    out[7] = 0;

    out[8] = x2;
    out[9] = y2;
    out[10] = z2;
    out[11] = 0;

    out[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
    out[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
    out[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
    out[15] = 1;

    return out;
}

/**
 * Multiplicação de duas matrizes 4x4 (out = a * b) no padrão column-major.
 */
export function mat4Multiply(out, a, b) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
    out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
    out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
    out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
    out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    return out;
}
