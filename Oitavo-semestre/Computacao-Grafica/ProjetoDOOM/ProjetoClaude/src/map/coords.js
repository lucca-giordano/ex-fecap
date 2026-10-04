// ÚNICO lugar com a conversão entre coordenadas do Doom e do renderizador.
//
// Doom:  x = leste, y = norte, z = altura.
// Mundo: Y para cima, destro (right-handed); a câmera (camera.js) com yaw 0 olha para -Z
//        e yaw positivo gira para a direita (rumo a +X).
//
// Conversão: (x, y, z) do Doom -> (x, z, -y) no mundo. Escala 1:1.
// Norte (+y) vira -Z e leste (+x) vira +X. Olhando para -Z, +X fica à direita, assim como
// o leste fica à direita de quem olha para o norte, então o mapa não sai espelhado.

export function doomToWorld(x, y, z) {
  return [x, z, -y];
}

export function worldToDoom(wx, wy, wz) {
  return [wx, -wz, wy];
}

// Ângulo do Doom (graus, 0 = leste, 90 = norte, anti-horário) -> yaw da câmera (radianos).
// Direção do Doom (cos a, sin a) vira (cos a, -sin a) em (X, Z). A frente da câmera é
// (sin yaw, -cos yaw), portanto yaw = 90° - a.
export function doomAngleToYaw(angleDeg) {
  return (90 - angleDeg) * Math.PI / 180;
}

// Inverso, normalizado para [0, 360).
export function yawToDoomAngle(yaw) {
  const a = 90 - yaw * 180 / Math.PI;
  return ((a % 360) + 360) % 360;
}
