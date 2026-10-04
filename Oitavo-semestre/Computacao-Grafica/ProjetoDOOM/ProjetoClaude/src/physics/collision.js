// Física do modo "andar": colisão com as linhas e gravidade. Puro: sem DOM e sem WebGPU.
// Tudo em coordenadas do Doom (x leste, y norte, z para cima); a câmera converte na fronteira.

import { findSector, findSubsector } from '../map/bsp.js';
import { pushOutSolids } from './solids.js';

export const PLAYER_RADIUS = 16;   // raio do jogador (mobjinfo do Doom: 16 unidades)
export const PLAYER_HEIGHT = 56;   // altura do jogador (Doom: 56 unidades)
export const EYE_HEIGHT = 41;      // olhos acima dos pés (Doom: VIEWHEIGHT = 41)
export const STEP_HEIGHT = 24;     // maior degrau que se sobe andando (Doom: 24 unidades)
export const GRAVITY = 1225;       // u/s²: no Doom, 1 unidade por tic² com 35 tics/s -> 35² = 1225
export const MAX_SUBSTEP = 8;      // deslocamento máximo por subpasso; menor que o raio, o centro não atravessa paredes
export const MAX_PHYSICS_DT = 0.1; // maior dt aceito por quadro (s)
const MAX_GRAVITY_DT = 1 / 70;     // subpasso de tempo máximo, para a queda ter precisão em quadros longos
const PUSH_ROUNDS = 4;             // rodadas de empurrão por subpasso
const PUSH_EPSILON = 0.01;         // folga extra ao empurrar para fora da parede
const ML_BLOCKING = 0x0001;

// Ponto do segmento mais próximo de (px, py) e a distância até ele.
export function closestPointOnSegment(px, py, line) {
  const dx = line.x2 - line.x1, dy = line.y2 - line.y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - line.x1) * dx + (py - line.y1) * dy) / len2 : 0;
  t = Math.min(1, Math.max(0, t));
  const x = line.x1 + dx * t, y = line.y1 + dy * t;
  return { x, y, t, d: Math.hypot(px - x, py - y) };
}

// Regra de bloqueio de uma linha para um jogador com os pés em feetZ.
export function lineBlocks(line, sectors, feetZ) {
  if (line.oneSided) return true;                   // 1. um lado só
  if (line.flags & ML_BLOCKING) return true;        // 2. impassable
  const f = sectors[line.front], b = sectors[line.back];
  const openTop = Math.min(f.ceilingHeight, b.ceilingHeight);
  const openBottom = Math.max(f.floorHeight, b.floorHeight);
  if (openTop - openBottom < PLAYER_HEIGHT) return true; // abertura baixa demais (inclui porta fechada)
  if (openTop - feetZ < PLAYER_HEIGHT) return true;      // teto baixo demais acima dos pés
  if (openBottom - feetZ > STEP_HEIGHT) return true;     // degrau alto demais (descer é sempre permitido)
  return false;
}

// Empurra o centro (state.x, state.y) para fora das linhas que bloqueiam no feetZ atual.
// prevX/prevY: posição antes do subpasso (decide o lado quando o centro cai exatamente na linha).
// Devolve true se, no fim, ainda há sobreposição com alguma linha bloqueante.
export function pushOut(state, world, prevX, prevY) {
  const { lines, sectors } = world;
  for (let round = 0; round < PUSH_ROUNDS; round++) {
    let moved = false;
    for (const line of lines) {
      if (state.x < line.minX - PLAYER_RADIUS || state.x > line.maxX + PLAYER_RADIUS ||
          state.y < line.minY - PLAYER_RADIUS || state.y > line.maxY + PLAYER_RADIUS) continue;
      if (!lineBlocks(line, sectors, state.z)) continue;
      const p = closestPointOnSegment(state.x, state.y, line);
      if (p.d >= PLAYER_RADIUS) continue;
      let nx, ny;
      if (p.d > 1e-9) {
        // Afasta ao longo de (centro - ponto): só o componente perpendicular é anulado, então desliza.
        nx = (state.x - p.x) / p.d;
        ny = (state.y - p.y) / p.d;
      } else {
        // Exatamente sobre o segmento: normal da linha, do lado em que estava no subpasso anterior.
        const dx = line.x2 - line.x1, dy = line.y2 - line.y1, len = Math.hypot(dx, dy) || 1;
        const side = dx * (prevY - line.y1) - dy * (prevX - line.x1); // > 0: à esquerda de v1 -> v2
        const s = side >= 0 ? 1 : -1;
        nx = (-dy / len) * s;
        ny = (dx / len) * s;
      }
      const push = PLAYER_RADIUS - p.d + PUSH_EPSILON;
      state.x += nx * push;
      state.y += ny * push;
      moved = true;
    }
    if (!moved) return false;
  }
  return overlapsBlocking(state, world);
}

// Há alguma linha bloqueante a menos de PLAYER_RADIUS do centro?
export function overlapsBlocking(state, world) {
  for (const line of world.lines) {
    if (state.x < line.minX - PLAYER_RADIUS || state.x > line.maxX + PLAYER_RADIUS ||
        state.y < line.minY - PLAYER_RADIUS || state.y > line.maxY + PLAYER_RADIUS) continue;
    if (lineBlocks(line, world.sectors, state.z) && closestPointOnSegment(state.x, state.y, line).d < PLAYER_RADIUS) return true;
  }
  return false;
}

// Atualiza floorz e ceilingz com o setor sob o centro. Devolve false se o ponto não tem setor.
export function updateSector(state, world) {
  const sector = world.sectors[findSector(world.map, state.x, state.y)];
  if (!sector) return false;
  state.floorz = sector.floorHeight;
  state.ceilingz = sector.ceilingHeight;
  return true;
}

// O ponto está dentro da área jogável? A BSP sempre devolve um subsector, mesmo para pontos fora das
// paredes externas; dentro do mapa, o ponto fica à direita (lado interno) de todos os segs do seu
// subsector. Tolerância de 1 unidade: vértices de divisão do BSP são arredondados no WAD.
const INSIDE_TOLERANCE = 1;
export function isInsideMap(map, x, y) {
  const ss = map.ssectors[findSubsector(map, x, y)];
  for (let k = 0; k < ss.segCount; k++) {
    const seg = map.segs[ss.firstSeg + k];
    const a = map.vertexes[seg.v1], b = map.vertexes[seg.v2];
    const dx = b.x - a.x, dy = b.y - a.y;
    const dist = (dx * (y - a.y) - dy * (x - a.x)) / (Math.hypot(dx, dy) || 1); // > 0: à esquerda (fora)
    if (dist > INSIDE_TOLERANCE) return false;
  }
  return true;
}

const isValid = (s) => [s.x, s.y, s.z, s.vz].every(Number.isFinite) && s.ceilingz - s.floorz >= PLAYER_HEIGHT;

// Estado inicial no chão de (x, y). world: { map, lines, sectors, spawn: { x, y } }.
export function createPlayerState(world, x, y) {
  const state = { x, y, z: 0, vz: 0, floorz: 0, ceilingz: 0, lastValid: null };
  updateSector(state, world);
  state.z = state.floorz;
  if (isValid(state)) state.lastValid = { x, y, z: state.z };
  return state;
}

// Volta à última posição válida ou, sem ela, ao ponto de início.
function recover(state, world, reason) {
  const target = state.lastValid ?? { x: world.spawn.x, y: world.spawn.y, z: null };
  console.warn(`Física: estado inválido (${reason}); voltando para (${target.x.toFixed(1)}, ${target.y.toFixed(1)})`);
  state.x = target.x;
  state.y = target.y;
  state.vz = 0;
  updateSector(state, world);
  state.z = target.z ?? state.floorz;
}

// Um quadro de física. wish: velocidade horizontal desejada { vx, vy } em u/s (coordenadas do Doom).
// Devolve a lista de eventos do quadro: { type: 'landed', impactSpeed } quando toca o chão vindo de
// queda (impactSpeed = velocidade vertical positiva, em u/s, logo antes de zerá-la). Subir degraus
// não gera evento. O movimento é o mesmo da etapa 12.
// solids (etapa 16): objetos sólidos { x, y, radius } (padrão: nenhum, comportamento da etapa 12).
export function stepPlayer(state, wish, dt, world, solids = []) {
  const events = [];
  dt = Math.min(Math.max(dt, 0), MAX_PHYSICS_DT);
  if (dt === 0) return events;
  const startX = state.x, startY = state.y;
  const dist = Math.hypot(wish.vx, wish.vy) * dt;
  const steps = Math.max(1, Math.ceil(dist / MAX_SUBSTEP), Math.ceil(dt / MAX_GRAVITY_DT));
  const dtSub = dt / steps;

  for (let i = 0; i < steps; i++) {
    const prevX = state.x, prevY = state.y;
    // Horizontal: desloca, empurra para fora das paredes, descobre o setor.
    state.x += wish.vx * dtSub;
    state.y += wish.vy * dtSub;
    // Paredes e sólidos alternados, até PUSH_ROUNDS rodadas combinadas; as paredes têm a última palavra.
    for (let round = 0; round < PUSH_ROUNDS; round++) {
      pushOut(state, world, prevX, prevY);
      if (solids.length === 0 || !pushOutSolids(state, solids, PLAYER_RADIUS, prevX, prevY)) break;
      if (round === PUSH_ROUNDS - 1) pushOut(state, world, prevX, prevY);
    }
    if (!updateSector(state, world)) { recover(state, world, 'fora do mapa'); continue; }

    // Vertical: degrau (chão acima dos pés) sobe na hora; acima do chão, cai com gravidade.
    let falling = false;
    if (state.z > state.floorz) {
      state.vz -= GRAVITY * dtSub;
      state.z += state.vz * dtSub;
      falling = true;
    }
    if (state.z <= state.floorz) {
      if (falling && state.vz < 0) events.push({ type: 'landed', impactSpeed: -state.vz });
      state.z = state.floorz;
      state.vz = 0;
    }

    if (isValid(state)) state.lastValid = { x: state.x, y: state.y, z: state.z };
    else recover(state, world, 'NaN ou setor espremido');
  }
  // Velocidade horizontal real do quadro (u/s), depois da colisão (etapa 13: balanço da arma).
  state.hspeed = Math.hypot(state.x - startX, state.y - startY) / dt;
  return events;
}

// Troca de "voar" para "andar": pés abaixo do olho, nunca abaixo do chão; se a posição estiver fora
// do mapa (voando além das paredes), espremida ou sobreposta a uma parede depois do empurrão, vai
// para o ponto de início.
export function enterWalk(world, eyeX, eyeY, eyeZ) {
  if (!isInsideMap(world.map, eyeX, eyeY)) {
    console.warn('Física: fora do mapa ao entrar no modo andar; indo para o ponto de início');
    return createPlayerState(world, world.spawn.x, world.spawn.y);
  }
  const state = createPlayerState(world, eyeX, eyeY);
  const ok = updateSector(state, world);
  state.z = ok ? Math.max(eyeZ - EYE_HEIGHT, state.floorz) : 0;
  state.vz = 0;
  const stuck = !ok || !isValid(state) || pushOut(state, world, state.x, state.y) ||
    !updateSector(state, world) || !isValid(state);
  if (stuck) {
    console.warn('Física: posição inválida ao entrar no modo andar; indo para o ponto de início');
    return createPlayerState(world, world.spawn.x, world.spawn.y);
  }
  if (state.z < state.floorz) state.z = state.floorz;
  state.lastValid = { x: state.x, y: state.y, z: state.z };
  return state;
}
