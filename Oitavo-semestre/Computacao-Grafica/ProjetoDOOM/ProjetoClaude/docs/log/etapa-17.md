# Etapa 17: armas utilizáveis e troca de arma

## Pedido

Soco, pistola, espingarda e metralhadora utilizáveis; troca de arma por teclas e pela roda do mouse;
verificação de munição e troca automática; remapeamento dos atalhos de configuração para liberar os
dígitos 1 a 7; HUD com a arma e a munição atuais; READ THIS! com páginas; GIVE AMMO no GAME DEBUG.

## Decisões

- Uma única máquina de estados em `weapons.js`, por tabela. `pistol.js` virou reexportação, com
  `createPistol` e `tickPistol` mantidos para os testes anteriores.
- A ação `refire` é avaliada no fim do quadro dela, o que mantém o ciclo da pistola em 19 tics e dá 22,
  44 e 8 tics para as outras armas.
- Uma arma com lumps ausentes fica indisponível inteira (`availableSlots`).
- O tiro foi para `fireWeapon.js` (puro), o que permite verificar o alcance do soco e a espingarda sem
  navegador. `EffectList.spawnPuff` ganhou a opção `melee`, que começa a fumaça no quadro C.
- O `ItemSystem` passou a informar, em cada evento de coleta, a arma nova e os tipos de munição que
  saíram do zero; as regras de coleta não mudaram.
- `Controls.js` também passou a ignorar o Shift no keydown, como o resto do jogo.
- READ THIS! com linhas de 12 pixels em duas páginas (14 linhas cada), em `helpPages.js`.
- Tabela de quadros conferida contra o freedoom1.wad: todas as letras existem e nenhuma correção foi
  necessária. Os sons DSSHOTGN e DSPUNCH existem.

## Arquivos

Criados: `src/game/weapons.js`, `src/game/fireWeapon.js`, `src/menu/helpPages.js`,
`tools/check-weapons.mjs`, `docs/armas.md`, este arquivo.

Alterados: `src/game/pistol.js`, `src/game/effects.js`, `src/game/ItemSystem.js`,
`src/input/Controls.js`, `src/hud/HudAssets.js`, `src/hud/HudRenderer.js`, `src/menu/Menu.js`,
`src/menu/MenuRenderer.js`, `src/menu/menuText.js`, `src/main.js`, `debug/hud.html`, `debug/hud.js`,
`tools/check-menu.mjs`, `tools/check-hud.mjs` (sem munição, a pistola agora troca para o soco).

## Verificações (sem navegador)

- `node --check` em todos os `.js` e `.mjs` (cópias `.mjs` temporárias) e ESLint.
- `tools/check-weapons.mjs`, testes a a l:
  - durações e tempos de troca;
  - tic do gasto de munição e refire;
  - pedidos pendentes e ignorados;
  - ordem de troca sem munição;
  - troca automática com eventos reais do ItemSystem;
  - desvios e danos com semente fixa;
  - alcance do soco e fumaça no quadro C;
  - abate e morte esfacelada;
  - mapa de teclas, roda do mouse e campo de munição;
  - páginas da ajuda nos dois idiomas;
  - lumps e sons.
- Os demais scripts de verificação das etapas anteriores.

Os resultados de cada comando estão no resumo da etapa.
