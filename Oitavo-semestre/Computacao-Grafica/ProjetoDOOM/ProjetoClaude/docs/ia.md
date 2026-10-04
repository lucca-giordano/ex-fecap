# IA dos monstros

Código puro: `src/game/aiTable.js` (tabelas e constantes), `src/game/sight.js` (visão),
`src/game/sound.js` (alerta sonoro), `src/game/MonsterAI.js` (ações, movimento e ataques) e
`src/game/PlayerDamageSink.js` (contadores de dano ao jogador). O `MonsterSystem` ganhou os estados de
IA. Integração em `src/main.js`; página de depuração `debug/ai.html`; verificação `tools/check-ai.mjs`.
Os valores vêm do info.c e do p_enemy.c do Doom, lembrados de memória, e as letras dos quadros foram
conferidas contra os lumps do freedoom1.wad.

## Quem tem IA

Zumbi (3004), sargento (9), diabrete (3001, só corpo a corpo), demônio (3002) e espectro (58). O
cacodemônio, o barão e a alma perdida continuam passivos, como na etapa 17. Um tipo sem quadros de
corrida, ou sem nenhum quadro de ataque, fica passivo e é listado no console.

| Tipo | Velocidade | Corrida | Ataque | Sons |
|------|-----------|---------|--------|------|
| POSS | 8 | A–D, 4 tics cada (2 por letra) | E10 faceTarget, F8 tiro (brilho), E8 | posit1–3, posact, pistol |
| SPOS | 8 | A–D, 4 tics | E10 faceTarget, F10 3 tiros (brilho), E10 | posit1–3, posact, shotgn |
| TROO | 8 | A–D, 3 tics | E8, F8 faceTarget, G6 garra | bgsit1–2, bgact, claw |
| SARG / 58 | 10 | A–D, 2 tics | E8, F8 faceTarget, G8 mordida | sgtsit, dmact, sgtatk |

O parado é A10, B10 com a ação look. A dor é a da etapa 15. O som de dor toca ao entrar no 2º
quadro, como o A_Pain, e o fim da dor leva à corrida.

## Sentidos

- **Visão** (P_CheckSight): parte do olho do monstro (pés + 0.75 da altura) e vai até a faixa vertical do
  jogador (pés a pés + 56). As linhas cruzadas são percorridas em ordem de distância:
  - linha de um lado só bloqueia;
  - abertura menor ou igual a zero bloqueia;
  - chãos ou tetos diferentes estreitam as inclinações de baixo e de cima;
  - se a de cima ficar menor ou igual à de baixo, bloqueia.

  Não há limite de alcance nem tabela de rejeição.
- **Som** (P_RecursiveSound): o grafo de setores (linhas de dois lados com abertura > 0) é montado uma
  vez. Uma linha com a flag 0x0040 só é atravessada antes de qualquer outra assim. Todo disparo do
  jogador, inclusive o soco, alerta os setores alcançados, e o alerta vale até NEW GAME ou RESET
  MONSTERS.

## Máquina de estados

Cada quadro é `[letra, tics, ação]`; a ação roda uma vez ao entrar no quadro.

- **look:** acorda pelo setor alertado; um monstro de emboscada (ambush) só acorda assim se também tiver
  visão. Também acorda pela visão do jogador, dentro de 180 graus à frente ou a até 64 unidades.
- **chase:** segue a ordem do A_Chase:
  1. tira 1 do tempo de reação;
  2. gira 45 graus em direção a movedir;
  3. sem alvo, volta a parado;
  4. depois de um ataque à distância, só escolhe nova direção;
  5. ataque corpo a corpo, se estiver ao alcance;
  6. ataque à distância (só POSS e SPOS), com movecount zerado e checkMissileRange;
  7. anda (movecount, P_Move ou P_NewChaseDir);
  8. som ativo com chance de 3/256.
- **P_NewChaseDir:** tenta a diagonal até o alvo, os dois eixos (trocados ao acaso ou se o y domina), a
  direção antiga, as outras em ordem aleatória e, por último, a meia-volta.
- **Dano:** zera o tempo de reação e marca o jogador como alvo, e quem estava parado vai direto à corrida
  (sem som de ver). Se o dano causar dor, marca justHit, que libera um ataque à distância imediato. A
  explosão de barril conta como dano do jogador.

## Ataques

- POSS e SPOS: 1 e 3 tiros, cada um com desvio `(next255 − next255) · 0.0878` graus (até 22.4) e dano
  `(next255 % 5 + 1) · 3`.
- TROO: dano `(next255 % 8 + 1) · 3`; SARG: `(next255 % 10 + 1) · 4`. Os dois só acertam de perto, com o
  jogador a uma distância aproximada menor que 60.
- O tiro de monstro reaproveita o `shoot()` do jogador, sem mudanças, passando o jogador como único alvo
  (cilindro de raio 16 e altura 56). Ele sai dos pés + 32 (o Doom usa altura/2 + 8 = 36) e mira o centro
  do jogador (pés + 28). Paredes, planos e janelas bloqueiam o tiro; monstros e sólidos, não.
- O dano só é contado por tipo e origem. A vida do jogador não muda nesta etapa.

## Colisão

A colisão é uma caixa de meia-largura igual ao raio do monstro, como o P_CheckPosition e o P_TryMove do
Doom. Uma linha que cruza a caixa bloqueia se for de um lado só ou tiver as flags 0x0001 ou 0x0002. As
outras linhas ajustam o chão, o teto e a beirada. O movimento falha:

- se o monstro não couber;
- se bater a cabeça;
- se o degrau passar de 24;
- se a queda passar de 24;
- se a caixa sobrepuser o jogador, outro monstro vivo, um barril ou decoração sólida.

Corpos não bloqueiam, e o z do monstro passa a ser o chão encontrado.

## Simplificações

Não há portas (linhas especiais não são ativadas), infighting, tabela de rejeição, projéteis (bola de
fogo, foguetes), monstros voadores nem modo pesadelo. Só 5 tipos têm IA. O tiro de monstro só atinge o
jogador. No monstro parado, o sprite usa a animação da etapa 11.
