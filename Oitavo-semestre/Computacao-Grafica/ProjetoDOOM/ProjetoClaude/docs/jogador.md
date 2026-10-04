# Jogador: dano, morte, flashes e rosto

Código puro: `src/game/PlayerDamage.js`, `src/game/PlayerDeath.js`, `src/hud/face.js` e
`src/gpu/palettesTint.js`; estado em `src/game/PlayerStats.js`. A variante do blit com flash está em
`src/shaders/blitTint.wgsl` e `src/shaders/crtTint.wgsl` (cópias; os originais não mudaram), ligada por
`Display.attachTint`. Integração em `src/main.js`; verificação `tools/check-player.mjs`.

## Dano e armadura

`applyDamage` segue a ordem do P_DamageMobj do Doom:

1. Com godMode, jogador morto ou dano menor ou igual a zero, nada acontece.
2. A armadura verde absorve `floor(dano / 3)` e a azul `floor(dano / 2)`. Se a armadura não alcançar,
   absorve o que resta e o tipo volta a 0.
3. A vida perde o resto e pode ficar negativa (até −1000). A barra mostra no mínimo 0.
4. `damageCount` soma o dano depois da armadura (máximo 100) e guarda o último atacante (`null` para
   barril e teste).
5. Vida menor ou igual a 0 é morte. O som é `pdiehi` abaixo de −50 e `pldeth` nos outros casos; sem
   morte, toca `plpain`.

Os tiros e mordidas da IA e a explosão de barril passam por aqui. O HUD de texto mostra o dano recebido
por origem e o absorvido pela armadura.

## Morte e reinício

Como o P_DeathThink:

- o olho desce 1 unidade por tic de 41 até 6;
- a câmera gira até 5 graus por tic em direção ao assassino e trava a menos de 5 graus;
- a arma desce 6 por tic até 128 e fica lá;
- movimento, disparo, troca de arma e mouse ficam ignorados (a gravidade continua);
- os monstros perdem o alvo e voltam a parado.

Depois de 35 tics aparece "PRESS USE (E) OR CLICK TO RESTART". E, clique ou Enter executam a mesma
rotina do NEW GAME.

## Flashes

A escolha da paleta segue o ST_doPaletteStuff, e o dano tem prioridade sobre o bônus:

- com `damageCount` maior que 0: paleta `min(7, floor((damageCount + 7) / 8)) + 1` (2 a 8);
- senão, com `bonusCount` maior que 0: paleta `min(3, floor((bonusCount + 7) / 8)) + 9` (10 a 12);
- senão: paleta 0.

O Doom troca a paleta inteira. Aqui a imagem final já está em RGB, então o blit mistura cada pixel com
uma cor alvo: `mix(cor, T, t)`. A mistura vale para a cena, o HUD, a barra e o menu, mas não para as
barras pretas laterais.

O `t` de cada paleta é ajustado uma vez, por mínimos quadrados contra o PLAYPAL do WAD: a soma de
`(ck − c0)(T − c0)` dividida pela soma de `(T − c0)²`, limitada a 0..1. As cores alvo são
T = (255, 0, 0) para as paletas 1 a 8 e (215, 186, 69) para as 9 a 12. No freedoom1, o erro médio da
aproximação fica abaixo de 0.5 nível por canal em todas as paletas, então os alvos não foram ajustados.

A mistura entra em `nearest()` (sem CRT) e no `Fetch()` do CRT, antes de `ToLinear`. Com `t = 0` a cor
não muda. O uniform da variante tem 48 bytes, com `tint` (vec4) no offset 32.

## Rosto

Prioridade, da maior para a menor:

1. morto;
2. sorriso por 70 tics depois de uma arma nova;
3. atacado nos últimos 35 tics: OUCH se o golpe tirou mais de 20; senão KILL de frente (menos de 45
   graus), TR com o atacante à direita e TL à esquerda;
4. dano sem atacante nos últimos 35 tics: OUCH ou KILL;
5. GOD MODE;
6. reto, com o olhar sorteado a cada 17 tics por um gerador próprio.

O nível de dor é `floor((100 − min(vida, 100)) * 5 / 101)`, o do ST_calcPainOffset. Ele dá 0, 0, 0, 1,
2, 3 e 4 para as vidas 100, 99, 80, 60, 40, 20 e 1.

## Simplificações

Não há berserk, traje antirradiação, dano de piso, esmagamento por teto, recuo do jogador ao levar golpe
nem infighting.
