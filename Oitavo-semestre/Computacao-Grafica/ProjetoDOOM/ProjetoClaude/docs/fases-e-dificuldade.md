# Fases, episódios e dificuldade (etapa 23)

## Arquitetura por nível

Tudo o que depende do mapa fica num "nível", montado em três partes:

| Parte | Módulo | O que guarda |
|---|---|---|
| Dados (CPU) | `src/game/LevelData.js` | `buildLevelData(wad, nome, { skill, cache, maxLayers })`: mapa, texturas, céu, `LevelState`, especiais, geometria estática e dinâmica, colisão, cena de sprites (com o filtro de dificuldade), totais e saídas |
| GPU | `src/gpu/LevelGpu.js` | `uploadLevel(device, data, globais)`: texture arrays de paredes e flats, 5 buffers estáticos, 3 dinâmicos, recursos de sprites e os bind groups; `dispose()` destrói tudo |
| Execução | `src/game/LevelRuntime.js` | `createLevelRuntime(data, deps)`: monstros e IA, itens, efeitos, projéteis, sólidos, automapa, a cópia `sectorSpecial` (segredos) e `levelStats()` |

O que é global e criado uma vez fica fora do nível:
- device;
- pipelines da cena, dos sprites, do menu, do HUD e das partículas;
- layouts;
- a paleta iluminada (PLAYPAL + COLORMAP → 256x32);
- o `TextureCache` (TEXTURE1, PNAMES, patches e flats já decodificados);
- áudio, menu, jogador e câmera.

As pipelines não são recriadas por mapa.

### Por que o nível novo é montado antes de descartar o antigo

`startLevel` (no `main.js`) monta o próximo nível inteiro enquanto o atual continua na tela:
1. CPU;
2. GPU, com `pushErrorScope('validation')` em cada parte;
3. execução.

Só então troca as referências (`installLevel`) e chama `dispose()` no anterior. Assim:
- se qualquer passo falhar, o nível atual continua intacto. O erro vai para o console e para o quadro vermelho, e a mensagem "FALHA AO CARREGAR <mapa>" aparece na barra;
- a tela nunca fica preta: o nível anterior, ou a intermissão, continua sendo desenhado durante a carga, com o texto LOADING... / CARREGANDO... por cima.

Destruir buffers e texturas logo depois da troca é seguro: a GPU só os libera quando os comandos já enviados terminam.

Os contadores `liveCounts` de `LevelGpu.js` somam buffers, texturas e bind groups vivos dos níveis. O HUD de texto mostra esses números, e `tools/check-levels.mjs` confere que voltam ao início depois das cargas e descartes.

## Lista de mapas

`listMaps` (`GameSession.js`) encontra os marcadores ExMy seguidos dos 10 lumps de mapa, em ordem de episódio e mapa. O freedoom1.wad tem 36 (E1M1 a E4M9). Num WAD sem ExMy, o primeiro MAPxx é usado como mapa único, sem progressão.

## Menu

O fluxo é NEW GAME → episódio → dificuldade → (só no Nightmare) confirmação → carga do mapa 1 do episódio.

| Tela | Posições (m_menu.c) | Detalhes |
|---|---|---|
| Episódio | título M_EPISOD em (54, 38); itens M_EPI1 a M_EPI4 em x 48, y 63, de 16 em 16 | Pulada se o WAD tiver um só episódio |
| Dificuldade | M_NEWG em (96, 14); M_SKILL em (54, 38); M_JKILL, M_ROUGH, M_HURT, M_ULTRA, M_NMARE em x 48, y 63 | O cursor começa no terceiro item |
| Confirmação do Nightmare | Texto próprio, centrado | Y ou Enter confirma (no português também S); N, Esc ou Backspace volta |

No português, os rótulos usam a fonte STCFN em vez dos gráficos.

A troca de mapa para depuração fica em OPTIONS → DEBUG → LEVEL DEBUG: NEXT MAP, PREV MAP e RELOAD LEVEL. O GAME DEBUG já ocupa a tela até y = 187.

## Dificuldade (`src/game/skill.js`)

| Regra | Dificuldades | Origem no Doom |
|---|---|---|
| Filtro de objetos: bit 1 (1 e 2), bit 2 (3), bit 4 (4 e 5) | todas | `P_SpawnMapThing` |
| Munição recebida em dobro | 1 e 5 | `P_GiveAmmo` (`num <<= 1`) |
| Dano ao jogador pela metade, antes da armadura | 1 | `P_DamageMobj` (`damage >>= 1`) |
| `reactionTime` 0 ao nascer | 5 | `P_SpawnMobj` |
| Ataque à distância sem esperar o `movecount` | 5 | `A_Chase` |
| Sem nova direção depois do ataque | 5 | `A_Chase` (`MF_JUSTATTACKED`) |
| Demônio e espectro: corrida, ataque e dor com metade dos tics | 5 | `G_InitNew` (`S_SARG_RUN1` a `S_SARG_PAIN2`) |
| Projéteis do diabrete e do barão a 20 | 5 | `G_InitNew` (`mobjinfo[...].speed`) |
| Renascimento | 5 | `P_NightmareRespawn` |

Detalhes do renascimento:
- condições: corpo de monstro há 420 tics ou mais, `leveltime & 31 == 0` e `P_Random <= 4`;
- só se o ponto de início estiver livre;
- névoa TFOG e o som "telept" nos dois pontos;
- não conta no total de monstros.

As tabelas originais (`MISSILE_TYPES`, `AI_TABLE`, `MONSTER_TABLE`, `ITEM_TABLE`) não são alteradas; os efeitos são aplicados a partir de `skillParams`. A dificuldade é só da sessão (não é salva).

## Estatísticas e segredos

`levelStats()` devolve `{ kills, totalKills, items, totalItems, secrets, totalSecrets, tics }`.

Um setor com especial 9 conta como segredo quando:
- o jogador está vivo;
- os pés estão exatamente no chão do setor (`P_PlayerInSpecialSector`).

Ao contar, a cópia `sectorSpecial` daquele setor vira 0 (os dados do mapa não mudam) e aparece a mensagem "A secret is revealed!" / "UM SEGREDO FOI REVELADO!". A mensagem vem de ports posteriores: o Doom 1.9 não mostra nada.

## Estado do jogador entre mapas (`GameFlow.LEVEL_ENTRY`)

| Motivo | Jogador | Modo deus e noclip |
|---|---|---|
| Saída da fase | passam vida, armadura e tipo, armas, arma atual, munição e mochila; zeram chaves, `damageCount` e `bonusCount` | continuam |
| Morte (reinicia o mapa atual) | começo de pistola | continuam |
| NEW GAME, IDCLEV | começo de pistola | desligados |
| NEXT/PREV MAP (depuração) | como a saída | continuam |
| RELOAD LEVEL | nada muda | continuam |

## Progressão (`GameFlow.nextMap`)

- Os mapas 1 a 7 vão ao seguinte.
- O mapa 8 vai direto ao fim do episódio, sem intermissão, como foi pedido.
- A saída secreta leva ao mapa 9 e guarda a volta, que é o mapa de origem + 1.
- Entrando no 9 por IDCLEV, a volta vem da tabela do Doom 1: E1→4, E2→6, E3→7, E4→3.
- Um mapa inexistente vira fim de episódio.

## Intermissão (`Intermission.js` e `IntermissionRenderer.js`, regras do wi_stuff.c)

**Lumps usados:**
- fundo: WIMAP0 a WIMAP2, ou INTERPIC no episódio 4;
- títulos: WILVxy, WIF ("finished"), WIENTER ("entering");
- rótulos: WIOSTK, WIOSTI, WISCRT2, WITIME;
- números: WINUM0 a WINUM9, WIPCNT, WICOLON, WISUCKS.

**Posições:** nomes em y = 2; rótulos em (50, 50) com linhas de 1,5 vez a altura de WINUM0; porcentagens à direita de x = 270; tempo em (16, 168), com o valor à direita de x = 144.

**Contagem:**
1. Pausa de 35 tics.
2. Mortes, itens e segredos: cada um sobe de -1 em passos de 2 por tic, com uma pausa de 35 tics entre eles. Com 50%, a contagem leva 26 tics.
3. Tempo: sobe 3 segundos por tic.
4. Sons: "pistol" quando `bcnt & 3 == 0`, "barexp" ao fim de cada contagem.
5. Acelerar (fogo, uso, Enter, espaço ou clique) pula aos valores finais, com "barexp".
6. Outra tecla toca "sgcock" e mostra a tela "entering" com o nome do próximo mapa.

**Formato:**
- total 0 vira 0% (o total é tratado como 1);
- o tempo segue o `WI_drawTime`: 65 s aparece como "01:05", com os minutos em 2 dígitos;
- acima de 61:59 aparece WISUCKS.

Durante a intermissão e o fim de episódio, o pointer lock é solto e perder o mouse não abre o menu. Esc abre o menu por cima da tela.

## Fim de episódio (`Finale.js`)

- Fundo: o flat FLOOR4_8 repetido.
- Texto próprio do projeto, por episódio, em inglês e português (`menuText.js`).
- O texto é escrito 1 caractere a cada 3 tics, a partir de (10, 10), com linhas de 11 pixels.
- Uma tecla com o texto incompleto mostra tudo. Com o texto completo aparece "PRESS A KEY", e a tecla seguinte volta ao título.

## IDCLEV

IDCLEV seguido de dois dígitos (linha de cima ou teclado numérico) troca de mapa:
- a espera dura 105 tics;
- os dígitos são consumidos e não trocam de arma;
- Esc ou a perda do mouse cancelam;
- um mapa inexistente mostra "No such level".

## Simplificações

- Sem tempo par (WIPAR).
- Sem os marcadores do mapa da intermissão (WISPLAT e WIURH0/1) e sem as animações WIA.
- A tela "entering" espera o jogador. No Doom ela avança sozinha em 4 s.
- Só mapas ExMy, com recuo para um MAPxx único.
- O fim de episódio tem texto próprio e volta ao título. O Doom mostraria as telas de arte depois do texto.
- O mapa 8 vai ao fim do episódio sem intermissão.
- O fim do E1M8 depende de uma saída no mapa. A morte dos chefes (`A_BossDeath`) não termina a fase.

## Limites de camadas

O dispositivo pede até 1024 camadas de texture array. Com o padrão do WebGPU (256), os sprites descartam quadros por categoria: morte esfacelada, dor, corrida extra e, novidade desta etapa, ataque.

Medido em todos os mapas:

| Recurso | Máximo de camadas |
|---|---|
| Paredes | 142 |
| Flats | 70 |
| Sprites (com 256 de limite) | 255 |

Todos os mapas cabem nos dois limites.
