# Barra de status e pistola

Código: `src/game/PlayerStats.js` (vida, armadura, munição), `src/game/pistol.js` (máquina de estados e
balanço), `src/hud/HudAssets.js` (lumps), `src/hud/HudRenderer.js` (composição) e `src/gpu/HudPass.js`
com `src/shaders/hud.wgsl` (passada de GPU). Página de depuração: `debug/hud.html`.

## Composição da camada

`composeHud(estado, assets, tics)` desenha uma imagem RGBA de 320x200, transparente onde não há
desenho, reaproveitando `createBuffer` e `drawPatch` do menu:

1. A pistola, iluminada pelo setor sob o jogador, e o clarão em brilho máximo.
2. A barra por cima, nas linhas 168 a 199 (coordenadas do `st_stuff.c` do Doom): `STBAR` em (0, 168),
   `STARMS` em (104, 168); números grandes alinhados à direita (munição até x = 44, vida até x = 90 com
   `%` em 90, armadura até x = 221 com `%` em 221, todos em y = 171); painel de armas nos slots 2 a 7 em
   x = 111 + (i mod 3)·12, y = 172 + ⌊i/3⌋·10 (possuído em `STYSNUM`, os demais em `STGNUM`); rosto em
   (143, 168); tabela de munição com `STYSNUM` alinhados à direita em x = 288 (atual) e 314 (máximo), nas
   linhas 173, 179, 185 e 191.

Números: sem zeros à esquerda; 0 aparece como um único "0"; a largura de cada dígito é a do dígito 0.
Rosto: nível de dor `clamp(⌊(100 − vida)·5/101⌋, 0, 4)`, lump `STFST{dor}{olhar}`, `STFDEAD0` com vida
≤ 0. O olhar é 1 (frente); depois de cada intervalo de 40 a 120 tics, olha 15 tics para 0 ou 2, com
sorteio de semente fixa.

Na GPU, a imagem vai para uma textura 320x200, recomposta só quando algo visível muda, e é desenhada na
textura interna da cena com escala inteira e centralizada (mesma regra do menu). Nas linhas da barra,
os pixels fora da imagem centralizada repetem a coluna de borda, para a barra ocupar a largura inteira
no modo moderno. Ordem das passadas: cena, sprites, partículas, **HUD**, menu, blit/CRT.

## Máquina de estados da pistola (em tics, 35 por segundo)

| Estado | Quadro | Duração | O que faz |
|---|---|---|---|
| Levantando | PISGA | (128 − 32) / 6 = 16 tics | sy desce de 128 a 32, 6 por tic; não dispara |
| Pronta | PISGA | 1 tic por verificação | com o disparo pressionado e munição > 0, começa o disparo; aplica o balanço |
| Disparo 1 | PISGA | 4 | gasta 1 bala e começa o clarão (PISFA, 7 tics) |
| Disparo 2 | PISGB | 6 | |
| Disparo 3 | PISGC | 4 | |
| Disparo 4 | PISGB | 5 | no fim: segurando e com munição, volta ao disparo 1; senão, pronta |

Um disparo completo dura 19 tics. Durante o disparo, a posição fica congelada na última de "pronta".
O relógio de tics é o relógio de jogo, que para com o menu aberto.

## Posição e balanço

Coluna esquerda `x = round(sx − leftOffset)` e linha de cima `y = ⌊sy − topOffset − 16.5⌋`, com os
offsets do próprio lump. O 16.5 vem do `R_DrawPSprite` com a visão de 168 linhas (centro em 84) e
`BASEYCENTER = 100`: topo = 84 − (100 + 0.5 − (sy − topOffset)). Em repouso, sx = 1 e sy = 32.

Balanço (só em "pronta"): `a = 2π·(tics mod 64)/64` (período de 64 tics, como `128·leveltime` no Doom),
`sx = 1 + A·cos a`, `sy = 32 + A·|sin a|`, com `A = 16·clamp(velocidade / velocidade base, 0, 1)`,
suavizada com decaimento exponencial (constante de 0.15 s). A velocidade é a horizontal real da física
de andar; voando ou no ar, A tende a 0.

Iluminação da arma: nível `clamp((15 − lightnum)·4 − 23, 0, 31)`, com lightnum = luz do setor sob o
jogador / 16; clarão no nível 0; tudo no nível 0 com a iluminação desligada. Aplicado na CPU com a paleta
iluminada (PLAYPAL + COLORMAP).

## Simplificações em relação ao Doom

- A barra é desenhada por cima da imagem, em vez de a visão 3D ocupar só as 168 linhas de cima.
- Rosto reduzido: só dor e olhar para os lados (sem reação a dano, a armas novas ou ao ataque).
- Uma única arma (pistola), sem troca de arma; o tiro não atinge nada (sem hitscan) e não tem som.
- Sem flashes de paleta (dano, itens) e sem chaves.
