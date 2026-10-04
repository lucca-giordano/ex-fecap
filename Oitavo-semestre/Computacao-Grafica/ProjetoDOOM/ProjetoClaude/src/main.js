import { initWebGPU } from './gpu.js';
import { perspective, multiply } from './mat4.js';
import { Camera, VIEW_HEIGHT, FOVY, BASE_MOUSE_SENS, BASE_FLY_SPEED, RUN_MULT, levelScale } from './camera.js';
import { settings } from './core/Settings.js';
import { Controls, ACTION_KEYS } from './input/Controls.js';
import { WadFile } from './wad/WadFile.js';
import { loadMap } from './wad/MapData.js';
import { loadTextures, usedTextureNames } from './wad/Textures.js';
import { loadColormap, buildLitPalette, skyNameForMap } from './wad/Colormap.js';
import { createTextureBindGroupLayout, createTextureSet } from './gpu/TextureSet.js';
import { Display, SCENE_FORMAT, DEPTH_FORMAT } from './gpu/Display.js';
import { createCheckedShaderModule, fetchText } from './gpu/shaderModule.js';
import { MenuPass } from './gpu/MenuPass.js';
import { ParticlePass } from './gpu/ParticlePass.js';
import { SpriteSet } from './gpu/SpriteSet.js';
import { HudPass } from './gpu/HudPass.js';
import { PlayerStats, AMMO_TYPES, KEY_NAMES } from './game/PlayerStats.js';
import { ItemSystem, MAX_DROPS } from './game/ItemSystem.js';
import { ITEM_TABLE, DROP_SPRITES } from './game/itemTable.js';
import { ITEM_TEXT } from './game/itemText.js';
import { staticSolids, getSolids } from './physics/solids.js';
import {
  WEAPONS, PISTOL, USABLE_SLOTS, createWeapons, startRaise, updateWeapons, updateSwayAmplitude, weaponLightLevel,
  requestWeapon, cycleWeapon, autoSwitchOnPickup, weaponView, killWeapons,
} from './game/weapons.js';
import { fireWeapon } from './game/fireWeapon.js';
import { loadHudAssets } from './hud/HudAssets.js';
import { composeHud } from './hud/HudRenderer.js';
import { loadSounds } from './audio/dmx.js';
import { AudioEngine } from './audio/AudioEngine.js';
import { MAX_CHANNELS } from './audio/channels.js';
import { MAX_VOLUME_LEVEL } from './audio/soundMath.js';
import { buildSpriteScene, writeSpriteInstances, frameAt, gameTics, INSTANCE_STRIDE } from './sprites/spriteLogic.js';
import { findSpriteLumps } from './wad/Sprites.js';
import { Rng } from './game/Rng.js';
import { resolveMonsterTable, extraSpriteFrames } from './game/monsterTable.js';
import { MonsterSystem } from './game/MonsterSystem.js';
import { MonsterAI } from './game/MonsterAI.js';
import { aproxDist } from './game/aiTable.js';
import { PlayerDamageSink } from './game/PlayerDamageSink.js';
import { applyDamage, deathSound } from './game/PlayerDamage.js';
import { deathEyeHeight, turnTowards, canRestart } from './game/PlayerDeath.js';
import { FaceState } from './hud/face.js';
import { computeTintTable, flashPalette, tintFor } from './gpu/palettesTint.js';
import { angleTo } from './game/MonsterAI.js';
import { radiusAttack, BARREL_DAMAGE } from './game/radiusAttack.js';
import { EffectList, effectFrame, MAX_EFFECTS } from './game/effects.js';
import { CombatStats } from './game/stats.js';
import { MAX_PARTICLES, paletteIndices, packSimUniforms, packRenderUniforms } from './particles/particleConfig.js';
import { ParticleParams } from './particles/ParticleParams.js';
import { TuningPanel } from './ui/TuningPanel.js';
import { installErrorOverlay, reportError } from './ui/errorOverlay.js';
import { loadMenuAssets } from './menu/MenuAssets.js';
import { Menu } from './menu/Menu.js';
import { composeMenu, skullFrame } from './menu/MenuRenderer.js';
import { MENU_LANG, MENU_TEXT } from './menu/menuText.js';
import { buildWalls } from './map/buildWalls.js';
import { VERTEX_STRIDE, VERTEX_ATTRIBUTES } from './map/vertexLayout.js';
import { buildFlats, distanceInside } from './map/buildFlats.js';
import { findSector, findSubsector } from './map/bsp.js';
import { buildCollisionLines } from './physics/collisionData.js';
import { EYE_HEIGHT, PLAYER_RADIUS, createPlayerState, stepPlayer, enterWalk } from './physics/collision.js';
import { doomToWorld, worldToDoom, doomAngleToYaw, yawToDoomAngle } from './map/coords.js';

const WAD_URL = new URL('../assets/freedoom1.wad', import.meta.url);
const MAP_NAME = 'E1M1';

const NEAR = 1;
const CLEAR_COLOR = { r: 0.15, g: 0.15, b: 0.15, a: 1 };

function showError(text) {
  const el = document.getElementById('msg');
  el.textContent = text;
  el.style.display = 'flex';
  console.error(text);
}

// Plano far a partir do tamanho do mapa: diagonal dos limites * 1.5.
function farFromMap(map) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const v of map.vertexes) {
    minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
    minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
  }
  return Math.hypot(maxX - minX, maxY - minY) * 1.5;
}

function printStats(walls, spawn, spawnSector, sector) {
  const s = walls.stats;
  console.log(`Paredes: ${s.quads.middle} centrais, ${s.quads.lower} inferiores, ${s.quads.upper} superiores`);
  console.log(`Vértices: ${walls.vertexCount}, índices: ${walls.indices.length}`);
  console.log(`Linedefs ignoradas: ${s.skippedLinedefs.length}`);
  for (const { linedef, reason } of s.skippedLinedefs) console.warn(`Linedef ${linedef} ignorada: ${reason}`);
  console.log(`Texturas centrais de dois lados ignoradas: ${s.ignoredMiddle2s}`);
  console.log(`Paredes superiores omitidas por F_SKY1: ${s.skyUpperOmitted}`);
  console.log(`Quads de altura zero omitidos: ${s.zeroHeightOmitted}`);
  console.log(`Peças de parede sem textura ("-"): ${s.untextured}`);
  console.log(`Spawn: (${spawn.x}, ${spawn.y}), ângulo ${spawn.angle}°`);
  console.log(`Setor do spawn: ${spawnSector}, chão ${sector.floorHeight}, teto ${sector.ceilingHeight}`);
}

function validateFlats(map, flats, spawn) {
  const s = flats.stats;
  console.log(`Subsectors: ${s.subsectors}, polígonos: ${s.polygons}, triângulos: ${s.triangles}, ` +
    `área total: ${s.totalArea.toFixed(0)}`);
  console.log(`Polígonos descartados: ${s.discarded.length}`);
  for (const i of s.discarded) console.warn(`Subsector ${i} descartado (polígono degenerado)`);

  // Pontas dos segs devem estar dentro do polígono ou na borda (tolerância de 0.5).
  const violations = [];
  let worst = 0;
  map.ssectors.forEach((ss, i) => {
    const info = flats.subsectorInfo[i];
    if (!info) return;
    let bad = false;
    for (let k = 0; k < ss.segCount; k++) {
      const seg = map.segs[ss.firstSeg + k];
      for (const v of [map.vertexes[seg.v1], map.vertexes[seg.v2]]) {
        const d = distanceInside(info.polygon, v.x, v.y);
        worst = Math.min(worst, d);
        if (d < -0.5) bad = true;
      }
    }
    if (bad) violations.push(i);
  });
  console.log(`Violações de segs fora do polígono: ${violations.length}` +
    (violations.length ? ` (primeiros: ${violations.slice(0, 10).join(', ')}; pior: ${(-worst).toFixed(3)} unidades)` : ''));
  if (violations.length) {
    // No E1M1 todas vêm de vértices criados pelo node builder ao dividir segs. Eles são gravados
    // arredondados para inteiros e ficam até ~0.7 unidade fora da linha de partição exata.
    console.log('  Causa: vértices de divisão do BSP arredondados para inteiros no WAD (até ~0.7 unidade).');
  }

  const ssi = findSubsector(map, spawn.x, spawn.y);
  const info = flats.subsectorInfo[ssi];
  const inside = info && distanceInside(info.polygon, spawn.x, spawn.y) >= 0;
  console.log(`Spawn no subsector ${ssi}: ${inside ? 'dentro do polígono' : 'FORA do polígono'}`);

  const names = new Set();
  for (const sec of map.sectors) { names.add(sec.floorTexture); names.add(sec.ceilingTexture); }
  console.log(`Flats distintos: ${names.size}: ${[...names].sort().join(', ')}`);
}

function printTextureStats(tex, used, gpuInfo) {
  const s = tex.stats;
  console.log(`Texturas de parede: ${used.walls.size} usadas, ${s.wallsLoaded} carregadas` +
    (s.missingWalls.length ? `, não encontradas: ${s.missingWalls.join(', ')}` : ', nenhuma ausente'));
  console.log(`Flats: ${used.flats.size} usados (sem F_SKY1), ${s.flatsLoaded} carregados` +
    (s.missingFlats.length ? `, não encontrados: ${s.missingFlats.join(', ')}` : ', nenhum ausente'));
  for (const n of s.missingWalls) console.warn(`Textura ${n} não encontrada, usando fallback`);
  for (const n of s.missingFlats) console.warn(`Flat ${n} não encontrado, usando fallback`);
  const { walls, flats } = gpuInfo;
  console.log(`Array de paredes: ${walls.width}x${walls.height}, ${walls.layers} camadas`);
  console.log(`Array de flats: ${flats.width}x${flats.height}, ${flats.layers} camadas`);
  console.log(`Texturas com pixels transparentes: ${s.transparent.length}` +
    (s.transparent.length ? ` (${s.transparent.map((t) => `${t.name}: ${t.count}`).join(', ')})` : ''));
  console.log(`Referências de patch inválidas: ${s.badPatchRefs.length}`);
  for (const r of s.badPatchRefs) console.warn(`Textura ${r.texture}, patch ${r.patchIndex}: ${r.reason}`);
}

function printLightingStats(colormap, litPalette, palette, textureSet, flats, map) {
  console.log(`COLORMAP: ${colormap.size} bytes, ${colormap.tables} tabelas`);
  // Linha 0 da paleta iluminada deve ser idêntica à paleta 0 do PLAYPAL.
  let diffs = 0;
  for (let i = 0; i < 256; i++) {
    for (let c = 0; c < 3; c++) if (litPalette[i * 4 + c] !== palette[i * 3 + c]) diffs++;
  }
  console.log(`Diferenças entre a linha 0 da paleta iluminada e o PLAYPAL: ${diffs}`);

  const sky = textureSet.sky;
  const skySubsectors = flats.subsectorInfo.filter((s) => s?.isSky).length;
  console.log(`Céu: ${sky.name} ${sky.width}x${sky.height}, camada ${sky.layer}; ` +
    `subsectors com teto F_SKY1: ${skySubsectors}`);

  const counts = new Array(16).fill(0);
  for (const s of map.sectors) counts[Math.min(15, Math.max(0, Math.floor(s.lightLevel / 16)))]++;
  console.log('lightnum dos setores (0..15):', counts.map((n, i) => `${i}:${n}`).join(' '));
}

async function main() {
  const canvas = document.getElementById('gfx');
  const hud = document.getElementById('hud');
  const modeButton = document.getElementById('modeBtn');
  const loading = document.getElementById('loading');
  const crtButton = document.getElementById('crtBtn');
  const { device, context, format } = await initWebGPU(canvas);
  // Erros de validação do WebGPU não lançam exceção nem passam por window.onerror: vão para o quadro.
  device.addEventListener('uncapturederror', (e) => {
    reportError(new Error(`WebGPU: ${e.error.message}`), 'erro de validação do WebGPU (uncapturederror)');
  });

  // --- Mapa ---
  const wad = await WadFile.fromUrl(WAD_URL);
  const map = loadMap(wad, MAP_NAME);

  // --- Som (etapa 14): sons DMX do WAD; o AudioContext só é criado no primeiro gesto do usuário ---
  const soundData = loadSounds(wad);
  const audio = new AudioEngine(soundData.sounds, {
    volumeLevel: settings.get('sfxVolumeLevel'), muted: settings.get('muted'), skipped: soundData.invalid.length,
  });
  console.log(`Som: ${soundData.sounds.size} sons válidos, ${soundData.invalid.length} inválidos; ` +
    'o AudioContext é criado no primeiro clique ou tecla');
  settings.subscribe('sfxVolumeLevel', (level) => audio.setVolumeLevel(level));
  settings.subscribe('muted', (muted) => audio.setMuted(muted));
  // Queda que toca "oof": 8 unidades por tic * 35 tics/s (P_ZMovement do Doom), quedas maiores que 32.
  const OOF_IMPACT_SPEED = 8 * 35;
  // Por que o mouse vai ser recuperado: 'resume' toca "swtchx" (fechar o menu para retomar o jogo).
  let lockReason = 'resume';

  // --- Texturas, colormap e céu ---
  const skyName = skyNameForMap(MAP_NAME);
  const used = usedTextureNames(map);
  used.walls.add(skyName); // o céu é carregado mesmo que nenhuma sidedef o use
  const textures = loadTextures(wad, used.walls, used.flats);
  const colormap = loadColormap(wad);
  const litPalette = buildLitPalette(textures.palette, colormap);
  const textureLayout = createTextureBindGroupLayout(device);
  const textureSet = createTextureSet(device, textureLayout, textures, litPalette, skyName);
  printTextureStats(textures, used, textureSet.info);

  const walls = buildWalls(map, textureSet.wallLayers);

  const spawn = map.things.find((t) => t.type === 1); // type 1 = início do jogador 1
  if (!spawn) throw new Error(`${MAP_NAME}: início do jogador 1 não encontrado`);
  const spawnSector = findSector(map, spawn.x, spawn.y);
  const sector = map.sectors[spawnSector];
  printStats(walls, spawn, spawnSector, sector);

  const flats = buildFlats(map, textureSet.flatLayers);
  validateFlats(map, flats, spawn);
  printLightingStats(colormap, litPalette, textures.palette, textureSet, flats, map);

  const far = farFromMap(map);

  // --- Buffers de geometria ---
  const makeBuffer = (data, usage) => {
    const buffer = device.createBuffer({ size: data.byteLength, usage: usage | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(buffer, 0, data);
    return buffer;
  };
  const vertexBuffer = makeBuffer(walls.vertices, GPUBufferUsage.VERTEX);
  const indexBuffer = makeBuffer(walls.indices, GPUBufferUsage.INDEX);

  // Flats: dois vertex buffers com as mesmas posições, cor por flat ou por setor (tecla V).
  const flatVertexBuffers = {
    flat: makeBuffer(flats.vertices, GPUBufferUsage.VERTEX),
    sector: makeBuffer(flats.sectorColorVertices, GPUBufferUsage.VERTEX),
  };
  const flatIndexBuffer = makeBuffer(flats.indices, GPUBufferUsage.INDEX);

  // Uniforms da cena (96 bytes): viewProj (16 f32), camPos (4 f32), mode, lighting, skyTest, skyLayer (u32).
  const uniformData = new ArrayBuffer(96);
  const uniformF32 = new Float32Array(uniformData);
  const uniformU32 = new Uint32Array(uniformData);
  const uniformBuffer = device.createBuffer({
    size: uniformData.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // --- Pipelines da cena: um com backface culling e outro sem (tecla C alterna) ---
  const sceneCode = await fetchText(new URL('./shaders/walls.wgsl', import.meta.url));
  const module = await createCheckedShaderModule(device, 'cena', [{ name: 'walls.wgsl', code: sceneCode }]);

  // Layout explícito para o bind group servir aos dois pipelines.
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [{
      binding: 0,
      visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
      buffer: { type: 'uniform' },
    }],
  });
  // Grupo 0: uniforms; grupo 1: texturas (TextureSet).
  const layout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout, textureLayout] });

  const makePipeline = (cullMode) => device.createRenderPipeline({
    layout,
    vertex: {
      module,
      entryPoint: 'vs_main',
      buffers: [{ arrayStride: VERTEX_STRIDE, attributes: VERTEX_ATTRIBUTES }],
    },
    // A cena é desenhada na textura fora da tela (Display), não direto no canvas.
    fragment: { module, entryPoint: 'fs_main', targets: [{ format: SCENE_FORMAT }] },
    // frontFace 'ccw' (padrão): buildWalls ordena os vértices para a face visível ser CCW.
    primitive: { topology: 'triangle-list', cullMode, frontFace: 'ccw' },
    depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: true, depthCompare: 'less' },
  });
  const pipelines = { back: makePipeline('back'), none: makePipeline('none') };

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });

  // --- Exibição: resolução interna + blit ---
  // blit.wgsl + crt.wgsl num só módulo (WGSL não tem #include).
  const blitCode = await fetchText(new URL('./shaders/blit.wgsl', import.meta.url));
  const crtCode = await fetchText(new URL('./shaders/crt.wgsl', import.meta.url));
  const blitModule = await createCheckedShaderModule(device, 'blit + CRT', [
    { name: 'blit.wgsl', code: blitCode },
    { name: 'crt.wgsl', code: crtCode },
  ]);
  const display = new Display(device, canvas, context, format, blitModule, settings);

  // Etapa 19: variante do blit com flash de tela, em arquivos próprios (o blit acima não muda). Só é
  // usada se o módulo e a pipeline forem validados; senão, o jogo segue com o blit original.
  const tintTable = computeTintTable(wad.getLumpBytes(wad.findLump('PLAYPAL')));
  console.log('Flashes: mistura ajustada a cada paleta do PLAYPAL (t e erro médio por canal, em níveis de 0 a 255)');
  console.table(tintTable.map((e) => ({ paleta: e.palette, t: e.t.toFixed(3), erro: e.error.toFixed(2) })));
  if (tintTable.some((e) => e.error > 6)) console.warn('Flashes: alguma paleta difere mais de 6 níveis da mistura');
  display.onTintError = (err) => { console.error(err.message); reportError(err); };
  try {
    const blitTintCode = await fetchText(new URL('./shaders/blitTint.wgsl', import.meta.url));
    const crtTintCode = await fetchText(new URL('./shaders/crtTint.wgsl', import.meta.url));
    const tintModule = await createCheckedShaderModule(device, 'blit + CRT com flash', [
      { name: 'blitTint.wgsl', code: blitTintCode },
      { name: 'crtTint.wgsl', code: crtTintCode },
    ]);
    await display.attachTint(tintModule, format);
  } catch (err) {
    console.error('Flashes desligados nesta sessão:', err.message);
    reportError(err);
  }

  // Estado inicial do CRT; MASK_ENABLED e WARP_ENABLED são lidos do próprio crt.wgsl.
  const crtConst = (name) => new RegExp(`const ${name}\\s*=\\s*(true|false)`).exec(crtCode)?.[1] ?? '?';
  console.log(`CRT inicial: ${settings.get('crt') ? 'ligado' : 'desligado'}; ` +
    `MASK_ENABLED = ${crtConst('MASK_ENABLED')}; WARP_ENABLED = ${crtConst('WARP_ENABLED')}`);

  // --- Configurações: o main assina as mudanças e aplica os efeitos ---
  // Os valores (culling, textured, lighting, ...) são lidos com settings.get() a cada frame;
  // aqui ficam só os efeitos que não dependem do frame.
  console.log(`Configurações carregadas de: ${settings.source}`);
  settings.subscribe('*', (value, key) => console.log(`Configuração ${key} = ${value}`));

  const updateButtons = () => {
    modeButton.textContent = `Visual: ${display.modeLabel}`;
    crtButton.textContent = `CRT: ${settings.get('crt') ? 'ligado' : 'desligado'}`;
  };
  updateButtons();
  settings.subscribe('visualMode', () => { display.logPending = true; updateButtons(); });
  settings.subscribe('crt', updateButtons);
  // Menu, controles e painel de calibragem se referenciam pelos callbacks, então são declarados
  // aqui e criados mais abaixo. menuVisible só é chamado depois que os três existem.
  let menu = null;
  let controls = null;
  let tuningPanel = null;
  // O menu está aberto sempre que o pointer lock NÃO está ativo, exceto com o painel de calibragem.
  const menuVisible = () => !controls.locked && !tuningPanel.isOpen;

  // O HUD aparece conforme a configuração, e nunca com o menu aberto.
  const applyHud = () => { hud.style.display = settings.get('hud') && !menuVisible() ? '' : 'none'; };
  settings.subscribe('hud', applyHud);

  // Botões: o clique não chega ao canvas (sem pointer lock) e o blur() tira o foco, para a barra
  // de espaço não acionar o botão de novo.
  for (const [button, key] of [[modeButton, 'visualMode'], [crtButton, 'crt']]) {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      settings.toggle(key);
      button.blur();
    });
  }

  // --- Painel de ajuda (tecla H durante o jogo; não abre sozinho nem aparece sobre o menu) ---
  const helpPanel = document.getElementById('help');
  // Grupos (armas, roda, setas) viram uma linha só.
  const GROUP_LINES = { weapons: '1 a 7  armas (1 a 4 utilizáveis)', wheel: 'Roda   próxima / anterior arma',
    tuning: 'Setas  girar a câmera (calibragem)' };
  helpPanel.textContent =
    [...new Set(Object.values(ACTION_KEYS).map((k) => (k.group ? GROUP_LINES[k.group] : `${k.label.padEnd(7)}${k.desc}`)))].join('\n') +
    '\nEsc    abrir o menu';
  const setHelp = (visible) => { helpPanel.style.display = visible ? '' : 'none'; };
  setHelp(false);

  console.table(Object.fromEntries(Object.entries(ACTION_KEYS)
    .map(([action, k]) => [action, { tecla: k.label, code: k.code, tipo: k.kind, descricao: k.desc }])));

  const stepLevel = (key, delta) => settings.set(key, Math.min(10, Math.max(1, settings.get(key) + delta)));

  // --- Câmera no início do jogador 1 ---
  const camera = new Camera([0, 0, 0]);
  // Posição e ângulo do THING 1 (etapa 3); também usado pelo NEW GAME.
  // Física do modo andar (etapa 12), em coordenadas do Doom; a câmera fica no olho (pés + EYE_HEIGHT).
  const physicsWorld = { map, lines: buildCollisionLines(map), sectors: map.sectors, spawn: { x: spawn.x, y: spawn.y } };
  let walker = createPlayerState(physicsWorld, spawn.x, spawn.y);
  let eyeOffset = EYE_HEIGHT; // etapa 19: desce até 6 na morte
  const syncCameraToWalker = () => { camera.pos = doomToWorld(walker.x, walker.y, walker.z + eyeOffset); };
  console.log(`Física: ${physicsWorld.lines.length} linhas de colisão; modo inicial ${settings.get('moveMode')}`);

  function resetToSpawn() {
    camera.pos = doomToWorld(spawn.x, spawn.y, sector.floorHeight + VIEW_HEIGHT);
    camera.yaw = doomAngleToYaw(spawn.angle);
    camera.pitch = 0;
    walker = createPlayerState(physicsWorld, spawn.x, spawn.y); // pés no chão do ponto de início
    eyeOffset = EYE_HEIGHT;
  }
  resetToSpawn();

  // Troca de modo (tecla G ou menu): voar -> andar parte do olho atual; andar -> voar mantém o olho.
  settings.subscribe('moveMode', (mode) => {
    if (mode !== 'walk') return;
    const [x, y, eyeZ] = worldToDoom(...camera.pos);
    walker = enterWalk(physicsWorld, x, y, eyeZ);
    syncCameraToWalker();
  });

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch((err) => console.warn('Tela cheia:', err.message));
  };

  // --- Menu (desenhado na imagem interna, antes do CRT) ---
  const menuAssets = loadMenuAssets(wad);
  const dims = (name) => {
    const p = menuAssets.patches[name];
    return p ? `${name} ${p.width}x${p.height}` : `${name} ausente`;
  };
  console.log(`Menu: ${menuAssets.found.length} lumps encontrados; ausentes: ${menuAssets.missing.join(', ') || 'nenhum'}`);
  console.log(`Menu: ${['M_DOOM', 'M_SKULL1', 'M_THERMM', 'TITLEPIC'].map(dims).join(', ')}`);
  console.log(`Idioma do menu: ${MENU_LANG}`);
  const menuCode = await fetchText(new URL('./shaders/menu.wgsl', import.meta.url));
  const menuModule = await createCheckedShaderModule(device, 'menu', [{ name: 'menu.wgsl', code: menuCode }]);
  const menuPass = new MenuPass(device, menuModule);

  // --- Partículas (etapa 10): compute + desenho; se falharem, ficam desligadas só nesta sessão ---
  const particleCode = await fetchText(new URL('./shaders/particles.wgsl', import.meta.url));
  const particleModule = await createCheckedShaderModule(device, 'partículas', [{ name: 'particles.wgsl', code: particleCode }]);
  const particles = await ParticlePass.create(device, particleModule, textureSet.litPaletteView);
  console.log(`Partículas: ${particles ? 'disponíveis' : 'INDISPONÍVEIS nesta sessão'}; máximo ${MAX_PARTICLES}`);

  // Parâmetros ajustáveis (padrões < config/particles.json < localStorage), lidos a cada frame.
  const particleParams = new ParticleParams();
  await particleParams.load();
  // Índices da paleta das três cores, recalculados quando os parâmetros mudam.
  let particlePalette = null;
  let lastColors = '';
  particleParams.subscribe((p) => {
    const colors = `${p.dust.color} ${p.ember.colorHot} ${p.ember.colorCool}`;
    if (colors === lastColors) return;
    lastColors = colors;
    particlePalette = paletteIndices(textures.palette, p);
    const rgb = (i) => Array.from(textures.palette.subarray(i * 3, i * 3 + 3)).join(', ');
    console.log(`Partículas: cores ${colors} -> índices poeira ${particlePalette.dust} (${rgb(particlePalette.dust)}), ` +
      `brasa quente ${particlePalette.emberHot} (${rgb(particlePalette.emberHot)}), ` +
      `brasa fria ${particlePalette.emberCold} (${rgb(particlePalette.emberCold)})`);
  });
  particleParams.notify();
  let particleGeneration = 1; // "Reiniciar partículas" incrementa; o shader faz renascer as de outra geração
  const startTime = performance.now();

  // --- Combate (etapa 15): tabela de monstros conferida contra os lumps do WAD ---
  const rng = new Rng(Date.now()); // gerador próprio (não é a tabela de 256 números do Doom)
  const monsterTable = resolveMonsterTable(findSpriteLumps(wad).lumps, new Set(map.things.map((t) => t.type)));
  if (monsterTable.removed.length) console.warn(`Combate: quadros ausentes removidos: ${monsterTable.removed.join(', ')}`);
  if (monsterTable.unresolved.length) console.warn(`Combate: tipos sem quadros de morte: ${monsterTable.unresolved.join(', ')}`);
  if (monsterTable.noAI.length) console.warn(`IA: tipos que ficam passivos: ${monsterTable.noAI.join('; ')}`);

  // --- Sprites dos objetos (etapa 11); se falharem, ficam desligados só nesta sessão ---
  let spriteScene = null;
  let sprites = null;
  try {
    // Etapa 15: quadros de dor, morte, morte esfacelada e efeitos também vão para a textura.
    spriteScene = buildSpriteScene(wad, map, {
      maxLayers: device.limits.maxTextureArrayLayers,
      // Etapa 16: CLIP, SHOT e MGUN (itens largados) na categoria 'drop', que nunca é descartada.
      extraFrames: [...extraSpriteFrames(monsterTable.entries), ...DROP_SPRITES.map((f) => ({ ...f, category: 'drop' }))],
    });
    console.log(`Sprites: ${spriteScene.layers.length} camadas no total (limite ${device.limits.maxTextureArrayLayers})` +
      (spriteScene.stats.droppedCategories.length ? `; quadros descartados: ${spriteScene.stats.droppedCategories.join(', ')}` : '') +
      (spriteScene.stats.missingExtra.length ? `; ausentes: ${spriteScene.stats.missingExtra.join(', ')}` : ''));
    if (spriteScene.stats.droppedCategories.length) console.warn('Sprites: camadas insuficientes; parte dos quadros de combate foi descartada');
    const st = spriteScene.stats;
    console.log(`Sprites: lumps ${st.spriteLumps} (${st.source}); histograma dos tipos do ${MAP_NAME}:`);
    console.table([...st.histogram.values()].sort((a, b) => a.type - b.type)
      .map((h) => ({ tipo: h.type, quantidade: h.count, prefixo: h.prefix, resolvido: h.resolved ? 'sim' : 'não' })));
    console.log(`Sprites: descartados por dificuldade ${st.discarded.skill}, só multiplayer ${st.discarded.multiplayer}, ` +
      `setor inválido ${st.discarded.sector}; ignorados (sem sprite) ${st.ignored}; ` +
      `desconhecidos [${st.unknown.join(', ')}]; não resolvidos [${st.unresolved.join(', ')}]`);
    if (st.truncated) console.warn('Sprites: camadas demais; só o primeiro quadro de cada animação foi mantido');
    // Etapa 18: estimativa da textura (camadas x largura x altura x 2 bytes, formato rg8uint).
    console.log(`Sprites: textura de ${st.texture.layers} camadas de ${st.texture.layerW}x${st.texture.layerH}, ` +
      `cerca de ${(st.texture.bytes / 1048576).toFixed(1)} MiB`);
    const spriteCode = await fetchText(new URL('./shaders/sprites.wgsl', import.meta.url));
    // walls.wgsl vem antes para reaproveitar lightLevel() (mesma regra de luz das paredes).
    const spriteModule = await createCheckedShaderModule(device, 'sprites', [
      { name: 'walls.wgsl', code: sceneCode },
      { name: 'sprites.wgsl', code: spriteCode },
    ]);
    // Capacidade: objetos do mapa + efeitos + itens largados (etapa 16).
    const capacity = spriteScene.objects.length + MAX_EFFECTS + MAX_DROPS;
    sprites = await SpriteSet.create(device, spriteModule, spriteScene, textureSet.litPaletteView, {
      capacity, report: reportError,
    });
    console.log(`Sprites: ${spriteScene.layers.length} camadas, capacidade de ${capacity} instâncias`);
    if (sprites) {
      const i = sprites.info;
      console.log(`Sprites: ${spriteScene.objects.length} objetos, ${spriteScene.types.size} tipos, ` +
        `${i.layers} camadas de ${i.layerW}x${i.layerH}, instância de ${INSTANCE_STRIDE} bytes`);
    }
  } catch (err) {
    console.error('Sprites: falha ao preparar; sprites desligados nesta sessão.', err);
    reportError(err);
    sprites = null;
  }
  let gameTime = 0; // relógio de jogo (s): não avança com o menu aberto

  // --- Monstros, efeitos e contadores (etapa 15) ---
  const effects = new EffectList();
  // --- Jogador: estado, dano, morte e rosto (etapa 19) ---
  const stats = new PlayerStats();
  const playerDamage = new PlayerDamageSink(); // contadores por origem para o HUD de texto
  const face = new FaceState();
  let deathFeet = 0;             // altura dos pés na morte (modo voar)
  let fireReleasedSinceDeath = false;
  // Todo dano ao jogador passa por aqui (monstros, barris e depuração). attacker: { x, y } ou null.
  function damagePlayer(amount, source, kind, attacker) {
    const r = applyDamage(stats, amount, attacker, source, rng, settings.get('godMode'));
    if (r.applied <= 0 && r.savedByArmor <= 0) return r;
    playerDamage.onPlayerDamaged(r.applied, source, kind, r.savedByArmor);
    face.onDamage(r.applied, attacker);
    for (const ev of r.events) {
      if (ev.type === 'playerPain') audio.play('plpain', { origin: 'player' });
      if (ev.type === 'playerDied') {
        audio.play(deathSound(ev.overkill, (n) => soundData.sounds.has(n)), { origin: 'player' });
        console.log(`Jogador morto por ${source} (vida final ${ev.overkill})`);
      }
    }
    return r;
  }
  const lightAt = (x, y) => {
    const sec = map.sectors[findSector(map, x, y)];
    return sec ? Math.min(15, Math.max(0, Math.floor(sec.lightLevel / 16))) : 15;
  };
  const playerTarget = () => {
    const [px, py] = worldToDoom(...camera.pos);
    return { x: px, y: py, radius: PLAYER_RADIUS };
  };
  const combat = new CombatStats(); // total de monstros preenchido logo abaixo
  const monsters = new MonsterSystem(spriteScene?.objects ?? [], monsterTable.entries,
    (obj) => map.things[obj.index].type, rng, {
      onSound: (name, m) => audio.play(name, { origin: `thing:${m.thingIndex}`, x: m.x, y: m.y }),
      onKill: () => { combat.kills++; },
      // Barril no quadro C: dano em raio a partir do centro dele (reação em cadeia acontece sozinha).
      onExplode: (m) => radiusAttack(physicsWorld, m, BARREL_DAMAGE, m, monsters.monsters, rng, {
        damage: (target, amount) => monsters.damage(target, amount),
        onPlayerDamaged: (amount) => damagePlayer(amount, 'BAR1', 'explosion', null),
        player: playerTarget(),
      }),
    });
  combat.totalMonsters = monsters.totalMonsters;
  console.log(`Combate: ${monsters.monsters.length} objetos atiráveis, ${combat.totalMonsters} monstros`);

  // --- Itens e sólidos (etapa 16) ---
  const thingType = (obj) => map.things[obj.index].type;
  const floorAt = (x, y) => map.sectors[findSector(map, x, y)]?.floorHeight ?? 0;
  const itemSystem = new ItemSystem(spriteScene?.objects ?? [], thingType, floorAt, PLAYER_RADIUS);
  const fixedSolids = staticSolids(spriteScene?.objects ?? [], thingType);
  const frameSolids = []; // reaproveitado a cada frame
  const missingItemTypes = [...new Set(map.things.map((t) => t.type))]
    .filter((type) => ITEM_TABLE[type] && !spriteScene?.types.has(type));
  console.log(`Itens: ${itemSystem.items.length} no mapa, ${itemSystem.totalCountable} contáveis; ` +
    `${fixedSolids.length} sólidos fixos` + (missingItemTypes.length ? `; sem sprite: ${missingItemTypes.join(', ')}` : ''));
  // --- IA dos monstros (etapa 18) ---
  // Pés do jogador: no modo andar, a física; voando, olho - 41.
  const playerFeet = () => {
    const [px, py, eyeZ] = worldToDoom(...camera.pos);
    // Andando, a física (o corpo ainda cai); voando, os pés guardados na morte ou olho - 41.
    const z = settings.get('moveMode') === 'walk' ? walker.z : stats.isDead ? deathFeet : eyeZ - EYE_HEIGHT;
    return { x: px, y: py, z, alive: !stats.isDead };
  };
  const monsterAI = new MonsterAI({
    world: physicsWorld, rng, player: playerFeet,
    noTarget: () => settings.get('noTarget'), staticSolids: fixedSolids,
    onSound: (name, m) => audio.play(name, { origin: `thing:${m.thingIndex}`, x: m.x, y: m.y }),
    onPlayerDamaged: (amount, source, kind, attacker) => damagePlayer(amount, source, kind, attacker),
  }).attach(monsters);
  monsters.setAIEnabled(settings.get('monsterAI'));
  settings.subscribe('monsterAI', (on) => monsters.setAIEnabled(on));
  console.log(`IA: ${monsters.monsters.filter((m) => m.aiDef).length} monstros com IA; ` +
    `${monsterAI.graph.edges.reduce((n, e) => n + e.length, 0) / 2} ligações de som entre setores`);

  let pickupMessage = '';  // mensagem de coleta mostrada na barra
  let messageTics = 0;     // tics restantes da mensagem (140 = 4 segundos)
  const MESSAGE_TICS = 140;
  const resetItems = () => {
    itemSystem.reset();
    pickupMessage = '';
    messageTics = 0;
  };
  const resetCombat = () => {
    monsters.reset();
    effects.reset();
    combat.reset();
    playerDamage.reset(); // monsters.reset() também apaga os alertas de setor
  };

  // Evento "fire" da máquina de armas (etapa 17): pistola e metralhadora 1 bala, espingarda 7 projéteis,
  // soco a 64 unidades. Um evento conta como 1 disparo; acerto se algum projétil pegar monstro ou barril.
  function handleFire(ev) {
    combat.shots++;
    if (ev.weapon === 3) audio.play('shotgn', { origin: 'player' });
    else if (ev.weapon !== 1) audio.play('pistol', { origin: 'player' }); // pistola e metralhadora
    const [ox, oy, oz] = worldToDoom(...camera.pos); // olho do jogador
    monsterAI.noise(findSector(map, ox, oy)); // etapa 18: todo disparo acorda quem ouve
    const r = fireWeapon(ev, {
      world: physicsWorld, origin: { x: ox, y: oy, z: oz }, yaw: yawToDoomAngle(camera.yaw),
      pitch: camera.pitch * 180 / Math.PI, // o pitch da câmera manda (sem mira automática)
      monsters: monsters.monsters, rng, effects, lightAt, damage: (m, amount) => monsters.damage(m, amount),
    });
    if (r.hit) {
      combat.hits++;
      if (ev.weapon === 1) audio.play('punch', { origin: 'player' }); // soco só soa quando acerta
    }
  }

  // Prefixo do sprite de cada tipo largado (2007 CLIP, 2001 SHOT, 2002 MGUN).
  const ITEM_DROP_PREFIX = { 2007: 'CLIP', 2001: 'SHOT', 2002: 'MGUN' };
  // Itens de sprite do frame: objetos (parados, em dor, morrendo ou corpos), itens largados e efeitos.
  function spriteItems(tic) {
    const items = [];
    for (const obj of spriteScene.objects) {
      const m = monsters.byObject.get(obj.index);
      if (m?.removed || itemSystem.isCollected(obj.index)) continue;
      const f = m ? monsters.frameOf(m) : null;
      let views = f ? spriteScene.frames.get(f.prefix + f.letter) : null;
      // Parado (ou quadro descartado por falta de camadas): animação de parado da etapa 11.
      if (!views) views = obj.type.frameLayers.get(frameAt(obj.type.frames, obj.type.tics, tic, obj.offset));
      // Etapa 18: monstros usam posição, chão e ângulo atuais (a luz é a do setor onde estão).
      const moved = m && (m.x !== obj.x || m.y !== obj.y);
      items.push({ x: m ? m.x : obj.x, y: m ? m.y : obj.y, angle: m ? m.angle : obj.angle,
        base: moved ? doomToWorld(m.x, m.y, m.floorZ) : obj.base, lightnum: moved ? lightAt(m.x, m.y) : obj.lightnum, views,
        fullbright: obj.type.fullbright || Boolean(f?.fullbright), fuzz: obj.type.fuzz });
    }
    // Itens largados por monstros (etapa 16): quadro A, no chão do setor.
    for (const d of itemSystem.drops) {
      const views = spriteScene.frames.get(ITEM_DROP_PREFIX[d.type] + 'A');
      if (views) items.push({ x: d.x, y: d.y, angle: 0, base: doomToWorld(d.x, d.y, d.floorZ), lightnum: lightAt(d.x, d.y), views, fullbright: false, fuzz: false });
    }
    for (const e of effects.items) {
      const { letter, fullbright } = effectFrame(e);
      const views = spriteScene.frames.get(e.prefix + letter);
      if (views) items.push({ x: e.x, y: e.y, angle: 0, base: doomToWorld(e.x, e.y, e.z), lightnum: e.lightnum ?? 15, views, fullbright, fuzz: false });
    }
    return items;
  }

  // --- Pistola e barra de status (etapa 13); se faltar algo ou a GPU recusar, desliga só na sessão ---
  let hudAssets = null;
  let hudPass = null;
  let hudAvailable = false; // só fica true depois da validação da pipeline
  try {
    hudAssets = loadHudAssets(wad);
    if (hudAssets.missing.length) console.warn(`HUD: lumps ausentes: ${hudAssets.missing.join(', ')}`);
    if (!hudAssets.ok) {
      const message = `HUD (pistola e barra) desligado nesta sessão: faltam ${hudAssets.fatal.join(', ')}`;
      console.error(message);
      reportError(new Error(message));
    } else {
      const hudCode = await fetchText(new URL('./shaders/hud.wgsl', import.meta.url));
      const hudModule = await createCheckedShaderModule(device, 'hud', [{ name: 'hud.wgsl', code: hudCode }]);
      hudPass = await HudPass.create(device, hudModule, reportError);
      hudAvailable = Boolean(hudPass);
      console.log(`HUD: ${hudAvailable ? 'disponível' : 'indisponível'}; armas com lumps: ${hudAssets.weaponSlots.join(', ')}`);
      // Etapa 17: arma com lumps ausentes fica indisponível (não pode ser escolhida).
      for (const slot of USABLE_SLOTS.filter((s) => !hudAssets.weaponSlots.includes(s))) {
        const message = `Arma ${slot} (${WEAPONS[slot].prefix}) indisponível: faltam lumps`;
        console.error(message);
        reportError(new Error(message));
      }
    }
  } catch (err) {
    console.error('HUD: falha ao preparar; desligado nesta sessão.', err);
    reportError(err);
    hudAvailable = false;
  }
  const weapons = createWeapons({ available: hudAssets?.weaponSlots ?? [PISTOL] });
  const warnedUnusable = new Set(); // aviso único por arma não utilizável
  // Pedido de troca (tecla ou roda); só com o jogo iniciado.
  function selectWeapon(slot) {
    if (!menu.started) return;
    if (!WEAPONS[slot].usable) {
      if (!warnedUnusable.has(slot)) console.warn(`Arma ${slot} (${WEAPONS[slot].name}) não é utilizável nesta etapa`);
      warnedUnusable.add(slot);
      return;
    }
    requestWeapon(weapons, slot, stats);
  }
  let lastPistolTic = 0;
  let lastHudKey = '';
  const WEAPON_STATE_LABEL = { lower: 'descendo', raise: 'subindo', ready: 'parada', fire: 'atacando' };

  // --- Painel de calibragem (tecla T, só com o jogo iniciado) ---
  tuningPanel = new TuningPanel(document.getElementById('tuning'), particleParams, {
    getInternalHeight: () => display.internal.height,
    onClose: () => closeTuning(),
    onRestart: () => { particleGeneration++; },
  });
  tuningPanel.hide();
  // Abrir: solta o mouse (as setas giram a câmera e o mouse fica livre para o painel); o menu não aparece.
  function openTuning() {
    if (!menu.started || tuningPanel.isOpen) return;
    tuningPanel.show();
    if (controls.locked) document.exitPointerLock();
    applyHud();
  }
  // Fechar: chamado dentro do handler do teclado ou do clique, então o pedido de pointer lock é um
  // gesto válido (o Esc não conta; se falhar, o menu normal aparece).
  function closeTuning() {
    if (!tuningPanel.isOpen) return;
    tuningPanel.hide();
    menu.open({ silent: true }); // se o mouse não voltar, o menu aparece (sem som: não foi o jogador que o abriu)
    lockReason = 'tuning';
    controls.requestLock();
    applyHud();
  }
  const TURN_RATE = Math.PI / 2; // setas no modo de calibragem: 90 graus por segundo

  // NEW GAME (menu) e reinício depois da morte (etapa 19): jogador, monstros, itens, largados, efeitos,
  // alertas de som, contadores, rosto e arma subindo.
  function newGame() {
    lockReason = 'newGame';
    resetToSpawn();
    stats.reset();
    face.reset();
    resetCombat();
    resetItems();
    startRaise(weapons, PISTOL);
    controls.clear(); // estado de disparo (e de movimento) limpo
    controls.requestLock();
  }
  // Reinício: só morto, depois de 35 tics.
  const tryRestart = () => {
    if (!menu.started || !stats.isDead || !canRestart(stats.deathTics)) return false;
    newGame();
    return true;
  };

  menu = new Menu(settings, {
    // Chamados dentro do handler do teclado ou do clique: o pedido de pointer lock é um gesto válido.
    onSound: (name) => audio.play(name),
    newGame,
    resume: () => { controls.requestLock(); },
    toggleFullscreen,
    isFullscreen: () => Boolean(document.fullscreenElement),
    openTuning: () => openTuning(),
    statsAction: (id) => {
      switch (id) {
        case 'healthUp': if (!stats.isDead) stats.addHealth(10); break;
        // Etapa 19: dano de teste pela regra do jogo (armadura incluída), sem atacante.
        case 'damage10': damagePlayer(10, 'debug', 'debug', null); break;
        case 'damage25': damagePlayer(25, 'debug', 'debug', null); break;
        case 'killPlayer': damagePlayer(1000, 'debug', 'debug', null); break;
        case 'armorUp': stats.addArmor(25); break;
        case 'ammoUp': stats.addAmmo(10); break;
        case 'resetStats':
          stats.reset();
          face.reset();
          if (weapons.state === 'dead') startRaise(weapons, PISTOL); // reviver levanta a pistola
          break;
        case 'resetMonsters': resetCombat(); resetItems(); break;
        case 'killAll': monsters.killAll(); break; // conta como morte, não como acerto
        case 'giveKeys': for (const k of KEY_NAMES) stats.keys[k] = true; break;
        case 'giveAmmo': for (const type of AMMO_TYPES) stats.ammo[type] = stats.maxAmmoOf(type); break;
        case 'giveWeapons': // slots 3 a 7, mochila e munição cheia (com a mochila, o máximo dobra)
          for (let slot = 3; slot <= 7; slot++) stats.weaponsOwned.add(slot);
          stats.hasBackpack = true;
          for (const type of AMMO_TYPES) stats.ammo[type] = stats.maxAmmoOf(type);
          break;
      }
    },
  });
  document.addEventListener('fullscreenchange', () => { menu.dirty = true; });

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
    if (tuningPanel.isOpen && e.code === 'Escape') {
      e.preventDefault();
      closeTuning();
      return;
    }
    if (menuVisible() && menu.handleKey(e)) e.preventDefault();
    else if (!menuVisible() && e.code === 'Enter' && !e.repeat && tryRestart()) e.preventDefault(); // etapa 19
  });

  controls = new Controls(canvas, {
    onLook: (dx, dy) => {
      if (stats.isDead) return; // etapa 19: morto, a câmera só vira para o assassino
      camera.look(dx, dy, BASE_MOUSE_SENS * levelScale(settings.get('mouseSensitivityLevel')));
    },
    isBlocked: menuVisible,
    // Clique no canvas: antes do jogo começar equivale a NEW GAME; depois, retoma sem reposicionar.
    onClick: () => {
      if (tuningPanel.isOpen) return; // no modo de calibragem o mouse é do painel
      if (!menu.started) menu.activate({ type: 'action', id: 'newGame' });
      else controls.requestLock();
    },
    onLockChange: (locked) => {
      if (locked) {
        menu.setResumeFailed(false);
        if (lockReason === 'resume' && menu.started) audio.play('swtchx'); // fechou o menu para retomar
        lockReason = 'resume';
      } else {
        // Perdeu o lock (inclusive por Esc): menu na tela principal, com "swtchn" se o jogo já começou.
        // Ao abrir a calibragem o menu não aparece, então fica em silêncio.
        menu.open({ silent: tuningPanel.isOpen });
        setHelp(false);
      }
      applyHud();
    },
    onLockError: () => {
      if (menu.started) menu.setResumeFailed(true);
      lockReason = 'resume'; // o próximo retorno ao jogo volta a ser um "retomar"
    },
    onAction: (action) => {
      switch (action) {
        case 'fullscreen': toggleFullscreen(); break;
        case 'help': setHelp(helpPanel.style.display === 'none'); break;
        case 'tuning': if (tuningPanel.isOpen) closeTuning(); else openTuning(); break;
        case 'toggleMoveMode': settings.toggle('moveMode'); break;
        case 'toggleMute': settings.toggle('muted'); break;
        case 'sensDown': stepLevel('mouseSensitivityLevel', -1); break;
        case 'sensUp': stepLevel('mouseSensitivityLevel', +1); break;
        case 'speedDown': stepLevel('flySpeedLevel', -1); break;
        case 'speedUp': stepLevel('flySpeedLevel', +1); break;
        case 'use': tryRestart(); break; // etapa 19: fora da morte, "usar" ainda não faz nada
        case 'weaponNext': if (menu.started) cycleWeapon(weapons, stats, +1); break;
        case 'weaponPrev': if (menu.started) cycleWeapon(weapons, stats, -1); break;
        case 'weapon1': case 'weapon2': case 'weapon3': case 'weapon4':
        case 'weapon5': case 'weapon6': case 'weapon7':
          selectWeapon(ACTION_KEYS[action].slot);
          break;
        // Os demais nomes de ação são as próprias chaves de Settings.
        default: settings.toggle(action);
      }
    },
  });
  applyHud();

  const onOff = (v) => (v ? 'on' : 'off');
  const key = (action) => ACTION_KEYS[action].label;
  // Linha do HUD do movimento: modo, altura dos pés, chão sob o jogador e se está no chão.
  // eyeZ: altura do olho (coordenadas do Doom); sec: setor sob a câmera.
  function movementHud(eyeZ, sec) {
    const walking = settings.get('moveMode') === 'walk';
    const feet = walking ? walker.z : eyeZ - EYE_HEIGHT;
    const floor = walking ? walker.floorz : sec?.floorHeight;
    const status = walking ? (walker.z > walker.floorz ? 'caindo' : 'no chão') : '-';
    return `movimento(${key('toggleMoveMode')}) ${walking ? 'andar' : 'voar'}  pés ${feet.toFixed(0)}  ` +
      `chão ${floor ?? '-'}  ${status}\n`;
  }
  // Linha da IA: acordados/total, distância ao acordado mais próximo e dano que seria causado.
  function monsterHud(px, py) {
    const awake = monsters.monsters.filter((m) => m.shootable && (m.state === 'chase' || m.state === 'melee' || m.state === 'missile'));
    const nearest = awake.length ? Math.min(...awake.map((m) => aproxDist(m.x - px, m.y - py))) : null;
    const d = playerDamage.byKind;
    return `IA ${settings.get('monsterAI') ? 'on' : 'off'}${settings.get('noTarget') ? ' (sem alvo)' : ''}  ` +
      `acordados ${awake.length}/${monsters.monsters.filter((m) => m.aiDef).length}  ` +
      `mais próximo ${nearest === null ? '-' : nearest.toFixed(0)}  alertados ${monsterAI.alertedSectors().length}\n` +
      `dano recebido: hitscan ${d.hitscan}, corpo a corpo ${d.melee}, explosão ${d.explosion}, ` +
      `teste ${d.debug ?? 0}; absorvido pela armadura ${playerDamage.absorbed}\n`;
  }
  function updateHud(fps) {
    if (!settings.get('hud') || menuVisible()) return;
    const [x, y, z] = worldToDoom(...camera.pos);
    const ssi = findSubsector(map, x, y);
    const si = findSector(map, x, y);
    const sec = map.sectors[si];
    const lightnum = sec ? Math.floor(sec.lightLevel / 16) : '-';
    hud.textContent =
      `pos  ${x.toFixed(0)}, ${y.toFixed(0)}, ${z.toFixed(0)}\n` +
      `ang  ${yawToDoomAngle(camera.yaw).toFixed(0)}°\n` +
      `ssec ${ssi}  setor ${si}` + (sec ? `  chão ${sec.floorHeight}  teto ${sec.ceilingHeight}` : '') + '\n' +
      (sec ? `flat ${sec.floorTexture} / ${sec.ceilingTexture}  luz ${sec.lightLevel} (lightnum ${lightnum})\n` : '') +
      `textura ${onOff(settings.get('textured'))}  cor setor ${onOff(settings.get('sectorColors'))}  ` +
      `culling ${onOff(settings.get('culling'))}  céu ${onOff(settings.get('skyTest'))} (só no menu)\n` +
      `luz(${key('lighting')}) ${onOff(settings.get('lighting'))}  CRT(${key('crt')}) ${onOff(settings.get('crt'))}\n` +
      `visual(${key('visualMode')}) ${display.modeLabel}  interna ${display.internal.width}x${display.internal.height}\n` +
      `correr(${key('run')}) ${onOff(controls.running)}  velocidade ${settings.get('flySpeedLevel')}  ` +
      `sensibilidade ${settings.get('mouseSensitivityLevel')}\n` +
      `partículas(${key('particles')}) ` +
      (particles ? `${onOff(settings.get('particles'))} ${particleParams.get('count')}/${MAX_PARTICLES}` : 'indisponíveis') +
      (tuningPanel.isOpen ? `  calibragem(${key('tuning')})` : '') + '\n' +
      movementHud(z, sec) +
      `vida ${stats.health}  armadura ${stats.armor} (tipo ${stats.armorType})  ` +
      `${stats.isDead ? `MORTO há ${stats.deathTics} tics` : 'vivo'}${settings.get('godMode') ? '  GOD MODE' : ''}\n` +
      `damageCount ${stats.damageCount}  bonusCount ${stats.bonusCount}  ` +
      `paleta de flash ${flashPalette(stats.damageCount, stats.bonusCount)}${settings.get('screenFlashes') ? '' : ' (flashes off)'}  ` +
      (hudAvailable
        ? `arma ${WEAPONS[weapons.current].name}  pendente ${weapons.pending ? WEAPONS[weapons.pending].name : '-'}  ` +
          `fase ${WEAPON_STATE_LABEL[weapons.state]}  tics ${weapons.state === 'fire' ? weapons.stateTics : '-'}`
        : 'arma indisponível') + '\n' +
      `munição ${AMMO_TYPES.map((t) => `${t} ${stats.ammo[t]}/${stats.maxAmmoOf(t)}`).join('  ')}` +
      `${stats.hasBackpack ? '  mochila' : ''}\n` +
      `itens ${itemSystem.collectedCountable}/${itemSystem.totalCountable}  largados ${itemSystem.drops.length}  ` +
      `chaves ${KEY_NAMES.filter((k) => stats.keys[k]).join(' ') || '-'}\n` +
      `mortos ${combat.kills}/${combat.totalMonsters}  disparos ${combat.shots}  acertos ${combat.hits}\n` +
      monsterHud(x, y) +
      `som(${key('toggleMute')}) ${onOff(!settings.get('muted'))} vol ${settings.get('sfxVolumeLevel')}/${MAX_VOLUME_LEVEL} ` +
      `canais ${audio.getStats().channelsActive}/${MAX_CHANNELS}${audio.getStats().running ? '' : ' (aguardando clique)'}\n` +
      `sprites(${key('sprites')}) ` + (sprites
        ? `${onOff(settings.get('sprites'))} ${spriteScene.objects.length} objetos / ${spriteScene.types.size} tipos`
        : 'indisponíveis') + '\n' +
      `fps  ${fps.toFixed(0)}   ${key('help')}: ajuda`;
  }

  let last = performance.now();
  let fps = 60;
  let lastSkull = -1;
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1); // limita dt para não "teleportar" após travadas
    last = now;
    if (dt > 0) fps += (1 / dt - fps) * 0.05; // média móvel para o número não pular

    display.update();
    loading.style.display = 'none';
    const showMenu = menuVisible();
    if (!showMenu) gameTime += dt;
    if (tuningPanel.isOpen) {
      // Modo de calibragem: as setas giram a câmera (mesmo limite de pitch do mouse).
      const look = controls.lookVector();
      const turn = TURN_RATE * dt;
      camera.look(look.yaw * turn, -look.pitch * turn, 1);
    }
    if (!showMenu) {
      const speed = BASE_FLY_SPEED * levelScale(settings.get('flySpeedLevel')) * (controls.running ? RUN_MULT : 1);
      if (settings.get('moveMode') === 'walk') {
        // Andar: WASD no plano horizontal (Space e C ignorados), com colisão e gravidade.
        // A física só roda com o jogo iniciado (o menu fechado já é garantido por showMenu).
        if (menu.started) {
          const mv = stats.isDead ? { f: 0, s: 0, u: 0 } : controls.moveVector(); // morto: só gravidade
          const sinY = Math.sin(camera.yaw), cosY = Math.cos(camera.yaw);
          // No Doom: frente = (sin yaw, cos yaw), direita = (cos yaw, -sin yaw) (inverso de doomToWorld).
          const wish = { vx: (mv.f * sinY + mv.s * cosY) * speed, vy: (mv.f * cosY - mv.s * sinY) * speed };
          getSolids(frameSolids, monsters.monsters, fixedSolids); // monstros e barris vivos + decoração
          for (const ev of stepPlayer(walker, wish, dt, physicsWorld, frameSolids)) {
            if (ev.type === 'landed' && ev.impactSpeed > OOF_IMPACT_SPEED) audio.play('oof', { origin: 'player' });
          }
          syncCameraToWalker();
        }
      } else {
        if (!stats.isDead) camera.move(controls.moveVector(), speed, dt); // voar: comportamento da etapa 11
      }
    }
    const tics = gameTics(gameTime);
    if (!showMenu && menu.started) {
      // Balanço: velocidade horizontal real da física de andar; zero voando ou no ar.
      const walking = settings.get('moveMode') === 'walk';
      const onGround = walking && walker.z <= walker.floorz;
      updateSwayAmplitude(weapons, walking ? (walker.hspeed ?? 0) : 0, BASE_FLY_SPEED, onGround, dt);
      for (const ev of updateWeapons(weapons, { fire: controls.firing }, stats, lastPistolTic, tics)) {
        if (ev.type === 'fire') handleFire(ev);
      }
      // Monstros e efeitos avançam um passo por tic de jogo (parados com o menu aberto).
      // Etapa 16: mortes viram itens largados; depois, coleta pelos pés do jogador.
      const [px, py, eyeZ] = worldToDoom(...camera.pos);
      const feet = { x: px, y: py, z: walking ? walker.z : eyeZ - EYE_HEIGHT };
      for (let t = lastPistolTic; t < tics; t++) {
        monsters.tick();
        effects.tick();
        for (const ev of monsters.takeEvents()) if (ev.type === 'died') itemSystem.onMonsterDied(ev);
        // Etapa 19: morreu neste tic (monstro ou barril): a arma desce e os pés ficam onde estavam.
        if (stats.isDead && weapons.state !== 'dead') {
          killWeapons(weapons);
          deathFeet = feet.z;
          fireReleasedSinceDeath = false;
        }
        if (stats.isDead) {
          stats.deathTics++;
          // Gira até 5 graus por tic para o assassino (P_DeathThink).
          if (stats.lastAttacker) {
            const target = angleTo(px, py, stats.lastAttacker.x, stats.lastAttacker.y);
            camera.yaw = doomAngleToYaw(turnTowards(yawToDoomAngle(camera.yaw), target).angle);
          }
        }
        stats.tickDamage();
        face.tick();
        for (const ev of itemSystem.update(feet, stats)) {
          if (ev.weaponGained) face.onWeaponGained(); // sorriso por 70 tics
          audio.play(ev.sound, { origin: 'player' });
          pickupMessage = ITEM_TEXT[MENU_LANG][ev.messageKey] ?? ev.messageKey;
          messageTics = MESSAGE_TICS;
          autoSwitchOnPickup(weapons, ev, stats); // etapa 17: arma nova ou munição que saiu do zero
        }
        stats.tickBonus();
        if (messageTics > 0 && --messageTics === 0) pickupMessage = '';
      }
    }
    lastPistolTic = tics;
    // Etapa 19: olho caindo na morte; clique (disparo solto e apertado de novo) reinicia.
    if (menu.started && !showMenu) {
      eyeOffset = stats.isDead ? deathEyeHeight(stats.deathTics, EYE_HEIGHT) : EYE_HEIGHT;
      if (stats.isDead) {
        if (settings.get('moveMode') === 'walk') syncCameraToWalker();
        else {
          const [cx, cy] = worldToDoom(...camera.pos);
          camera.pos = doomToWorld(cx, cy, deathFeet + eyeOffset);
        }
        if (!controls.firing) fireReleasedSinceDeath = true;
        else if (fireReleasedSinceDeath) tryRestart();
      }
    }
    // Flash de tela: dano tem prioridade sobre o bônus; desligado com FLASHES OFF.
    display.setTint(tintFor(tintTable, flashPalette(stats.damageCount, stats.bonusCount), settings.get('screenFlashes')));
    for (const ev of monsters.takeEvents()) if (ev.type === 'died') itemSystem.onMonsterDied(ev); // ex.: KILL ALL
    // Ouvinte do som: posição e ângulo da câmera em coordenadas do Doom (0 = leste, 90 = norte).
    const [listenerX, listenerY] = worldToDoom(...camera.pos);
    audio.setListener({ x: listenerX, y: listenerY, angleDeg: yawToDoomAngle(camera.yaw) });
    updateHud(fps);

    // Menu: recompõe a imagem só quando está suja ou quando o quadro da caveira muda.
    if (showMenu) {
      const time = now / 1000;
      const skull = skullFrame(time);
      if (menu.dirty || skull !== lastSkull) {
        menuPass.upload(composeMenu(menu.snapshot(), menuAssets, time));
        menu.dirty = false;
        lastSkull = skull;
      }
    }
    // Tela de título com TITLEPIC: a cena 3D não é desenhada (o menu limpa de preto).
    const drawScene = !(showMenu && !menu.started && menuAssets.patches.TITLEPIC);

    const proj = perspective(FOVY, display.projectionAspect, NEAR, far);
    const view = camera.viewMatrix();
    const viewProj = multiply(proj, view);
    uniformF32.set(viewProj, 0);
    uniformF32.set([...camera.pos, 1], 16);
    uniformU32[20] = settings.get('textured') ? 1 : 0;
    uniformU32[21] = settings.get('lighting') ? 1 : 0;
    uniformU32[22] = settings.get('skyTest') ? 1 : 0;
    uniformU32[23] = textureSet.sky.layer;
    device.queue.writeBuffer(uniformBuffer, 0, uniformData);

    // Passada 1: cena na resolução interna. Passada 2 (só com o menu aberto): menu na mesma textura.
    // Passada 3: blit/CRT para o canvas. Mesmo encoder.
    const encoder = device.createCommandEncoder();

    // Partículas: só com o jogo iniciado e a cena desenhada; com o menu aberto ou "Congelar
    // partículas", a simulação usa dt = 0.
    const p = particleParams.get();
    const particleCount = Math.min(p.count, MAX_PARTICLES);
    const drawParticles = Boolean(particles) && settings.get('particles') && menu.started && drawScene && particleCount > 0;
    if (drawParticles) {
      const time = (now - startTime) / 1000;
      const seed = Array.from({ length: 4 }, () => Math.floor(Math.random() * 0xffffffff)); // por frame, como no exemplo
      const frozen = showMenu || tuningPanel.diagnostics.freeze;
      particles.writeUniforms(
        packSimUniforms(p, { deltaTime: frozen ? 0 : dt, time, generation: particleGeneration, seed, cameraPos: camera.pos }),
        packRenderUniforms(p, {
          viewProj, internalWidth: display.internal.width, internalHeight: display.internal.height, time,
          palette: particlePalette, lighting: settings.get('lighting'), noFade: tuningPanel.diagnostics.noFade,
        }),
      );
      particles.encodeCompute(encoder, particleCount); // 1. simulação, antes da cena
    }
    if (drawScene) {
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: display.colorView,
          clearValue: CLEAR_COLOR,
          loadOp: 'clear',
          storeOp: 'store',
        }],
        depthStencilAttachment: {
          view: display.depthView,
          depthClearValue: 1.0,
          depthLoadOp: 'clear',
          depthStoreOp: 'store',
        },
      });
      pass.setPipeline(settings.get('culling') ? pipelines.back : pipelines.none);
      pass.setBindGroup(0, bindGroup);
      pass.setBindGroup(1, textureSet.bindGroup);
      pass.setVertexBuffer(0, vertexBuffer);
      pass.setIndexBuffer(indexBuffer, 'uint32');
      pass.drawIndexed(walls.indices.length);
      // Chão e teto: mesmo pipeline, outros buffers.
      pass.setVertexBuffer(0, settings.get('sectorColors') ? flatVertexBuffers.sector : flatVertexBuffers.flat);
      pass.setIndexBuffer(flatIndexBuffer, 'uint32');
      pass.drawIndexed(flats.indices.length);
      pass.end();
    }
    // Sprites: depois da cena e antes das partículas; com o menu aberto, a animação para.
    if (sprites && settings.get('sprites') && menu.started && drawScene && spriteScene.objects.length > 0) {
      const [camX, camY] = worldToDoom(...camera.pos);
      const count = writeSpriteInstances(sprites.instanceData, spriteItems(tics), { x: camX, y: camY });
      // Direita horizontal da câmera (sem pitch): os sprites ficam de pé e alinhados ao plano da tela.
      const right = [Math.cos(camera.yaw), 0, Math.sin(camera.yaw)];
      sprites.writeUniforms(viewProj, right, camera.pos, settings.get('lighting'));
      sprites.writeInstances(count);
      sprites.encodeDraw(encoder, display.colorView, display.depthView, count);
    }
    if (drawParticles) {
      particles.encodeDraw(encoder, display.colorView, display.depthView, particleCount); // 3. depois da cena
    }
    // Pistola e barra: depois das partículas e antes do menu (o menu fica por cima).
    if (hudAvailable && menu.started) {
      const [cx, cy] = worldToDoom(...camera.pos);
      const under = map.sectors[findSector(map, cx, cy)];
      const lightnum = under ? Math.min(15, Math.max(0, Math.floor(under.lightLevel / 16))) : 15;
      const weapon = weaponView(weapons);
      const weaponLevel = weaponLightLevel(lightnum, settings.get('lighting'));
      // Recompõe só quando algo visível muda (números, quadro e posição da arma, luz, rosto).
      const [fx, fy] = worldToDoom(...camera.pos);
      const faceName = face.lump(stats, { x: fx, y: fy, angle: yawToDoomAngle(camera.yaw) }, settings.get('godMode'), hudAssets.patches);
      const restartText = stats.isDead && canRestart(stats.deathTics) ? MENU_TEXT[MENU_LANG].restartPrompt : '';
      const hudKey = [Math.max(0, stats.health), stats.armor, faceName, restartText, AMMO_TYPES.map((t) => `${stats.ammo[t]}/${stats.maxAmmoOf(t)}`).join(','),
        KEY_NAMES.map((k) => (stats.keys[k] ? 1 : 0)).join(''), [...stats.weaponsOwned].join(','), pickupMessage,
        weapon.prefix, weapon.frame, weapon.flash ? weapon.flash.prefix + weapon.flash.letter : '',
        weapon.sx.toFixed(2), weapon.sy.toFixed(2), weaponLevel].join('|');
      if (hudKey !== lastHudKey) {
        hudPass.upload(composeHud({ stats, weapon, weaponLevel, message: pickupMessage, face: faceName, restartText }, hudAssets, tics));
        lastHudKey = hudKey;
      }
      hudPass.draw(encoder, display.colorView, display.internal.width, display.internal.height);
    }
    if (showMenu) {
      menuPass.draw(encoder, display.colorView, display.internal.width, display.internal.height, !drawScene);
    }

    display.blit(encoder);
    device.queue.submit([encoder.finish()]);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// Erros visíveis: handlers globais e init em try/catch (quadro vermelho em src/ui/errorOverlay.js).
installErrorOverlay();
async function init() {
  try {
    await main();
  } catch (err) {
    reportError(err);
    showError(err.message);
  }
}
init();
