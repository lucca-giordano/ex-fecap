# Etapa 16: itens, itens largados e objetos sólidos

## Pedido

Itens coletáveis com as regras do Doom (vida, armadura, munição em quatro tipos, mochila, armas e
chaves), mensagens de coleta, itens largados por monstros, objetos sólidos no modo andar, chaves e
munição completa na barra de status, ações GIVE ALL KEYS e GIVE ALL WEAPONS, página de depuração e
verificação sem navegador.

## Decisões

- `PlayerStats` reescrito com munição por tipo, tipo de armadura, mochila, chaves e `bonusCount`; os
  acessores antigos (`ammoClip`, `maxClip`) continuam valendo para as balas.
- Motosserra com campo próprio (`hasChainsaw`): o slot 1 é do soco, sempre possuído, e a regra "só pega
  se não tiver" nunca valeria pelo slot.
- `MonsterSystem` ganhou a fila de eventos `died` (`takeEvents()`), emitida uma vez por morte.
- `stepPlayer` ganhou o parâmetro `solids` (padrão vazio, comportamento da etapa 12) e até 4 rodadas
  alternadas de paredes e sólidos.
- Sprites: CLIP A, SHOT A e MGUN A sempre na textura (categoria `drop`, nunca descartada); capacidade de
  instâncias = objetos + 256 efeitos + 128 largados. Nenhuma pipeline nova.
- HUD: a fonte STCFN é carregada pelo `loadHudAssets`; sem ela, só não há mensagem.
- Correções de tabela: MEGA, TLMP e TLP2 sem sprite no freedoom1; tipos de decoração que faltavam
  acrescentados ao `thingTable.js`; 47 é o toco SMIT.

## Arquivos

Criados: `src/game/itemTable.js`, `src/game/itemText.js`, `src/game/pickups.js`, `src/game/ItemSystem.js`,
`src/physics/solids.js`, `debug/items.html`, `debug/items.js`, `tools/check-items.mjs`, `docs/itens.md`,
este arquivo.

Alterados: `src/game/PlayerStats.js`, `src/game/MonsterSystem.js`, `src/physics/collision.js`,
`src/sprites/thingTable.js`, `src/hud/HudAssets.js`, `src/hud/HudRenderer.js`, `src/menu/Menu.js`,
`src/menu/menuText.js`, `src/main.js`, `tools/check-hud.mjs` (chaves agora são um objeto).

## Verificações (sem navegador)

- `node --check` em todos os `.js` e `.mjs` (cópias `.mjs` temporárias) e ESLint.
- `tools/check-items.mjs`: regras de vida e armadura, munição e mochila, armas e motosserra, chaves e
  prioridade da caveira, mensagens em en e pt, quebra da mensagem e posições na barra; alcance (35.9 e
  36, 8 e 9 abaixo, 56 e 57 acima); itens largados (sem duplicar, limite de 128); sólidos (coluna de raio
  32, deslizar, contornar, monstro vivo e morto, barril até explodir); varredura do E1M1 em 72 direções
  com dt 1/60 e 0.1 e os sólidos reais; lumps; 49 itens contáveis.
- Os demais scripts de verificação das etapas anteriores.

Os resultados de cada comando estão no resumo da etapa.
