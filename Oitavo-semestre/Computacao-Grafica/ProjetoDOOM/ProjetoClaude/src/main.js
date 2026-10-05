import { initWebGPU } from './gpu.js';
import { perspective, multiply } from './mat4.js';
import { Camera, VIEW_HEIGHT, FOVY, BASE_MOUSE_SENS, BASE_FLY_SPEED, RUN_MULT, levelScale } from './camera.js';
import { settings } from './core/Settings.js';
import { Controls, ACTION_KEYS } from './input/Controls.js';
import { WadFile } from './wad/WadFile.js';
import { readPalette } from './wad/Textures.js';
import { TextureCache } from './wad/TextureCache.js';
import { loadColormap, buildLitPalette } from './wad/Colormap.js';
import { createTextureBindGroupLayout, createLitPaletteTexture } from './gpu/TextureSet.js';
import { buildLevelData } from './game/LevelData.js';
import { uploadLevel, liveCounts } from './gpu/LevelGpu.js';
import { createLevelRuntime } from './game/LevelRuntime.js';
import { GameSession, listMaps } from './game/GameSession.js';
import { nextMap, secretReturnFrom, applyPlayerEntry, LEVEL_ENTRY } from './game/GameFlow.js';
import { skillParams, clampSkill, scaleDamage } from './game/skill.js';
import { Intermission } from './game/Intermission.js';
import { loadIntermissionAssets, composeIntermission } from './hud/IntermissionRenderer.js';
import { Finale, composeFinale, loadFinaleFlat } from './game/Finale.js';
import { Display, SCENE_FORMAT, DEPTH_FORMAT } from './gpu/Display.js';
import { createCheckedShaderModule, fetchText } from './gpu/shaderModule.js';
import { MenuPass } from './gpu/MenuPass.js';
import { ParticlePass } from './gpu/ParticlePass.js';
import { SpriteSet } from './gpu/SpriteSet.js';
import { HudPass } from './gpu/HudPass.js';
import { PlayerStats, AMMO_TYPES, KEY_NAMES } from './game/PlayerStats.js';
import { ITEM_TABLE } from './game/itemTable.js';
import { ITEM_TEXT } from './game/itemText.js';
import { getSolids } from './physics/solids.js';
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
import { writeSpriteInstances, frameAt, gameTics, INSTANCE_STRIDE } from './sprites/spriteLogic.js';
import { Rng } from './game/Rng.js';
import { aproxDist } from './game/aiTable.js';
import { PlayerDamageSink } from './game/PlayerDamageSink.js';
import { applyDamage, deathSound } from './game/PlayerDamage.js';
import { deathEyeHeight, turnTowards, canRestart } from './game/PlayerDeath.js';
import { FaceState } from './hud/face.js';
import { computeTintTable, flashPalette, tintFor } from './gpu/palettesTint.js';
import { angleTo } from './game/MonsterAI.js';
import { effectFrame } from './game/effects.js';
import { MAX_PARTICLES, paletteIndices, packSimUniforms, packRenderUniforms } from './particles/particleConfig.js';
import { ParticleParams } from './particles/ParticleParams.js';
import { TuningPanel } from './ui/TuningPanel.js';
import { installErrorOverlay, reportError } from './ui/errorOverlay.js';
import { loadMenuAssets } from './menu/MenuAssets.js';
import { Menu } from './menu/Menu.js';
import { composeMenu, skullFrame } from './menu/MenuRenderer.js';
import { MENU_LANG, MENU_TEXT } from './menu/menuText.js';
import { targetsFit } from './game/LevelState.js';
import { markSeen, hfovDeg } from './automap/seen.js';
import { automapColorsFor } from './hud/HudRenderer.js';
import { CheatReader, giveAll, toggleGod, myPosText } from './game/Cheats.js';
import { useLines, crossLines, monsterUseDoor, tickLevel, openAllDoors, CrossTracker } from './game/UseLines.js';
import { VERTEX_STRIDE, VERTEX_ATTRIBUTES } from './map/vertexLayout.js';
import { distanceInside } from './map/buildFlats.js';
import { findSector, findSubsector } from './map/bsp.js';
import { EYE_HEIGHT, PLAYER_RADIUS, createPlayerState, stepPlayer, enterWalk } from './physics/collision.js';
import { doomToWorld, worldToDoom, doomAngleToYaw, yawToDoomAngle } from './map/coords.js';

const WAD_URL = new URL('../assets/freedoom1.wad', import.meta.url);

const NEAR = 1;
const CLEAR_COLOR = { r: 0.15, g: 0.15, b: 0.15, a: 1 };

function showError(text) {
  const el = document.getElementById('msg');
  el.textContent = text;
  el.style.display = 'flex';
  console.error(text);
}

// Etapa 23: espera o navegador pintar um quadro (o texto de carregamento aparece antes do trabalho pesado).
const nextPaint = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

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

  // --- WAD e sessão (etapa 23): lista de mapas do WAD, fase, dificuldade e mapa atual ---
  const wad = await WadFile.fromUrl(WAD_URL);
  const session = new GameSession(listMaps(wad));
  console.log(`Mapas: ${session.maps.length} (${session.maps.map((m) => m.name).join(' ')})`);

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

  // --- Paleta, colormap e cache de texturas (globais, etapa 23: criados uma vez para todos os níveis) ---
  // PLAYPAL (paleta 0: 256 cores RGB) e COLORMAP (34 tabelas de 256 índices, uma por nível de luz) viram a
  // paleta iluminada 256x32 da GPU. TEXTURE1/PNAMES, patches e flats decodificados ficam no TextureCache.
  const palette = readPalette(wad);
  const colormap = loadColormap(wad);
  const litPalette = buildLitPalette(palette, colormap);
  const levelCache = { textures: new TextureCache(), spriteLumps: null };
  const textureLayout = createTextureBindGroupLayout(device);
  device.pushErrorScope('validation');
  const paletteTex = createLitPaletteTexture(device, litPalette);
  const paletteError = await device.popErrorScope();
  if (paletteError) throw new Error(`paleta iluminada: ${paletteError.message}`);

  // Etapa 22: automapa e noclip (só da sessão).
  let noClip = false;
  const AUTOMAP_CODES = new Set(['KeyF', 'KeyG', 'Equal', 'Minus', 'Digit0']); // com função própria no automapa
  const automapHeld = new Set(); // + e - pressionados (zoom contínuo)
  {
    const colors = automapColorsFor(palette);
    console.log('Automapa: cores (índice da paleta 0 e RGB real)');
    console.table(Object.fromEntries(Object.entries(colors).map(([k, c]) => [k, { indice: c.index, rgb: c.rgb.join(', ') }])));
  }

  // --- Nível atual (etapa 23): tudo que depende do mapa. Preenchido por installLevel e trocado inteiro
  // por startLevel (o próximo nível é montado antes; o atual só é descartado depois da troca). ---
  let current = null; // { data, gpu, rt }
  let loadingLevel = false; // startLevel em andamento (uma troca por vez)
  let map, spawn, sector, far;
  let textureSet, walls, flats, staticBuffers, dynamic;
  let movingEnabled = true; // falso no nível cujos buffers dinâmicos falharam
  let level, specialsInfo, automap, physicsWorld;
  let spriteScene, sprites;
  let effects, combat, monsters, itemSystem, liftSectorOf, fixedSolids, missiles, monsterAI, amSolids;

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
  // Etapa 23: na intermissão e no fim de episódio o mouse fica solto sem abrir o menu; ele só aparece
  // por cima quando o jogador aperta Esc (menuOverlay).
  const screenPhase = () => session.phase === 'intermission' || session.phase === 'finale';
  let menuOverlay = false;
  const menuVisible = () => (screenPhase() ? menuOverlay : !controls.locked && !tuningPanel.isOpen);

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
  const GROUP_LINES = { weapons: '1 a 7  armas (1 a 5 utilizáveis)', wheel: 'Roda   próxima / anterior arma',
    tuning: 'Setas  girar a câmera (calibragem)' };
  helpPanel.textContent =
    [...new Set(Object.values(ACTION_KEYS).map((k) => (k.group ? GROUP_LINES[k.group] : `${k.label.padEnd(7)}${k.desc}`)))].join('\n') +
    '\nEsc    abrir o menu' +
    '\nNo automapa: F seguir, G grade, + e - zoom, 0 mapa inteiro, setas mover (sem seguir)';
  const setHelp = (visible) => { helpPanel.style.display = visible ? '' : 'none'; };
  setHelp(false);

  console.table(Object.fromEntries(Object.entries(ACTION_KEYS)
    .map(([action, k]) => [action, { tecla: k.label, code: k.code, tipo: k.kind, descricao: k.desc }])));

  const stepLevel = (key, delta) => settings.set(key, Math.min(10, Math.max(1, settings.get(key) + delta)));

  // --- Câmera no início do jogador 1 ---
  const camera = new Camera([0, 0, 0]);
  // Posição e ângulo do THING 1 (etapa 3); também usado pelo NEW GAME.
  // Física do modo andar (etapa 12), em coordenadas do Doom; a câmera fica no olho (pés + EYE_HEIGHT).
  // O mundo da física (physicsWorld) é do nível (LevelRuntime); o jogador (walker) é recriado em cada um.
  const crossTracker = new CrossTracker();       // etapa 20: cruzamento só entre estados contínuos
  let walker = null;
  let eyeOffset = EYE_HEIGHT; // etapa 19: desce até 6 na morte
  const syncCameraToWalker = () => { camera.pos = doomToWorld(walker.x, walker.y, walker.z + eyeOffset); };

  function resetToSpawn() {
    camera.pos = doomToWorld(spawn.x, spawn.y, sector.floorHeight + VIEW_HEIGHT);
    camera.yaw = doomAngleToYaw(spawn.angle);
    camera.pitch = 0;
    walker = createPlayerState(physicsWorld, spawn.x, spawn.y); // pés no chão do ponto de início
    eyeOffset = EYE_HEIGHT;
    crossTracker.invalidate();
  }

  // Troca de modo (tecla G ou menu): voar -> andar parte do olho atual; andar -> voar mantém o olho.
  settings.subscribe('moveMode', (mode) => {
    if (mode !== 'walk') return;
    const [x, y, eyeZ] = worldToDoom(...camera.pos);
    walker = enterWalk(physicsWorld, x, y, eyeZ);
    crossTracker.invalidate(); // troca discreta de posição: não conta como cruzamento
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
  const particles = await ParticlePass.create(device, particleModule, paletteTex.view); // etapa 23: paleta global
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
    particlePalette = paletteIndices(palette, p);
    const rgb = (i) => Array.from(palette.subarray(i * 3, i * 3 + 3)).join(', ');
    console.log(`Partículas: cores ${colors} -> índices poeira ${particlePalette.dust} (${rgb(particlePalette.dust)}), ` +
      `brasa quente ${particlePalette.emberHot} (${rgb(particlePalette.emberHot)}), ` +
      `brasa fria ${particlePalette.emberCold} (${rgb(particlePalette.emberCold)})`);
  });
  particleParams.notify();
  let particleGeneration = 1; // "Reiniciar partículas" incrementa; o shader faz renascer as de outra geração
  const startTime = performance.now();

  const rng = new Rng(Date.now()); // gerador próprio (não é a tabela de 256 números do Doom)

  // --- Pipeline dos sprites (etapa 11; etapa 23: global, criada uma vez). Cada nível cria só os recursos. ---
  let spritePipeline = null;
  try {
    const spriteCode = await fetchText(new URL('./shaders/sprites.wgsl', import.meta.url));
    // walls.wgsl vem antes para reaproveitar lightLevel() (mesma regra de luz das paredes).
    const spriteModule = await createCheckedShaderModule(device, 'sprites', [
      { name: 'walls.wgsl', code: sceneCode },
      { name: 'sprites.wgsl', code: spriteCode },
    ]);
    device.pushErrorScope('validation');
    let pipeError = null;
    try {
      spritePipeline = await SpriteSet.createPipeline(device, spriteModule);
    } catch (err) {
      pipeError = err;
    }
    pipeError = pipeError ?? await device.popErrorScope();
    if (pipeError) throw pipeError;
  } catch (err) {
    console.error('Sprites desligados nesta sessão: falha na pipeline.', err);
    reportError(err);
    spritePipeline = null;
  }
  let gameTime = 0; // relógio de jogo (s): não avança com o menu aberto

  // --- Jogador: estado, dano, morte e rosto (etapa 19) ---
  const stats = new PlayerStats();
  // Etapa 23: parâmetros da dificuldade da sessão (skill.js); a munição dobrada vale para giveAmmo.
  let skill = skillParams(session.skill);
  function setSkill(n) {
    session.skill = clampSkill(n);
    skill = skillParams(session.skill);
    stats.ammoScale = skill.ammoScale;
  }
  setSkill(session.skill);
  const playerDamage = new PlayerDamageSink(); // contadores por origem para o HUD de texto
  const face = new FaceState();
  let deathFeet = 0;             // altura dos pés na morte (modo voar)
  let fireReleasedSinceDeath = false;
  // Todo dano ao jogador passa por aqui (monstros, barris e depuração). attacker: { x, y } ou null.
  function damagePlayer(amount, source, kind, attacker) {
    amount = scaleDamage(amount, skill); // etapa 23: metade do dano na dificuldade 1, antes da armadura
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
  const frameSolids = []; // reaproveitado a cada frame
  // Pés do jogador (IA, projéteis e coleta): no modo andar, a física; voando, olho - 41.
  const playerFeet = () => {
    const [px, py, eyeZ] = worldToDoom(...camera.pos);
    // Andando, a física (o corpo ainda cai); voando, os pés guardados na morte ou olho - 41.
    const z = settings.get('moveMode') === 'walk' ? walker.z : stats.isDead ? deathFeet : eyeZ - EYE_HEIGHT;
    return { x: px, y: py, z, alive: !stats.isDead };
  };
  // Etapa 23: o que o nível (LevelRuntime) precisa do resto do jogo, sempre lido na hora.
  const runtimeDeps = {
    rng,
    aiEnabled: () => settings.get('monsterAI'),
    noTarget: () => settings.get('noTarget'),
    sound: (name, opts) => audio.play(name, opts),
    damagePlayer,
    playerFeet,
    playerTarget,
    useDoor: (m, li) => monsterOpensDoor(m, li), // etapa 20: só portas do especial 1
  };
  settings.subscribe('monsterAI', (on) => monsters?.setAIEnabled(on));

  let pickupMessage = '';  // mensagem de coleta mostrada na barra
  let messageTics = 0;     // tics restantes da mensagem (140 = 4 segundos)
  const MESSAGE_TICS = 140;
  const resetItems = () => {
    itemSystem.reset();
    for (const it of itemSystem.items) it.floorZ = it.origFloorZ;
    pickupMessage = '';
    messageTics = 0;
  };
  const resetCombat = () => {
    automap.reset(); // etapa 22 (NEW GAME, reinício e RESET MONSTERS)
    missiles.reset(); // etapa 21
    monsters.reset();
    effects.reset();
    combat.reset();
    playerDamage.reset(); // monsters.reset() também apaga os alertas de setor
  };

  // --- Portas, elevadores, interruptores e saída (etapa 20) ---
  // Alvos para esmagamento: jogador vivo, monstros e barris vivos (corpos, itens e largados não contam).
  const crushTargets = () => {
    const out = [];
    if (!stats.isDead) {
      const [px, py] = worldToDoom(...camera.pos);
      out.push({ sector: findSector(map, px, py), height: 56 });
    }
    for (const m of monsters.monsters) if (m.shootable && !m.removed) out.push({ sector: m.sector, height: m.entry.height });
    return out;
  };
  // Elevador mudou o chão: monstros (vivos e corpos), itens e largados do setor acompanham.
  function carryFloor(s) {
    const floor = map.sectors[s].floorHeight;
    for (const m of monsters.monsters) if (!m.removed && m.sector === s) m.floorZ = floor;
    for (const it of itemSystem.items) if (it.sector === s) it.floorZ = floor;
    for (const d of itemSystem.drops) if (findSector(map, d.x, d.y) === s) d.floorZ = floor;
  }
  const warnedLevel = new Set();
  const levelCtx = {
    get keys() { return stats.keys; },
    get dead() { return stats.isDead; },
    // Setor null = origem do jogador; senão, som posicional no centro do setor.
    sound: (name, s) => (s === null || s === undefined
      ? audio.play(name, { origin: 'player' })
      : audio.play(name, { origin: `sector:${s}`, x: level.soundOrg[s].x, y: level.soundOrg[s].y })),
    message: (key) => { pickupMessage = ITEM_TEXT[MENU_LANG][key] ?? key; messageTics = MESSAGE_TICS; },
    textureExists: (name) => textureSet.wallLayers.has(name),
    warn: (text) => { if (!warnedLevel.has(text)) { warnedLevel.add(text); console.warn(text); } },
    fits: (s, gap) => targetsFit(crushTargets(), s, gap),
    onFloorMoved: carryFloor,
  };
  function monsterOpensDoor(m, li) {
    return movingEnabled && monsterUseDoor(level, li, m, levelCtx);
  }
  function useAction() {
    if (!menu.started || !movingEnabled || session.phase !== 'playing') return;
    const [px, py] = worldToDoom(...camera.pos);
    useLines(level, physicsWorld, { x: px, y: py, angle: yawToDoomAngle(camera.yaw) }, levelCtx);
  }
  const mmss = (tics) => {
    const s = Math.floor(tics / 35);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  // Evento "fire" da máquina de armas (etapa 17): pistola e metralhadora 1 bala, espingarda 7 projéteis,
  // soco a 64 unidades. Um evento conta como 1 disparo; acerto se algum projétil pegar monstro ou barril.
  function handleFire(ev) {
    combat.shots++;
    if (ev.weapon === 3) audio.play('shotgn', { origin: 'player' });
    else if (ev.weapon === 2 || ev.weapon === 4) audio.play('pistol', { origin: 'player' }); // pistola e metralhadora
    const [ox, oy, oz] = worldToDoom(...camera.pos); // olho do jogador
    monsterAI.noise(findSector(map, ox, oy)); // etapa 18: todo disparo acorda quem ouve
    if (ev.weapon === 5) {
      // Etapa 21: foguete (o som "rlaunc" é do projétil); acerto contado quando o dano direto acontece.
      missiles.spawnFromPlayer(playerFeet(), yawToDoomAngle(camera.yaw), camera.pitch * 180 / Math.PI);
      return;
    }
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

  // Etapa 22: dados do automapa para a camada de HUD (as coisas só com IDDT nível 2).
  function automapView() {
    const [x, y] = worldToDoom(...camera.pos);
    const things = [];
    if (automap.cheat >= 2) {
      for (const m of monsters.monsters) if (m.shootable && !m.removed) things.push({ x: m.x, y: m.y, angle: m.angle ?? 0 });
      for (const it of itemSystem.items) if (!it.collected) things.push({ x: it.x, y: it.y, angle: map.things[it.objIndex]?.angle ?? 0 });
      for (const d of itemSystem.drops) things.push({ x: d.x, y: d.y, angle: 0 });
      for (const o of amSolids) things.push({ x: o.x, y: o.y, angle: o.angle });
    }
    return { state: automap, map, player: { x, y, angle: yawToDoomAngle(camera.yaw) }, things, name: map.name };
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
      const moved = m && (m.x !== obj.x || m.y !== obj.y || m.floorZ !== obj.base[1]);
      const lift = liftSectorOf.get(obj.index); // etapa 20: objeto parado num elevador
      const objBase = !m && lift !== undefined ? doomToWorld(obj.x, obj.y, map.sectors[lift].floorHeight) : obj.base;
      items.push({ x: m ? m.x : obj.x, y: m ? m.y : obj.y, angle: m ? m.angle : obj.angle,
        base: moved ? doomToWorld(m.x, m.y, m.floorZ) : objBase, lightnum: moved ? lightAt(m.x, m.y) : obj.lightnum, views,
        fullbright: obj.type.fullbright || Boolean(f?.fullbright), fuzz: obj.type.fuzz });
    }
    // Itens largados por monstros (etapa 16): quadro A, no chão do setor.
    for (const d of itemSystem.drops) {
      const views = spriteScene.frames.get(ITEM_DROP_PREFIX[d.type] + 'A');
      if (views) items.push({ x: d.x, y: d.y, angle: 0, base: doomToWorld(d.x, d.y, d.floorZ), lightnum: lightAt(d.x, d.y), views, fullbright: false, fuzz: false });
    }
    // Etapa 21: projéteis em voo e explodindo, com z arbitrário e o ângulo do projétil (vistas do foguete).
    for (const p of missiles.list) {
      const f = missiles.frameOf(p);
      const views = spriteScene.frames.get(f.prefix + f.letter);
      if (views) items.push({ x: p.x, y: p.y, angle: p.angle, base: doomToWorld(p.x, p.y, p.z), lightnum: 15, views, fullbright: true, fuzz: false });
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
  // Etapa 23: intermissão (WI*) e fim de episódio (flat FLOOR4_8 e a fonte STCFN).
  const wiAssets = loadIntermissionAssets(wad);
  if (wiAssets.missing.length) console.warn(`Intermissão: lumps ausentes: ${wiAssets.missing.join(', ')}`);
  const finaleAssets = { palette, flat: loadFinaleFlat(wad), font: menuAssets.font };
  if (!finaleAssets.flat) console.warn('Fim de episódio: flat FLOOR4_8 ausente (fundo preto)');
  const weapons = createWeapons({ available: hudAssets?.weaponSlots ?? [PISTOL] });
  const warnedUnusable = new Set(); // aviso único por arma não utilizável
  // Pedido de troca (tecla ou roda); só com o jogo iniciado.
  function selectWeapon(slot) {
    if (!menu.started || session.phase !== 'playing') return;
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

  // --- Fluxo entre mapas (etapa 23) ---
  let intermission = null; // Intermission (tela de estatísticas e "entering")
  let pendingNext = null;  // { episode, map } do próximo mapa enquanto a intermissão aparece
  let finale = null;       // Finale (texto de fim de episódio)
  const T23 = MENU_TEXT[MENU_LANG];

  // Estado do jogador ao entrar num mapa. 'keep': nada muda (RELOAD LEVEL); 'carry': saída da fase
  // (G_PlayerFinishLevel: vida, armadura, armas, munição e mochila passam; chaves e flashes zeram);
  // 'pistol': começo do zero (NEW GAME, IDCLEV e morte). resetCheats: NEW GAME e IDCLEV desligam o
  // modo deus e o noclip (na morte e na troca de fase eles continuam).
  function applyPlayerStart(kind, resetCheats) {
    if (kind === 'carry' && stats.isDead) kind = 'pistol'; // NEXT/PREV MAP com o jogador morto
    applyPlayerEntry(stats, kind);
    if (resetCheats) {
      noClip = false;
      if (settings.get('godMode')) settings.set('godMode', false);
    }
    if (kind === 'keep') return;
    face.reset();
    playerDamage.reset();
    startRaise(weapons, kind === 'pistol' ? PISTOL : weapons.current);
    deathFeet = 0;
    fireReleasedSinceDeath = false;
  }

  // Entra no mapa `entry` ({ name, episode, map }). opts: { player, resetCheats, phase (depois de
  // carregar), failPhase (se falhar; padrão: a fase anterior) }. Devolve a promessa de startLevel.
  function enterMap(entry, opts = {}) {
    return startLevel(entry.name, { ...opts, entry });
  }

  // NEW GAME (menu, etapa 23: com episódio e dificuldade). Chamado dentro do handler do teclado ou do
  // clique: o pedido de pointer lock é um gesto válido; o carregamento vem depois.
  function newGame(episode = session.episode, newSkill = session.skill) {
    lockReason = 'newGame';
    setSkill(newSkill);
    intermission = null;
    finale = null;
    menuOverlay = false;
    session.secretReturn = null;
    controls.clear(); // estado de disparo (e de movimento) limpo
    controls.requestLock();
    const entry = session.find(episode, 1) ?? session.maps.find((m) => m.episode === episode) ?? session.maps[0];
    console.log(`NEW GAME: episódio ${entry.episode}, dificuldade ${session.skill}`);
    enterMap(entry, { ...LEVEL_ENTRY.newGame, phase: 'playing', failPhase: 'playing' });
  }
  // Reinício depois da morte (etapa 19), 35 tics depois: o mapa é montado de novo, começo do zero.
  const tryRestart = () => {
    if (!menu.started || session.phase !== 'playing' || !(stats.isDead && canRestart(stats.deathTics))) return false;
    enterMap(session.current, { ...LEVEL_ENTRY.death, phase: 'playing' });
    return true;
  };

  // Fim da fase (35 tics depois da saída): mapa 8 vai direto ao fim do episódio; senão, intermissão.
  function completeLevel() {
    const fromMap = session.map;
    const next = nextMap(session.episode, fromMap, level.secretExit, (e, m) => session.has(e, m), session.secretReturn);
    const ls = current.rt.levelStats();
    console.log(`${map.name} concluído${level.secretExit ? ' (saída secreta)' : ''}: mortes ${ls.kills}/${ls.totalKills}, ` +
      `itens ${ls.items}/${ls.totalItems}, segredos ${ls.secrets}/${ls.totalSecrets}, tempo ${mmss(ls.tics)}; ` +
      `próximo: ${next.kind === 'map' ? `E${next.episode}M${next.map}` : 'fim do episódio'}`);
    if (next.kind === 'map' && next.map === 9 && fromMap !== 9) session.secretReturn = secretReturnFrom(fromMap);
    if (fromMap === 9) session.secretReturn = null;
    audio.stopAll();
    missiles.reset(); // a intermissão apaga os projéteis
    if (next.kind === 'finale') { startFinale(session.episode); return; }
    pendingNext = next;
    if (!hudAvailable) { advanceFromIntermission(); return; } // sem a camada 320x200, segue direto
    intermission = new Intermission({ episode: session.episode, last: fromMap, next: next.map, stats: ls,
      sound: (n) => audio.play(n) });
    session.phase = 'intermission';
    menuOverlay = false;
    if (controls.locked) document.exitPointerLock(); // o mouse fica solto, sem abrir o menu
  }
  function advanceFromIntermission() {
    const entry = session.find(pendingNext.episode, pendingNext.map);
    if (intermission) intermission.done = false; // se falhar, a tela "entering" espera de novo
    enterMap(entry, { ...LEVEL_ENTRY.exit, phase: 'playing' }).then((ok) => { if (ok) intermission = null; });
  }
  function startFinale(episode) {
    if (!hudAvailable) { backToTitle(); return; }
    finale = new Finale(episode, T23.finaleText[episode] ?? T23.finaleText[1]);
    session.phase = 'finale';
    menuOverlay = false;
    if (controls.locked) document.exitPointerLock();
  }
  function backToTitle() {
    finale = null;
    intermission = null;
    session.phase = 'title';
    menuOverlay = false;
    menu.started = false;
    menu.open({ silent: true });
    if (controls.locked) document.exitPointerLock();
  }
  // Tecla ou clique nas telas de intermissão e fim. A tecla que conclui a intermissão já pede o mouse
  // (gesto válido); o carregamento do próximo mapa começa no tic seguinte.
  function screenPress() {
    if (session.phase === 'intermission' && intermission) {
      const last = intermission.phase === 'entering';
      intermission.press();
      if (last) { lockReason = 'newGame'; controls.requestLock(); }
    } else if (session.phase === 'finale' && finale) {
      finale.press();
    }
  }
  const SCREEN_KEYS = new Set(['Enter', 'NumpadEnter', 'Space', ACTION_KEYS.use.code, ACTION_KEYS.fire.code]);

  menu = new Menu(settings, {
    // Chamados dentro do handler do teclado ou do clique: o pedido de pointer lock é um gesto válido.
    onSound: (name) => audio.play(name),
    newGame,
    episodes: () => session.episodes(), // etapa 23
    // Etapa 23: na intermissão e no fim, "retomar" só fecha o menu (o mouse continua solto).
    resume: () => { if (screenPhase()) { menuOverlay = false; menu.dirty = true; } else controls.requestLock(); },
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
        case 'openAllDoors': if (movingEnabled) openAllDoors(level, levelCtx); break; // etapa 20
        case 'finishLevel': if (!stats.isDead) level.finish(false); break;
        case 'armorUp': stats.addArmor(25); break;
        case 'ammoUp': stats.addAmmo(10); break;
        case 'resetStats':
          stats.reset();
          face.reset();
          if (weapons.state === 'dead') startRaise(weapons, PISTOL); // reviver levanta a pistola
          break;
        case 'resetMonsters': resetCombat(); resetItems(); break;
        case 'killAll': monsters.killAll(); break; // conta como morte, não como acerto
        // Etapa 23: troca de nível pela depuração (o jogador passa como numa saída; RELOAD mantém tudo).
        case 'reloadLevel': enterMap(session.current, LEVEL_ENTRY.reload); break;
        case 'nextMap': enterMap(session.neighbor(+1), LEVEL_ENTRY.debugMap); break;
        case 'prevMap': enterMap(session.neighbor(-1), LEVEL_ENTRY.debugMap); break;
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
    // Etapa 23: intermissão e fim de episódio (mouse solto): Esc abre o menu por cima; as outras teclas avançam.
    if (screenPhase() && !menuOverlay) {
      if (e.repeat) return;
      e.preventDefault();
      if (e.code === 'Escape') { menuOverlay = true; menu.open(); return; }
      if (session.phase === 'finale' || SCREEN_KEYS.has(e.code)) screenPress();
      return;
    }
    if (menuVisible() && menu.handleKey(e)) e.preventDefault();
    else if (!menuVisible() && e.code === 'Enter' && !e.repeat && tryRestart()) e.preventDefault(); // etapa 19
    else if (!menuVisible() && menu.started && automap.visible && AUTOMAP_CODES.has(e.code)) {
      // Etapa 22: dentro do automapa, F, G, + e -, 0 têm função própria (as ações globais são ignoradas).
      e.preventDefault();
      if (e.code === 'Equal' || e.code === 'Minus') { automapHeld.add(e.code); return; }
      if (e.repeat) return;
      if (e.code === 'KeyF') { automap.follow = !automap.follow; levelCtx.message(automap.follow ? 'amFollowOn' : 'amFollowOff'); }
      if (e.code === 'KeyG') { automap.grid = !automap.grid; levelCtx.message(automap.grid ? 'amGridOn' : 'amGridOff'); }
      if (e.code === 'Digit0') automap.toggleBigMode();
    }
  });
  window.addEventListener('keyup', (e) => automapHeld.delete(e.code));

  // --- Códigos de trapaça (etapa 22): reconhecidos antes do despacho das ações ---
  const cheats = new CheatReader();
  window.addEventListener('blur', () => { automapHeld.clear(); cheats.clear(); });
  function showText(text) {
    pickupMessage = text;
    messageTics = MESSAGE_TICS;
  }
  function applyCheat(name, arg) {
    switch (name) {
      case 'iddqd': {
        const on = toggleGod(stats, settings.get('godMode'));
        settings.set('godMode', on);
        levelCtx.message(on ? 'cheatGodOn' : 'cheatGodOff');
        break;
      }
      case 'idkfa': giveAll(stats, true); levelCtx.message('cheatKfa'); break;
      case 'idfa': giveAll(stats, false); levelCtx.message('cheatFa'); break;
      case 'idclip':
      case 'idspispopd':
        noClip = !noClip;
        levelCtx.message(noClip ? 'cheatClipOn' : 'cheatClipOff');
        break;
      case 'iddt': automap.cycleCheat(); break;
      // Etapa 23: IDCLEV + episódio + mapa (começo do zero, como o G_DeferedInitNew).
      case 'idclevStart': levelCtx.message('clevPrompt'); break;
      case 'idclevCancel': levelCtx.message('clevCancel'); break;
      case 'idclev': {
        const entry = session.find(Number(arg[0]), Number(arg[1]));
        if (!entry || loadingLevel) { levelCtx.message('clevInvalid'); break; }
        levelCtx.message('clevChanging');
        session.secretReturn = null; // no mapa 9 por IDCLEV, a volta vem da tabela (GameFlow)
        enterMap(entry, { ...LEVEL_ENTRY.idclev, phase: 'playing' });
        break;
      }
      case 'idmypos': {
        const [x, y] = worldToDoom(...camera.pos);
        showText(myPosText(yawToDoomAngle(camera.yaw), x, y));
        break;
      }
    }
  }
  // Devolve true se a tecla faz parte de um código em andamento (não dispara atalhos de alternância).
  function cheatKey(e) {
    if (!menu.started || menuVisible() || session.phase !== 'playing') { cheats.clear(); return false; }
    const r = cheats.push(e.code, e.repeat);
    if (r.cheat) applyCheat(r.cheat, r.arg);
    return r.consume;
  }

  controls = new Controls(canvas, {
    onLook: (dx, dy) => {
      if (stats.isDead || session.phase !== 'playing') return; // morto, a câmera só vira para o assassino
      camera.look(dx, dy, BASE_MOUSE_SENS * levelScale(settings.get('mouseSensitivityLevel')));
    },
    isBlocked: menuVisible,
    onKey: (e) => cheatKey(e), // etapa 22
    // Clique no canvas: antes do jogo começar equivale a NEW GAME; depois, retoma sem reposicionar.
    onClick: () => {
      if (tuningPanel.isOpen) return; // no modo de calibragem o mouse é do painel
      if (screenPhase()) { if (!menuOverlay) screenPress(); return; } // etapa 23
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
        // Ao abrir a calibragem o menu não aparece, então fica em silêncio. Etapa 23: na intermissão e
        // no fim de episódio o mouse é solto de propósito e o menu não abre.
        if (!screenPhase()) menu.open({ silent: tuningPanel.isOpen });
        setHelp(false);
        if (cheats.clear() && session.phase === 'playing') levelCtx.message('clevCancel'); // etapa 22 e 23
        automapHeld.clear();
      }
      applyHud();
    },
    onLockError: () => {
      if (menu.started) menu.setResumeFailed(true);
      lockReason = 'resume'; // o próximo retorno ao jogo volta a ser um "retomar"
    },
    onAction: (action) => {
      // Etapa 22: com o automapa aberto, F, G, + e -, 0 são dele (tratados no keydown acima).
      if (automap.visible && AUTOMAP_CODES.has(ACTION_KEYS[action]?.code)) return;
      switch (action) {
        case 'toggleAutomap':
          if (menu.started) { automap.visible = !automap.visible; automapHeld.clear(); }
          break;
        case 'fullscreen': toggleFullscreen(); break;
        case 'help': setHelp(helpPanel.style.display === 'none'); break;
        case 'tuning': if (tuningPanel.isOpen) closeTuning(); else openTuning(); break;
        case 'toggleMoveMode': settings.toggle('moveMode'); break;
        case 'toggleMute': settings.toggle('muted'); break;
        case 'sensDown': stepLevel('mouseSensitivityLevel', -1); break;
        case 'sensUp': stepLevel('mouseSensitivityLevel', +1); break;
        case 'speedDown': stepLevel('flySpeedLevel', -1); break;
        case 'speedUp': stepLevel('flySpeedLevel', +1); break;
        // Morto ou nas estatísticas: reinicia; senão, usa (portas, interruptores, saída).
        case 'use': if (stats.isDead) tryRestart(); else useAction(); break;
        case 'weaponNext': if (menu.started && session.phase === 'playing') cycleWeapon(weapons, stats, +1); break;
        case 'weaponPrev': if (menu.started && session.phase === 'playing') cycleWeapon(weapons, stats, -1); break;
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
      `dano recebido: hitscan ${d.hitscan}, corpo a corpo ${d.melee}, projétil ${d.missile ?? 0}, explosão ${d.explosion}, ` +
      `teste ${d.debug ?? 0}; absorvido pela armadura ${playerDamage.absorbed}\n`;
  }
  // Etapa 23: sessão, mapa, dificuldade, estatísticas da fase e objetos de GPU vivos dos níveis.
  function levelHud() {
    const ls = current.rt.levelStats();
    return `sessão ${session.phase}  mapa ${map.name} (episódio ${session.episode}, mapa ${session.map})  ` +
      `dificuldade ${session.skill} ${MENU_TEXT[MENU_LANG].skillShort[session.skill]}` +
      `${skill.respawn ? `  respawns ${monsters.respawns}` : ''}
` +
      `mortes ${ls.kills}/${ls.totalKills}  itens ${ls.items}/${ls.totalItems}  segredos ${ls.secrets}/${ls.totalSecrets}  ` +
      `tempo ${mmss(ls.tics)}  GPU viva: ${liveCounts.buffers} buffers, ${liveCounts.textures} texturas, ` +
      `${liveCounts.bindGroups} bind groups
`;
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
      `automapa ${automap.visible ? 'visível' : 'fechado'}  seguir ${onOff(automap.follow)}  grade ${onOff(automap.grid)}  ` +
      `cheat ${automap.cheat}  escala ${automap.scale.toFixed(3)}  linhas ${automap.mappedCount()}/${automap.lineCount}\n` +
      `códigos: godMode ${onOff(settings.get('godMode'))}  noclip ${onOff(noClip)}  IDDT ${automap.cheat}\n` +
      `projéteis ${missiles.list.length}  disparados: diabrete ${missiles.stats.fired.TROO}, barão ${missiles.stats.fired.BOSS}, ` +
      `jogador ${missiles.stats.fired.player}  acertaram o jogador ${missiles.stats.hitPlayer}\n` +
      levelHud() +
      `fase: ${level.thinkers.size} setores em movimento  uso: ${level.lastUse}  ` +
      `não suportados: ${specialsInfo.unsupported.size} tipo(s), ${level.unsupportedUses} uso(s)  tempo ${mmss(level.levelTics)}` +
      `${movingEnabled ? '' : '  (setores móveis desligados)'}${level.finished ? '  FIM DA FASE' : ''}\n` +
      `som(${key('toggleMute')}) ${onOff(!settings.get('muted'))} vol ${settings.get('sfxVolumeLevel')}/${MAX_VOLUME_LEVEL} ` +
      `canais ${audio.getStats().channelsActive}/${MAX_CHANNELS}${audio.getStats().running ? '' : ' (aguardando clique)'}\n` +
      `sprites(${key('sprites')}) ` + (sprites
        ? `${onOff(settings.get('sprites'))} ${spriteScene.objects.length} objetos / ${spriteScene.types.size} tipos`
        : 'indisponíveis') + '\n' +
      `fps  ${fps.toFixed(0)}   ${key('help')}: ajuda`;
  }

  // --- Troca de nível (etapa 23) ---
  // Instala um nível já montado (CPU, GPU e execução): só troca referências, nada aqui falha.
  function installLevel(data, gpu, rt) {
    ({ map, spawn, far, specialsInfo, spriteScene } = data);
    sector = map.sectors[data.spawnSector];
    ({ textureSet, walls, flats, staticBuffers, dynamic, movingEnabled, sprites } = gpu);
    ({ level, automap, physicsWorld, effects, combat, monsters, itemSystem, liftSectorOf, fixedSolids, missiles,
      monsterAI, amSolids } = rt);
    // Mudanças de altura e de textura marcam só o que foi afetado.
    level.onSectorChanged = (s) => dynamic?.geo.updateSector(s, level.sectorLines[s]);
    level.onLineChanged = (li) => dynamic?.geo.updateLinedef(li);
    current = { data, gpu, rt };
    warnedLevel.clear();
    automapHeld.clear();
    resetToSpawn();
  }

  // Estatísticas do nível no console (as mesmas das etapas anteriores, agora por nível).
  function logLevel(data, gpu, rt) {
    console.log(`=== ${data.name}: montado em ${data.ms.toFixed(0)} ms; céu ${data.skyName}; dificuldade ${data.skill} ===`);
    for (const w of [...data.warnings, ...gpu.warnings]) console.warn(`${data.name}: ${w}`);
    printTextureStats(data.textures, data.used, gpu.textureSet.info);
    printStats(gpu.walls, data.spawn, data.spawnSector, data.map.sectors[data.spawnSector]);
    validateFlats(data.map, gpu.flats, data.spawn);
    printLightingStats(colormap, litPalette, palette, gpu.textureSet, gpu.flats, data.map);
    const sp = data.specialsInfo;
    console.log(`Especiais: ${sp.movableSectors.size} setores móveis, ${data.dynSets.lines.size} linhas dinâmicas; ` +
      `não suportados [${[...sp.unsupported.keys()].join(', ')}]`);
    if (gpu.dynamic) console.log(`Setores móveis: ${gpu.dynamic.geo.vertexCount} vértices, ${gpu.dynamic.geo.indices.length} índices`);
    console.log(`Física: ${rt.physicsWorld.lines.length} linhas de colisão; modo ${settings.get('moveMode')}`);
    const mt = data.monsterTable;
    if (mt.removed.length) console.warn(`Combate: quadros ausentes removidos: ${mt.removed.join(', ')}`);
    if (mt.noAI.length) console.warn(`IA: tipos que ficam passivos: ${mt.noAI.join('; ')}`);
    const scene = data.spriteScene;
    if (scene) {
      const st = scene.stats;
      console.log(`Sprites: ${scene.objects.length} objetos, ${scene.types.size} tipos, ${scene.layers.length} camadas ` +
        `(limite ${device.limits.maxTextureArrayLayers}), cerca de ${(st.texture.bytes / 1048576).toFixed(1)} MiB; ` +
        `descartados por dificuldade ${st.discarded.skill}, só multiplayer ${st.discarded.multiplayer}; ` +
        `instância de ${INSTANCE_STRIDE} bytes${gpu.sprites ? '' : '; SEM SPRITES neste nível'}`);
      const missing = [...new Set(data.map.things.map((t) => t.type))].filter((type) => ITEM_TABLE[type] && !scene.types.has(type));
      if (missing.length) console.warn(`Itens sem sprite: ${missing.join(', ')}`);
    }
    console.log(`Combate: ${rt.monsters.monsters.length} objetos atiráveis, ${rt.combat.totalMonsters} monstros; ` +
      `itens ${rt.itemSystem.items.length} (${rt.itemSystem.totalCountable} contáveis); ${rt.fixedSolids.length} sólidos fixos; ` +
      `IA: ${rt.monsterAI.graph.edges.reduce((n, e) => n + e.length, 0) / 2} ligações de som entre setores`);
    console.log(`GPU do nível: ${gpu.counts.buffers} buffers, ${gpu.counts.textures} texturas, ${gpu.counts.bindGroups} bind groups; ` +
      `vivos em todos os níveis: ${liveCounts.buffers}/${liveCounts.textures}/${liveCounts.bindGroups}`);
  }

  // Monta o nível `name` inteiro (CPU e GPU) com o atual ainda vivo; troca só no fim e então descarta o
  // anterior. Se algo falhar, o nível atual continua (erro no console, no quadro vermelho e
  // "FALHA AO CARREGAR <mapa>" na barra). Devolve true se trocou.
  // opts: { entry ({ episode, map }), player ('keep' | 'carry' | 'pistol'), resetCheats, phase, failPhase }.
  async function startLevel(name, opts = {}) {
    if (loadingLevel) return false;
    loadingLevel = true;
    const T = MENU_TEXT[MENU_LANG];
    const previousPhase = session.phase;
    session.phase = 'loading';
    loading.textContent = `${T.loading} ${name}`;
    let gpu = null;
    let data, rt;
    try {
      await nextPaint(); // o texto de carregamento aparece por cima do nível atual
      data = buildLevelData(wad, name, { skill: session.skill, cache: levelCache, maxLayers: device.limits.maxTextureArrayLayers });
      gpu = await uploadLevel(device, data, { textureLayout, paletteView: paletteTex.view, spritePipeline });
      rt = createLevelRuntime(data, { ...runtimeDeps, skillParams: skill });
    } catch (err) {
      gpu?.dispose();
      session.phase = opts.failPhase ?? previousPhase;
      loadingLevel = false;
      const message = `${T.loadFailed} ${name}`;
      console.error(`${message}:`, err);
      reportError(err, message);
      showText(message);
      return false;
    }
    const old = current;
    installLevel(data, gpu, rt);
    // destroy() é seguro com comandos já enviados: a GPU libera depois que eles terminam.
    old?.rt.dispose();
    old?.gpu.dispose();
    if (opts.entry) { session.episode = opts.entry.episode; session.map = opts.entry.map; }
    applyPlayerStart(opts.player ?? 'keep', Boolean(opts.resetCheats));
    // Nada do nível anterior continua: sons, partículas, mensagem, trapaça em andamento e HUD.
    audio.stopAll();
    particleGeneration++;
    pickupMessage = '';
    messageTics = 0;
    cheats.clear();
    lastHudKey = '';
    logLevel(data, gpu, rt);
    session.phase = opts.phase ?? previousPhase;
    loadingLevel = false;
    return true;
  }

  let last = performance.now();
  let fps = 60;
  let lastSkull = -1;
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1); // limita dt para não "teleportar" após travadas
    last = now;
    if (dt > 0) fps += (1 / dt - fps) * 0.05; // média móvel para o número não pular

    display.update();
    loading.style.display = session.phase === 'loading' ? '' : 'none'; // etapa 23
    const showMenu = menuVisible();
    // Etapa 23: a simulação só roda na fase 'playing'; o relógio também anda na intermissão e no fim.
    const paused = showMenu || session.phase !== 'playing';
    if (!showMenu && (session.phase === 'playing' || screenPhase())) gameTime += dt;
    if (tuningPanel.isOpen) {
      // Modo de calibragem: as setas giram a câmera (mesmo limite de pitch do mouse).
      const look = controls.lookVector();
      const turn = TURN_RATE * dt;
      camera.look(look.yaw * turn, -look.pitch * turn, 1);
    }
    if (!paused) {
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
          for (const ev of stepPlayer(walker, wish, dt, physicsWorld, frameSolids, { noclip: noClip })) {
            if (ev.type === 'landed' && ev.impactSpeed > OOF_IMPACT_SPEED) audio.play('oof', { origin: 'player' });
          }
          // Etapa 20: linhas de cruzamento entre a posição anterior e a atual (só andando, vivo).
          const seg = crossTracker.step({ x: walker.x, y: walker.y }, movingEnabled && !stats.isDead);
          if (seg) crossLines(level, physicsWorld, seg[0], seg[1], levelCtx);
          syncCameraToWalker();
        }
      } else {
        crossTracker.invalidate();
        if (!stats.isDead) camera.move(controls.moveVector(), speed, dt); // voar: comportamento da etapa 11
      }
    }
    const tics = gameTics(gameTime);
    if (!showMenu && screenPhase()) {
      // Etapa 23: intermissão e fim de episódio avançam por tic; concluídas, seguem o fluxo.
      for (let t = lastPistolTic; t < tics; t++) (intermission ?? finale)?.tick();
      if (session.phase === 'intermission' && intermission?.done) advanceFromIntermission();
      else if (session.phase === 'finale' && finale?.done) backToTitle();
    } else if (!paused && menu.started) {
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
        // Etapa 20: portas e elevadores antes da IA; o relógio da fase conta só tics ativos.
        if (level.intermission) { level.advanceClock(); continue; }
        if (movingEnabled) tickLevel(level, levelCtx);
        level.advanceClock();
        if (cheats.tick()) levelCtx.message('clevCancel'); // etapa 23: IDCLEV sem os dígitos em 105 tics
        // Etapa 23: setor secreto (vivo, com os pés no chão).
        if (current.rt.checkSecret(px, py, feet.z, !stats.isDead)) levelCtx.message('secretFound');
        // Etapa 22: automapa e linhas vistas (também com o automapa fechado, como no Doom).
        {
          const look = tuningPanel.isOpen ? { yaw: 0, pitch: 0 } : controls.lookVector();
          automap.tick({ zoomIn: automap.visible && automapHeld.has('Equal'), zoomOut: automap.visible && automapHeld.has('Minus'),
            panX: automap.visible ? look.yaw : 0, panY: automap.visible ? look.pitch : 0 }, { x: px, y: py });
          if (!stats.isDead && level.levelTics % 2 === 0) {
            markSeen(physicsWorld, automap.mapped, { x: px, y: py, z: feet.z, angle: yawToDoomAngle(camera.yaw) },
              hfovDeg(display.projectionAspect), findSector(map, px, py));
          }
        }
        monsters.tick();
        missiles.update(); // etapa 21: depois da IA
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
      if (level.intermission) completeLevel(); // etapa 23: 35 tics depois da saída
    }
    lastPistolTic = tics;
    // Etapa 19: olho caindo na morte; clique (disparo solto e apertado de novo) reinicia.
    if (menu.started && !paused) {
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
    // Etapa 23: intermissão e fim de episódio ocupam a tela inteira (camada 320x200 do HUD), também
    // enquanto o próximo mapa carrega (a tela nunca fica preta).
    const screenImage = !hudAvailable ? null
      : session.phase === 'finale' ? 'finale'
        : (session.phase === 'intermission' || session.phase === 'loading') && intermission ? 'intermission' : null;
    // Tela de título com TITLEPIC: a cena 3D não é desenhada (o menu limpa de preto).
    const drawScene = !screenImage && !(showMenu && !menu.started && menuAssets.patches.TITLEPIC);

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
    // Etapa 20: vértices dos setores móveis reenviados inteiros quando algo mudou (buffer pequeno).
    if (dynamic?.geo.dirty) {
      device.queue.writeBuffer(dynamic.vb.flat, 0, dynamic.geo.vertices);
      device.queue.writeBuffer(dynamic.vb.sector, 0, dynamic.geo.sectorVertices);
      dynamic.geo.dirty = false;
    }
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
      pass.setVertexBuffer(0, staticBuffers.vertex);
      pass.setIndexBuffer(staticBuffers.index, 'uint32');
      pass.drawIndexed(walls.indices.length);
      // Chão e teto: mesmo pipeline, outros buffers.
      pass.setVertexBuffer(0, settings.get('sectorColors') ? staticBuffers.sector : staticBuffers.flat);
      pass.setIndexBuffer(staticBuffers.flatIndex, 'uint32');
      pass.drawIndexed(flats.indices.length);
      // Etapa 20: setores móveis, mesma pipeline e mesmos bind groups.
      if (dynamic) {
        pass.setVertexBuffer(0, settings.get('sectorColors') ? dynamic.vb.sector : dynamic.vb.flat);
        pass.setIndexBuffer(dynamic.ib, 'uint32');
        pass.drawIndexed(dynamic.geo.indices.length);
      }
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
    // Etapa 23: intermissão ou fim: fundo preto (fora da área 320x200) e a imagem composta na CPU.
    if (screenImage) {
      encoder.beginRenderPass({ colorAttachments: [{ view: display.colorView, clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear', storeOp: 'store' }] }).end();
      const key = screenImage === 'finale' ? `F|${finale.visible}|${finale.typed}`
        : `I|${intermission.phase}|${JSON.stringify(intermission.cnt)}`;
      if (key !== lastHudKey) {
        hudPass.upload(screenImage === 'finale' ? composeFinale(finale, finaleAssets, T23.finalePress) : composeIntermission(intermission, wiAssets));
        lastHudKey = key;
      }
      hudPass.draw(encoder, display.colorView, display.internal.width, display.internal.height);
    }
    // Pistola e barra: depois das partículas e antes do menu (o menu fica por cima).
    if (hudAvailable && menu.started && !screenImage) {
      const [cx, cy] = worldToDoom(...camera.pos);
      const under = map.sectors[findSector(map, cx, cy)];
      const lightnum = under ? Math.min(15, Math.max(0, Math.floor(under.lightLevel / 16))) : 15;
      const weapon = weaponView(weapons);
      const weaponLevel = weaponLightLevel(lightnum, settings.get('lighting'));
      // Recompõe só quando algo visível muda (números, quadro e posição da arma, luz, rosto).
      const [fx, fy] = worldToDoom(...camera.pos);
      const faceName = face.lump(stats, { x: fx, y: fy, angle: yawToDoomAngle(camera.yaw) }, settings.get('godMode'), hudAssets.patches);
      const restartText = stats.isDead && canRestart(stats.deathTics) ? MENU_TEXT[MENU_LANG].restartPrompt : '';
      const amView = automap.visible ? automapView() : null;
      const hudKey = [amView ? performance.now() : '', Math.max(0, stats.health), stats.armor, faceName, restartText, AMMO_TYPES.map((t) => `${stats.ammo[t]}/${stats.maxAmmoOf(t)}`).join(','),
        KEY_NAMES.map((k) => (stats.keys[k] ? 1 : 0)).join(''), [...stats.weaponsOwned].join(','), pickupMessage,
        weapon.prefix, weapon.frame, weapon.flash ? weapon.flash.prefix + weapon.flash.letter : '',
        weapon.sx.toFixed(2), weapon.sy.toFixed(2), weaponLevel].join('|');
      if (hudKey !== lastHudKey) {
        hudPass.upload(composeHud({ stats, weapon, weaponLevel, message: pickupMessage, face: faceName, restartText, automap: amView }, hudAssets, tics));
        lastHudKey = hudKey;
      }
      hudPass.draw(encoder, display.colorView, display.internal.width, display.internal.height);
    }
    if (showMenu) {
      menuPass.draw(encoder, display.colorView, display.internal.width, display.internal.height, !drawScene && !screenImage);
    }

    display.blit(encoder);
    device.queue.submit([encoder.finish()]);

    requestAnimationFrame(frame);
  }
  // Etapa 23: primeiro nível pelo mesmo caminho da troca (sem nível anterior, a falha é fatal).
  if (!(await startLevel(session.current.name))) throw new Error(`não foi possível carregar ${session.current.name}`);
  applyHud();
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
