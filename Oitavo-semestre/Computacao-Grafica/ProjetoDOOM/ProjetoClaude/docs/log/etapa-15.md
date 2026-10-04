# Etapa 15: tiro com dano, monstros, efeitos e barris

## Pedido

Hitscan 3D da pistola com dano; monstros com vida, dor, morte e corpos; fumaça e sangue de impacto;
barris explosivos com dano em raio e reação em cadeia; sons posicionais de dor, morte e explosão;
contadores de mortos, disparos e acertos. Sem IA, sem itens soltos e sem dano ao jogador.

## Decisões

- Gerador próprio (mulberry32), não a tabela do Doom.
- Tabela de monstros conferida contra os lumps do freedoom1.wad: todas as letras de parado, dor, morte
  e morte esfacelada dos tipos pedidos existem, e nenhuma entrada foi corrigida.
- Tiro no teto de céu (F_SKY1) não gera fumaça, como no Doom.
- Um monstro que muda de estado durante o tic em andamento só começa a contar no tic seguinte. Sem isso,
  um barril morto pela explosão de outro que vem antes na lista explodia 9 tics depois, e não 10.
- Sprites: mapa global PREFIXO+letra → vistas, descarte por categoria quando faltam camadas, buffer de
  instâncias com espaço para 256 efeitos, `SpriteSet` criado sob `pushErrorScope` com labels; o shader de
  sprites não mudou. Dispositivo pedido com até 1024 camadas.
- Pistola: evento `fire` com `refire`; os testes da etapa 13 e 14 passaram a conferir o campo.
- Menu: as ações de estado do jogo foram para o submenu GAME DEBUG (dentro do DEBUG), com RESET MONSTERS e
  KILL ALL MONSTERS.

## Arquivos

Criados: `src/game/Rng.js`, `src/game/monsterTable.js`, `src/game/MonsterSystem.js`, `src/game/hitscan.js`,
`src/game/radiusAttack.js`, `src/game/effects.js`, `src/game/stats.js`, `debug/monsters.html`,
`debug/monsters.js`, `tools/check-combat.mjs`, `docs/combate.md`, este arquivo.

Alterados: `src/main.js`, `src/gpu.js` (requiredLimits), `src/gpu/SpriteSet.js`,
`src/sprites/spriteLogic.js` (quadros extras, `writeSpriteInstances`), `src/game/pistol.js` (`refire`),
`src/menu/Menu.js`, `src/menu/MenuRenderer.js`, `src/menu/menuText.js`, `tools/check-menu.mjs`,
`tools/check-hud.mjs`, `tools/check-audio.mjs`, `debug/menu.js`.

## Verificações (sem navegador)

- `node --check` em todos os `.js` e `.mjs` (cópias `.mjs` temporárias) e ESLint.
- `tools/check-combat.mjs`: Rng reproduzível e dano só 5, 10 e 15; cilindro (acima, abaixo, dentro,
  borda, origem dentro, atrás, olhando para cima); hitscan sintético (parede a 412, janela passando e
  batendo, piso a 41 com pitch −45, teto com pitch +30, "none" além de 2048, monstro antes e atrás da
  parede); hitscan no E1M1 em 360 direções com pitch 0 e 10 (sem NaN, batidas sobre o segmento e nenhuma
  parede de um lado só atravessada antes da batida); dano, morte esfacelada e chance de dor; sequências
  de dor (6 tics) e morte (20 tics, corpo em L); dano em raio, linha de visão, cadeia de barris (explosões
  nos tics 10 e 20) e zumbi esfacelado a 40 unidades de um barril; efeitos; lumps (176 camadas).
- Os demais scripts de verificação das etapas anteriores.

Os resultados de cada comando estão no resumo da etapa.
