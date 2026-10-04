# Itens, itens largados e objetos sólidos

Código puro: `src/game/PlayerStats.js`, `src/game/itemTable.js`, `src/game/itemText.js`,
`src/game/pickups.js`, `src/game/ItemSystem.js` e `src/physics/solids.js`. Integração em `src/main.js`
e `src/hud/HudRenderer.js`; página de depuração `debug/items.html`; verificação `tools/check-items.mjs`.
Os valores vêm do Doom original (p_inter.c e mobjinfo), lembrados de memória e comentados no código.

## Estado do jogador

- Munição em quatro tipos: `clip` (balas), `shell` (cartuchos), `rocket` (foguetes) e `cell` (células).
  Começa com 50 balas; máximos 200, 50, 50 e 300, dobrados pela mochila. Tamanho do clip: 10, 4, 1 e 20.
- Armadura com tipo: 0 nenhum, 1 verde, 2 azul. Quando a armadura chega a 0, o tipo volta a 0.
- Armas possuídas por slot (1 soco e 2 pistola no início). A motosserra divide o slot 1 com o soco, que
  é sempre possuído, então tem um campo próprio (`hasChainsaw`).
- Seis chaves (cartões e caveiras azul, amarela e vermelha).
- `bonusCount`: +6 a cada coleta e −1 por tic (ainda sem efeito visual).
- `reset()` restaura tudo. Valores sempre inteiros.

## Regras de coleta

| Item | Regra |
|------|-------|
| Stimpack, medikit | +10 / +25 até 100; só pega com vida abaixo de 100 |
| Bônus de vida | +1 até 200; sempre pega (conta nos itens) |
| Soulsphere | +100 até 200 (conta) |
| Megasphere | vida 200, armadura 200 azul (conta) |
| Bônus de armadura | +1 até 200; se o tipo for 0, vira verde (conta) |
| Armadura verde / azul | 100 tipo 1 / 200 tipo 2; só pega se a armadura atual for menor (conta) |
| Munição | n clips do tipo; não pega no máximo. Clip largado por monstro: meio clip (5) |
| Mochila | dobra os máximos (uma vez) e dá 1 clip de cada tipo; sempre pega |
| Armas | 2 clips do tipo (1 se largada); já possuída, só pega se ganhar munição |
| Chaves | só pega se ainda não tiver |

Toda coleta toca `itemup` (armas: `wpnup`) e mostra a mensagem no canto superior esquerdo por 140 tics
(4 segundos), na fonte STCFN do menu; mais larga que 320 pixels, quebra em duas linhas de 12 pixels.
As mensagens ficam em `itemText.js`, em inglês e português, escolhidas pelo mesmo `MENU_LANG` do menu.

## Alcance

Como no `PIT_CheckThing` do Doom: caixa, não círculo. O item é pego se `|dx|` e `|dy|` forem menores
que `20 + 16` (raio do item + raio do jogador) e a altura do item em relação aos pés estiver entre −8 e
56. A coleta roda uma vez por tic de jogo, pelos pés do jogador (no modo voar, olho − 41). Jogador morto
não pega nada; item não pego (vida cheia, munição no máximo) fica no mapa.

## Itens largados

Quando um monstro morre, o `MonsterSystem` emite um evento `died`. Zumbi (3004) larga um clip (2007),
sargento (9) uma espingarda (2001) e comando (65) uma metralhadora (2002), na posição do monstro e no
chão do setor dela. Cada morte gera no máximo um item; há no máximo 128 itens largados (o mais antigo
é descartado). Itens largados não contam no total de itens.

NEW GAME e RESET MONSTERS restauram os itens do mapa, apagam os largados e zeram os contadores.

## Objetos sólidos

No modo andar, o jogador colide com monstros e barris vivos (raio da tabela de monstros) e com a
decoração fixa: raio 16, exceto a árvore grande (54) com 32 e o barril em chamas (70) com 10. A colisão
é em caixa, sem altura. O empurrão é pelo eixo de menor penetração, mais 0.01; paredes e sólidos são
resolvidos em até 4 rodadas alternadas, e as paredes ficam com a última palavra. Monstro morto ou barril
que explodiu deixa de ser sólido. No modo voar não há colisão. Os sólidos não afetam o hitscan nem o
dano em raio.

## Barra de status

- Chaves em (239, 171), (239, 181) e (239, 191), com `STKEYS0` a `2` para cartões e `3` a `5` para
  caveiras; com cartão e caveira da mesma cor, aparece a caveira.
- Painel de armas pelos slots possuídos; tabela de munição com os quatro tipos, atual e máximo corrente.

## Tabelas conferidas contra o freedoom1.wad

- MEGA (83), TLMP (85) e TLP2 (86) não têm sprite no freedoom1 e ficam como não resolvidos (nenhum
  aparece no E1M1).
- Tipos acrescentados ao `thingTable.js`: 2006 (BFUG), 83 (MEGA), 25, 27, 28, 29 (empalados e caveiras),
  30 a 33, 36 e 37 (pilares) e 35 (candelabro). O tipo 47 é o toco marrom SMIT (só o nome do comentário).
- E1M1 na dificuldade 3: 77 itens, 49 contáveis (30 bônus de vida, 18 bônus de armadura, 1 armadura
  verde) e 57 sólidos fixos, mais 22 barris.

## GAME DEBUG

GIVE ALL KEYS dá as seis chaves; GIVE ALL WEAPONS dá os slots 3 a 7, a mochila e munição cheia.
