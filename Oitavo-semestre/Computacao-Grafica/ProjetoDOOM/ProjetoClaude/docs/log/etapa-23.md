# Etapa 23: vários mapas e episódios, dificuldade, estatísticas, intermissão, fim de episódio e IDCLEV

## Pedido

Pedido da etapa:
- jogar todos os mapas e episódios do WAD;
- dificuldade com os efeitos do Doom;
- estatísticas por fase com segredos;
- intermissão completa e fim de episódio;
- IDCLEV.

Restrições:
- sem mudar pipelines nem shaders, e sem recriar pipelines por mapa;
- o próximo nível é montado inteiro antes de descartar o atual;
- em caso de falha, o nível atual continua e aparece "FALHA AO CARREGAR <mapa>";
- a tela nunca fica preta.

Parada obrigatória depois da parte A.

## Parte 0: linha de base de todos os mapas

`tools/baseline-all-maps.mjs` constrói os 36 mapas (E1M1 a E4M9) pelo caminho da etapa 22 e grava os hashes em `tools/baselines/geometry-all.json`.

- Nenhum mapa falhou. Nenhum tinha textura ou flat ausente, início faltando ou objeto em setor inválido.
- A entrada do E1M1 confere com `geometry-e1m1.json`.

**Mapas que falhavam:** nenhum falhava na construção. Dois problemas apareceram fora da geometria, e as correções não mudaram nenhum hash:
- **Céu do episódio 4:** o `skyNameForMap` limitava o céu a SKY3, mas o WAD tem SKY4. Agora E4 usa SKY4, com recuo para o maior céu existente.
- **E4M6 e E4M7 no limite padrão de 256 camadas:** os sprites não cabiam nem descartando os três grupos de quadros (260 e 262 camadas). A textura inteira era recusada e o mapa ficaria sem monstros. A correção acrescenta 'attack' como quarto grupo a descartar, antes de truncar as animações. Com 1024 camadas nada muda.

## Parte A: separação por nível (parada obrigatória)

- **`LevelData.js` (CPU):** tudo que depende do mapa.
  - Com um `TextureCache` compartilhado: TEXTURE1/PNAMES, patches, texturas montadas e flats.
  - A cena de sprites usa a dificuldade da sessão.
  - Verificado byte a byte nos 36 mapas contra a parte 0.
- **`LevelGpu.js` (GPU):** cada parte num `pushErrorScope` próprio.
  - Buffers dinâmicos: se falharem, voltam à geometria estática sem exclusões.
  - Texturas e buffers estáticos: se falharem, tudo é destruído e o erro é lançado.
  - Sprites: se falharem, o nível segue sem sprites.
  - `liveCounts` conta buffers, texturas e bind groups vivos.
- **`LevelRuntime.js`:** monstros, IA, itens, efeitos, projéteis, sólidos e automapa, com a mesma lógica que estava no `main.js`.
- **Global:** a paleta iluminada (uma textura para cenas, sprites e partículas) e a pipeline dos sprites, criadas uma vez.
- **`main.js`:**
  - variáveis por nível (`let`) instaladas por `installLevel`;
  - `startLevel` monta, troca e descarta o anterior;
  - o primeiro nível usa o mesmo caminho;
  - fase 'loading' com o texto LOADING... / CARREGANDO... no elemento `#loading`;
  - RELOAD LEVEL em OPTIONS → DEBUG → LEVEL DEBUG, porque o GAME DEBUG já ia até y = 187.

**Resultado do estágio A (antes da parte B):**
- hash estático e dinâmico do E1M1 idêntico;
- todos os testes anteriores passando;
- 5 cargas e descartes com device falso sem vazamento.

Na versão final, o teste (c) faz 20 ciclos alternando E1M1 e E1M2.

### Auditoria do estado global

O estado mutável de módulo é:
- `settings` (global por definição);
- `box` e `extra` do `errorOverlay` (interface);
- `liveCounts` (contador);
- WeakMaps de cache por mapa ou paleta (`seen.js`, `HudRenderer.js`), que morrem com o mapa antigo;
- tabelas preenchidas só na carga do módulo (`AI_TABLE[58]`, `AI_TABLE[3003]`).

As tabelas (`MISSILE_TYPES`, `AI_TABLE`, `MONSTER_TABLE`, `ITEM_TABLE`) não são alteradas em tempo de execução. O teste d11 compara antes e depois.

No `main.js`:
- tudo que é do mapa virou variável do nível;
- `warnedLevel`, o rastreador de cruzamento, as teclas do automapa, a mensagem da barra, a trapaça em andamento, a chave do HUD e as partículas (geração) são zerados a cada troca;
- o jogador fica fora do nível e segue as regras abaixo.

## Decisões

- **Estado do jogador (`GameFlow.LEVEL_ENTRY`):**
  - saída: passam vida, armadura e tipo, armas, arma atual, munição e mochila; zeram chaves, `damageCount` e `bonusCount`;
  - morte, NEW GAME e IDCLEV: começo de pistola;
  - só NEW GAME e IDCLEV desligam o modo deus e o noclip;
  - RELOAD LEVEL mantém tudo;
  - NEXT/PREV MAP: como a saída (com o jogador morto, começo de pistola).
- **Dificuldade (`skill.js`):** parâmetros por dificuldade, sem alterar tabelas.
  - Munição: `stats.ammoScale` em `giveAmmo`.
  - Dano: `scaleDamage` no `damagePlayer`.
  - Nightmare:
    - no `MonsterSystem` (opção `skillParams`): `reactionTime` 0, metade dos tics do SARG (tipos 3002 e 58) e renascimento;
    - no `MonsterAI`: ataque sem esperar o `movecount` e sem nova direção depois do ataque;
    - no `MissileSystem`: `speedOf`, 20 para o diabrete e o barão.
  - A névoa TFOG entra na textura de sprites só no Nightmare, para as camadas das outras dificuldades ficarem como antes.
- **Segredos:** cópia `sectorSpecial` no nível. Conta com o jogador vivo e os pés exatamente no chão.
- **Intermissão:** seguida a regra do wi_stuff.c, com duas consequências que diferem do texto do pedido:
  - a contagem começa em -1, então 50% leva 26 tics (o pedido dizia 25);
  - o tempo usa minutos com 2 dígitos, então 65 s aparece como "01:05" (o pedido dizia "1:05").

  WISUCKS aparece acima de 61:59, ou seja, a partir de 3600 s, como o `if (t <= 61*59)` do Doom.

  A tela "entering" espera o jogador. A intermissão e o fim usam a camada 320x200 do HUD (CPU) e uma passada de limpeza preta, sem pipeline nova.
- **Ponteiro:**
  - a intermissão e o fim soltam o pointer lock e não abrem o menu ao perdê-lo;
  - Esc abre o menu por cima, e "retomar" só o fecha;
  - a tecla que conclui a tela "entering" já pede o mouse (gesto válido).
- **Fim de episódio:** FLOOR4_8 repetido, texto próprio em inglês e português, 1 caractere a cada 3 tics, "PRESS A KEY" e volta ao título.
- **IDCLEV:** `CheatReader` espera dois dígitos por 105 tics. Os dígitos são consumidos (não trocam de arma); Esc ou a perda do mouse cancelam. Mensagens próprias, exceto "Changing Level...", que é a do Doom.
- **HUD de texto:** fase da sessão, mapa, dificuldade, renascimentos, mortes, itens, segredos, tempo e objetos de GPU vivos.

## Arquivos

**Novos:**
- `src/game/LevelData.js`, `src/game/LevelRuntime.js`, `src/game/GameSession.js`, `src/game/GameFlow.js`
- `src/game/skill.js`, `src/game/Intermission.js`, `src/game/Finale.js`
- `src/gpu/LevelGpu.js`, `src/wad/TextureCache.js`, `src/hud/IntermissionRenderer.js`
- `tools/baseline-all-maps.mjs`, `tools/baselines/geometry-all.json`, `tools/check-levels.mjs`
- `debug/levels.html` e `.js`, `debug/intermission.html` e `.js`
- `docs/fases-e-dificuldade.md`

**Alterados:**
- `src/main.js`
- `src/wad/Textures.js` (cache), `src/wad/Colormap.js` (céu do E4)
- `src/gpu/TextureSet.js` (paleta global, `destroy`), `src/gpu/SpriteSet.js` (pipeline global, `destroy`)
- `src/sprites/spriteLogic.js` (descarte de 'attack')
- `src/game/MonsterSystem.js`, `src/game/MonsterAI.js`, `src/game/Missiles.js`, `src/game/effects.js` (TFOG), `src/game/pickups.js`, `src/game/Cheats.js`, `src/game/itemText.js`
- `src/menu/Menu.js`, `src/menu/MenuRenderer.js`, `src/menu/MenuAssets.js`, `src/menu/menuText.js`

**Teste de rascunho atualizado** (`stage9test`, fora do repositório): a navegação usa uma seta a mais, porque o DEBUG ganhou LEVEL DEBUG no fim, e um Enter a mais na tela de dificuldade.

## Verificações (Node, sem navegador)

- **`node --check`:** 122 arquivos .js e .mjs (cópias .mjs temporárias), 0 erros.
- **ESLint:** 0 erros e 0 avisos.
- **`tools/check-levels.mjs`:** tudo certo.
  - a) os 36 mapas: construção, índices, ausência de NaN, início e camadas; tempo de 2 a 54 ms por mapa com cache.
  - b) hashes: E1M1 idêntico; nenhum mapa diferente de `geometry-all.json`.
  - c) vazamentos e falhas injetadas.
  - d) dificuldade.
  - e) renascimento: 50 sementes, média de 2042 tics de corpo, faixa de 460 a 9612.
  - f) segredos e mortes; `totalSecrets` igual ao levantamento.
  - g) progressão e estado do jogador.
  - h) intermissão.
  - i) menus e textos dentro de 320x200.
  - j) IDCLEV.
  - k) 1500 + 500 tics em cada mapa: sem exceção, sem NaN, nenhum monstro fora do mapa.
  - l) 85 lumps procurados, nenhum ausente.
- **`tools/baseline-all-maps.mjs`:** 36 construídos, nenhum hash diferente.
- **Demais verificações:** `survey-maps` e os `check-*` anteriores (automap, projectiles, specials, player, ai, weapons, items, combat, audio, hud, collision, wgsl-reserved, sprites, menu, particles) terminam com sucesso.
- **Testes de rascunho:** stage8 (34), stage9 (76), stage12 (24) e fix10 (24), sem falhas.
- **Servidor:** os arquivos novos respondem em http://localhost:3000. As páginas .html respondem com 301 para o endereço sem extensão e, seguindo o redirecionamento, com 200.

Nada desta etapa foi testado no navegador.
