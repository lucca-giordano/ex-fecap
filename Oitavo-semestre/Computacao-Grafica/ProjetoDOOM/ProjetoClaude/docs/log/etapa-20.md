# Etapa 20: portas, elevadores, uso, interruptores e saída

## Pedido

Portas, elevadores, tecla de usar, interruptores, linhas de cruzamento e saída com tela de estatísticas,
com setores de altura variável desenhados por buffers dinâmicos, sem pipelines nem shaders novos.

## Decisões

- **Parte 0.** A linha de base foi gravada antes de qualquer mudança em `src/`.
  - `tools/baseline-geometry.mjs` monta os mapas de camadas de textura em Node com a mesma regra de
    `createTextureSet`: camada 0 de reserva e depois a ordem de `loadTextures`.
  - A primeira versão do script hasheava os vértices convertendo o Float32Array para bytes valor por
    valor. Isso foi corrigido para os bytes crus antes da refatoração, e a linha de base foi regerada.
  - Depois da refatoração, o script foi executado de novo por engano e regravou o arquivo. Os quatro
    hashes saíram idênticos aos de antes e a data original foi restaurada. Agora o script recusa
    sobrescrever sem `--force`.
- `buildWalls` passou a usar `linedefWallQuads` (uma linedef por vez) e `buildFlats` passou a usar
  `flatVertices`; os dois ganharam `exclude`, e `vertexLayout` ganhou `writeVertex`. Com exclusão vazia,
  a saída é idêntica byte a byte.
- As contrapartes dos interruptores (SW2GRAY e SW2BRN1) são carregadas no FIM da lista de texturas, e as
  camadas existentes não mudam (o hash confere com elas incluídas).
- As alturas e as texturas mudam no próprio mapa; os originais ficam no `LevelState`. `lineSpecial` é
  restaurado no mesmo array, porque a colisão dos monstros guarda a referência.
- O NEW GAME restaura a fase antes de reposicionar o jogador. Os elevadores também levam os corpos
  junto, para não flutuarem.

## Auditoria de alturas em cache

- Já liam o valor corrente: física do jogador (`updateSector`, `lineBlocks`), visão, hitscan, dano em raio
  e colisão dos monstros.
- Cópias encontradas e alteradas:
  - **Grafo de som:** a abertura era calculada ao montar o grafo e passou a ser avaliada no alerta.
  - **`floorZ`:** o dos monstros, dos itens e dos largados agora acompanha os elevadores (`carryFloor`).
    O dos itens volta ao original no reset.
  - **`base` dos sprites:** os objetos parados em setores móveis passam a usar o chão corrente.
  - **Monstros com chão alterado:** usam a posição e o chão correntes.
- Não há tabela de rejeição no projeto.

## Arquivos

Criados:

- `src/game/LevelState.js`, `src/game/specials.js`, `src/game/Doors.js`, `src/game/Platforms.js`,
  `src/game/UseLines.js` e `src/map/dynamicGeometry.js`;
- `debug/specials.html` e `debug/specials.js`;
- `tools/baseline-geometry.mjs`, `tools/baselines/geometry-e1m1.json` e `tools/check-specials.mjs`;
- `docs/setores-moveis.md` e este arquivo.

Alterados:

- geometria e texturas: `src/map/buildWalls.js`, `src/map/buildFlats.js`, `src/map/vertexLayout.js`,
  `src/wad/Textures.js` (exporta `readTextureDefs`);
- jogo: `src/game/sound.js`, `src/game/MonsterAI.js` (`spechit` e `useDoor`) e `src/game/itemText.js`
  (mensagens de chave);
- HUD e menu: `src/hud/HudAssets.js` (INTERPIC), `src/hud/HudRenderer.js` (estatísticas),
  `src/menu/Menu.js` e `src/menu/menuText.js`;
- `src/main.js`;
- `tools/check-items.mjs`: o teste de quebra de mensagem usa só as mensagens de coleta, e as de chave
  ganharam uma verificação própria.

## Verificações (sem navegador)

- `node --check` em todos os `.js` e `.mjs` (cópias `.mjs` temporárias) e ESLint.
- `tools/check-specials.mjs`, testes a a p:
  - hash da geometria;
  - geometria dinâmica igual à estática no início e com as portas em 25, 50 e 100% e os elevadores
    abaixados, contra uma cópia de referência;
  - portas: 274 tics no ciclo da porta 55;
  - esmagamento;
  - elevadores: 173 tics;
  - uso, chaves, tags, cruzamento e interruptores;
  - saída e reset;
  - monstro e porta comum: 20 de 20 sementes atravessam, em 124 tics;
  - som com a porta fechada e aberta;
  - física, visão e hitscan numa porta do E1M1;
  - relatório e lumps.
- Os demais scripts de verificação das etapas anteriores.

Os resultados de cada comando estão no resumo da etapa.
