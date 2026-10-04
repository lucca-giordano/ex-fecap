import { mat4Create, mat4LookAt } from './math.js';

/**
 * Câmera em primeira pessoa com escala e convenção baseadas no Doom:
 * - Movimento livre 3D (WASD para plano horizontal, Space para subir, Ctrl para descer)
 * - Shift duplica a velocidade (corrida)
 * - Mouse (pointer lock) com pitch limitado a +/- 89 graus
 * - Conversão consistente entre coordenadas do mundo e do Doom
 */
export class Camera {
    constructor() {
        // Altura padrão dos olhos do jogador
        this.eyeHeight = 41.0;
        this.playerHeight = 56.0;

        // Posição no espaço de mundo [X, Y, Z]
        this.position = [0.0, this.eyeHeight, 0.0];

        // Rotação: Yaw (azimute) e Pitch (elevação)
        this.yaw = 0.0;   // Em yaw = 0, câmera olha para -Z (Norte no espaço de mundo)
        this.pitch = 0.0; // Olhando no horizonte

        // Limite de pitch em radianos (~89 graus)
        this.maxPitch = (89.0 * Math.PI) / 180.0;

        // Velocidade base em unidades Doom por segundo
        this.baseSpeed = 300.0;

        // Sensibilidade do mouse
        this.mouseSensitivity = 0.0022;

        // Matriz de visão em cache
        this.viewMatrix = mat4Create();
    }

    /**
     * Define a posição inicial e o ângulo de visão da câmera a partir do spawn do Doom.
     * @param {Array<number>} worldPos [X, Y, Z] no espaço de mundo
     * @param {number} doomAngleDeg Ângulo em graus do Doom (0 = Leste, 90 = Norte)
     */
    setSpawn(worldPos, doomAngleDeg) {
        this.position = [worldPos[0], worldPos[1], worldPos[2]];
        // Conversão: Doom 90° (Norte) -> Yaw 0 rad; Doom 0° (Leste) -> Yaw PI/2 rad (+90°)
        this.yaw = ((90.0 - doomAngleDeg) * Math.PI) / 180.0;
        this.pitch = 0.0;
    }

    /**
     * Retorna a posição atual da câmera convertida para coordenadas do Doom:
     * X = Leste, Y = Norte, Z = Altura.
     * @returns {Array<number>} [x_doom, y_doom, z_doom]
     */
    getDoomPosition() {
        // Inverso de doomToWorld(x, y, z) = [x, z, -y]
        return [this.position[0], -this.position[2], this.position[1]];
    }

    /**
     * Retorna o ângulo Yaw atual convertido para graus no sistema do Doom (0° = Leste, 90° = Norte).
     * @returns {number}
     */
    getDoomYawDegrees() {
        const yawDeg = (this.yaw * 180.0) / Math.PI;
        let doomAngle = (90.0 - yawDeg) % 360.0;
        if (doomAngle < 0) doomAngle += 360.0;
        return doomAngle;
    }

    /**
     * Aplica a rotação do mouse recebida via Pointer Lock.
     * @param {number} movementX Deslocamento horizontal do cursor
     * @param {number} movementY Deslocamento vertical do cursor
     * @param {number} [sensitivity] Sensibilidade opcional (radianos por pixel)
     */
    handleMouseMove(movementX, movementY, sensitivity = this.mouseSensitivity) {
        this.yaw += movementX * sensitivity;
        this.pitch -= movementY * sensitivity;

        // Clampa o pitch para o intervalo [-89°, +89°]
        if (this.pitch > this.maxPitch) this.pitch = this.maxPitch;
        if (this.pitch < -this.maxPitch) this.pitch = -this.maxPitch;
    }

    /**
     * Atualiza a posição da câmera com base nas teclas de controle.
     * Vôo livre: WASD no plano horizontal, Space para subir (+Y) e KeyC para descer (-Y).
     * @param {number} dt Tempo decorrido em segundos
     * @param {Object|Set<string>} keys Estado das teclas
     * @param {number} [speed] Velocidade de deslocamento (unidades/s)
     */
    update(dt, keys, speed = this.baseSpeed) {
        const isKeyPressed = (code) => {
            if (!keys) return false;
            return (typeof keys.has === 'function') ? keys.has(code) : Boolean(keys[code]);
        };

        const currentSpeed = speed;

        // Vetores direcionais no plano horizontal XZ
        const forwardX = Math.sin(this.yaw);
        const forwardZ = -Math.cos(this.yaw);

        const rightX = Math.cos(this.yaw);
        const rightZ = Math.sin(this.yaw);

        let moveX = 0.0;
        let moveZ = 0.0;

        if (isKeyPressed('KeyW')) {
            moveX += forwardX;
            moveZ += forwardZ;
        }
        if (isKeyPressed('KeyS')) {
            moveX -= forwardX;
            moveZ -= forwardZ;
        }
        if (isKeyPressed('KeyD')) {
            moveX += rightX;
            moveZ += rightZ;
        }
        if (isKeyPressed('KeyA')) {
            moveX -= rightX;
            moveZ -= rightZ;
        }

        // Movimento horizontal normalizado
        const len = Math.hypot(moveX, moveZ);
        if (len > 0.0001) {
            const step = (currentSpeed * dt) / len;
            this.position[0] += moveX * step;
            this.position[2] += moveZ * step;
        }

        // Movimento vertical livre: Space sobe (+Y), KeyC desce (-Y)
        if (isKeyPressed('Space')) {
            this.position[1] += currentSpeed * dt;
        }
        if (isKeyPressed('KeyC')) {
            this.position[1] -= currentSpeed * dt;
        }
    }

    /**
     * Calcula e retorna a matriz de visualização LookAt da câmera.
     */
    getViewMatrix() {
        const cosPitch = Math.cos(this.pitch);
        const sinPitch = Math.sin(this.pitch);
        const sinYaw = Math.sin(this.yaw);
        const cosYaw = Math.cos(this.yaw);

        const dirX = sinYaw * cosPitch;
        const dirY = sinPitch;
        const dirZ = -cosYaw * cosPitch;

        const target = [
            this.position[0] + dirX,
            this.position[1] + dirY,
            this.position[2] + dirZ,
        ];

        const up = [0.0, 1.0, 0.0];
        mat4LookAt(this.viewMatrix, this.position, target, up);
        return this.viewMatrix;
    }
}
