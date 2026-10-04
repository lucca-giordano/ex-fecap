# Etapa 14: efeitos sonoros

## Pedido

Sons do freedoom1.wad (formato DMX) com Web Audio: volume mestre, mudo, atenuação por distância e
posição estéreo como o Doom, 8 canais, e sons do menu, da pistola e da queda do jogador. Menu de opções
reorganizado para caber o termômetro SFX VOLUME. Sem música e sem sons de monstros, dano, itens ou
portas.

## Decisões

- Partes puras separadas do Web Audio: `dmx.js`, `soundMath.js` e `channels.js`; o `AudioEngine.js` só
  faz a cola com o navegador e cria o `AudioContext` no primeiro gesto.
- `tickPistol` e `updatePistol` passaram a devolver eventos (`fire` no tic em que o disparo gasta
  munição); `stepPlayer` passou a devolver eventos (`landed` com a velocidade de impacto, só ao pousar
  vindo de queda). Nenhum chamador usava os valores de retorno anteriores; o movimento e a máquina de
  estados não mudaram.
- Sons do menu: cursor, valor, confirmar e voltar saem do `Menu` por um callback `onSound`; "abrir com
  o jogo começado" sai do `open()`, que ganhou `{ silent }` (usado quando quem soltou o mouse foi o painel
  de calibragem); "fechar para retomar" toca no `main` quando o mouse é de fato recuperado e o motivo é
  retomar (não NEW GAME nem o fechamento da calibragem).
- Menu de opções: VISUAL, CRT, LIGHTING, FULLSCREEN, SFX VOLUME, MOUSE SENSITIVITY, SPEED, EXTRAS e
  DEBUG; o submenu EXTRAS tem PARTICLES, SPRITES, MOVEMENT e PARTICLE TUNING. Termômetros com faixa e
  número de células por item (volume 0 a 15 em 16 células; os demais 1 a 10 em 10, como antes). O
  `drawThermo` já recebia a largura em células.
- Volume padrão 12 (o Doom usa 8).

## Arquivos

Criados: `src/audio/dmx.js`, `src/audio/soundMath.js`, `src/audio/channels.js`,
`src/audio/AudioEngine.js`, `debug/sounds.html`, `debug/sounds.js`, `tools/check-audio.mjs`,
`docs/audio.md`, este arquivo.

Alterados: `src/main.js`, `src/core/Settings.js` (`sfxVolumeLevel`, `muted`), `src/input/Controls.js`
(tecla M), `src/menu/Menu.js`, `src/menu/MenuRenderer.js`, `src/menu/menuText.js`,
`src/game/pistol.js` (eventos), `src/physics/collision.js` (eventos), `tools/check-menu.mjs`,
`debug/menu.js`, `eslint.config.mjs` (globais de áudio e `setInterval`).

## Verificações (sem navegador)

- `node --check` em todos os `.js` e `.mjs` (cópias `.mjs` temporárias) e ESLint.
- `tools/check-audio.mjs`: parser DMX com lumps sintéticos (preenchimento, conversão, duração, casos
  inválidos); 69 lumps DS* válidos e 0 inválidos no freedoom1.wad, com pistol, swtchn, swtchx, pstop,
  stnmov e oof presentes; volume por distância; aproxDist; pan nos quatro lados e com o ouvinte olhando
  para o norte; volume mestre; canais (mesma origem, origem vazia, roubo do mais antigo, liberar); queda
  de 30 com impacto 275.6 u/s (sem "oof") e de 40 com 316.5 u/s (com "oof"); degrau real de 24 sem
  evento ao subir e com impacto 245.0 u/s ao descer; um evento "fire" por tiro e dois em disparo
  contínuo de 2 tiros.
- `tools/check-menu.mjs` com a nova estrutura (EXTRAS, termômetro de 16 células terminando em x = 202),
  e os demais scripts das etapas anteriores.

Os resultados de cada comando estão no resumo da etapa.
