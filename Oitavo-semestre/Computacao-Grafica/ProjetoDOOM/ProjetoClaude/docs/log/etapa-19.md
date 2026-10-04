# Etapa 19: dano ao jogador, morte, flashes de tela e rosto

## Pedido

Vida e armadura reais, morte com câmera caindo e reinício, flashes de tela de dano e de coleta numa
variante validada do blit, rosto completo da barra, GOD MODE e ações de dano no GAME DEBUG, e a
verificação `tools/check-player.mjs`.

## Decisões

- O dano passa por `applyDamage` na ordem do P_DamageMobj, e o `PlayerDamageSink` virou só contador,
  agora com o dano absorvido pela armadura.
- A IA passou a enviar o atacante (x, y do monstro) no dano.
- O NEW GAME virou uma função, chamada pelo menu e pelo reinício depois da morte.
- Arma: novo estado `dead` em `weapons.js`, que só desce até 128.
- Flashes:
  - variante do blit em arquivos novos, criada com `createRenderPipelineAsync` dentro de
    `pushErrorScope`;
  - o blit original fica de reserva e é usado enquanto o bind group da variante não estiver validado;
  - os alvos de partida (255, 0, 0) e (215, 186, 69) foram mantidos, porque o erro médio ficou abaixo de
    0.5 nível por canal em todas as paletas.
- Rosto: o nível de dor segue a fórmula do pedido, que é a do Doom. Para as vidas 80, 60, 40 e 20 ela dá
  0, 1, 2 e 3; a lista de exemplo do pedido (1, 2, 3, 4) não bate com a fórmula, e o teste confere os
  valores calculados.
- GAME DEBUG: HEALTH −10 saiu e entraram DAMAGE 10, DAMAGE 25, GOD MODE e KILL PLAYER. Com 11 itens, a
  tela termina em y = 163 e não precisou ser dividida.
- A tecla E (ação "use") reinicia depois da morte. O rótulo em português na ajuda ficou "USAR/REINICIO",
  porque "USAR / REINICIAR" não cabe na coluna.

## Arquivos

Criados: `src/game/PlayerDamage.js`, `src/game/PlayerDeath.js`, `src/hud/face.js`,
`src/gpu/palettesTint.js`, `src/shaders/blitTint.wgsl`, `src/shaders/crtTint.wgsl`,
`tools/check-player.mjs`, `docs/jogador.md`, este arquivo.

Alterados:

- `src/game/PlayerStats.js`, `src/game/PlayerDamageSink.js`, `src/game/MonsterAI.js` (atacante no dano)
  e `src/game/weapons.js` (estado `dead`);
- `src/gpu/Display.js` (`attachTint` e `setTint`; a pipeline original não mudou) e
  `src/hud/HudRenderer.js` (rosto vindo do estado, vida mínima 0 e texto de reinício);
- `src/input/Controls.js` (ação "use"), `src/core/Settings.js` (screenFlashes e godMode);
- `src/menu/Menu.js`, `src/menu/menuText.js` e `src/main.js`;
- `tools/check-hud.mjs` (vida negativa).

## Verificações (sem navegador)

- `node --check` em todos os `.js` e `.mjs` (cópias `.mjs` temporárias) e ESLint.
- `tools/check-player.mjs`, testes a a j:
  - armadura;
  - contadores;
  - paleta de flash;
  - tabela de mistura;
  - morte e reinício;
  - rosto;
  - sargento a 40 unidades: o jogador morre nas 100 sementes, com média de 5.14 mordidas sem armadura
    e 9.50 com armadura azul;
  - barril;
  - lumps (todos os do rosto e os três sons existem);
  - uniform de 48 bytes com `tint` no offset 32.
- Os demais scripts de verificação das etapas anteriores.

Os resultados de cada comando estão no resumo da etapa.
