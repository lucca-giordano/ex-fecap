# Etapa 13: barra de status, pistola e estado do jogador

## Pedido

Barra de status do Doom (munição, vida, armadura, rosto, painel de armas, tabela de munição), pistola na
tela com levantar, balanço e disparo com clarão, e modelo de estado do jogador (vida, armadura,
munição), sem dano, sem inimigos reagindo e sem som. Itens de depuração no submenu DEBUG.

## Decisões

- Coordenadas de partida do `st_stuff.c` usadas sem ajuste; a constante 16.5 da posição vertical da
  pistola foi mantida (conferida pela conta do `R_DrawPSprite` com visão de 168 linhas; o arquivo
  `r_things.c` em si não foi consultado).
- `composeHud` reaproveita `createBuffer` e `drawPatch` do `MenuRenderer`, sem alterá-los; a arma
  iluminada é desenhada trocando a paleta do buffer pela linha do COLORMAP do nível.
- O olhar do rosto é função pura do tic (`faceLookAt`), com sorteio de semente fixa refeito desde o
  tic 0.
- `stepPlayer` passou a guardar `hspeed` (velocidade horizontal real depois da colisão), usada pelo
  balanço.
- A ajuda (READ THIS!) passou a usar linhas de 10 pixels para caber as duas entradas de disparo.
- Disparo pelo mouse: entrada `fireMouse` em `ACTION_KEYS` com `mouseButton: 0` (código `Mouse0`, que
  nunca vem do teclado), tratada em `mousedown`/`mouseup` só com o pointer lock ativo.
- A passada do HUD é criada com `createRenderPipelineAsync` dentro de `pushErrorScope("validation")`;
  a flag `hudAvailable` só fica verdadeira depois da validação. Não há configuração para desligar a
  camada; ela depende só da disponibilidade.

## Arquivos

Criados: `src/game/PlayerStats.js`, `src/game/pistol.js`, `src/hud/HudAssets.js`,
`src/hud/HudRenderer.js`, `src/gpu/HudPass.js`, `src/shaders/hud.wgsl`, `debug/hud.html`,
`debug/hud.js`, `tools/check-hud.mjs`, `docs/hud-arma.md`, este arquivo.

Alterados: `src/main.js`, `src/input/Controls.js`, `src/menu/Menu.js`, `src/menu/menuText.js`,
`src/menu/MenuRenderer.js` (espaçamento da ajuda), `src/physics/collision.js` (`hspeed`).

## Verificações (sem navegador)

- `node --check` em todos os `.js` e `.mjs` (cópias `.mjs` temporárias).
- ESLint com o `eslint.config.mjs` do projeto.
- `tools/check-hud.mjs`: limites e inteiros do PlayerStats; levantar em 16 tics; disparo completo de 19
  tics gastando 1 bala; reinício segurando o disparo; sem munição não dispara; clarão de 7 tics; pose
  congelada no disparo; balanço (zero parado, 16 correndo, decaimento suave, período de 64 tics,
  sy − 32 ≥ 0); nível de dor por faixa de vida; lumps do rosto; composição (barra opaca nas linhas 168 a
  199, números alinhados à direita nos campos, valor 0 como um único dígito); posição da pistola em
  repouso (coluna 126, linha 112, base em 204).
- `tools/check-menu.mjs`, `tools/check-wgsl-reserved.mjs`, `tools/check-collision.mjs`,
  `tools/check-sprites.mjs` e `tools/check-particles.mjs`.

Os resultados de cada comando estão no resumo da etapa.
