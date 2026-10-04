// Câmera em primeira pessoa, voo livre por enquanto. A entrada (teclado e mouse) fica em
// input/Controls.js; aqui só posição e ângulos.
// Mundo: Y para cima. A conversão do Doom fica em map/coords.js.

import { lookAt } from './mat4.js';

export const PLAYER_HEIGHT = 56; // altura do jogador no Doom (usada depois na colisão)
export const VIEW_HEIGHT = 41;   // olhos a 41 unidades do chão

// FOV vertical do Doom: 2 * atan(0.75) ~ 73.74°, que equivale a 90° horizontais em 4:3.
export const FOVY = 2 * Math.atan(0.75);

const MAX_PITCH = 89 * Math.PI / 180;
export const BASE_MOUSE_SENS = 0.0025; // radianos por pixel (nível 5 de sensibilidade)
export const BASE_FLY_SPEED = 300;     // unidades/s, perto da velocidade de andar do Doom (~8.3 unid/tic * 35 tics/s)
export const RUN_MULT = 2;             // correndo o Doom chega a ~2x isso

// Nível 1..10 -> multiplicador base * 1.25^(nível - 5). No nível 5 o valor é a base.
export const levelScale = (level) => Math.pow(1.25, level - 5);

export class Camera {
  constructor(pos, yaw = 0) {
    this.pos = [...pos]; // coordenadas do mundo (olhos)
    this.yaw = yaw; // 0 = olhando para -Z; positivo gira para a direita
    this.pitch = 0; // positivo = olhando para cima
  }

  // dx, dy em pixels do mouse; sens em radianos por pixel.
  look(dx, dy, sens) {
    this.yaw += dx * sens;
    this.pitch -= dy * sens;
    this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch));
  }

  // move: { f, s, u } de Controls.moveVector(); speed em unidades/s; dt em segundos.
  move({ f, s, u }, speed, dt) {
    if (f === 0 && s === 0 && u === 0) return;
    const d = speed * dt;
    // WASD move no plano horizontal, como no Doom (o pitch não afeta); subir/descer no eixo Y.
    const sinY = Math.sin(this.yaw), cosY = Math.cos(this.yaw);
    // frente = (sin, 0, -cos), direita = (cos, 0, sin)
    this.pos[0] += (f * sinY + s * cosY) * d;
    this.pos[1] += u * d;
    this.pos[2] += (-f * cosY + s * sinY) * d;
  }

  viewMatrix() {
    const cp = Math.cos(this.pitch);
    const dir = [
      Math.sin(this.yaw) * cp,
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * cp,
    ];
    const target = [this.pos[0] + dir[0], this.pos[1] + dir[1], this.pos[2] + dir[2]];
    return lookAt(this.pos, target, [0, 1, 0]);
  }
}
