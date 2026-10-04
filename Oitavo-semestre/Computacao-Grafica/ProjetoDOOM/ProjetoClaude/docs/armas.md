# Armas

Código puro: `src/game/weapons.js` (tabela, máquina de estados, troca, munição, balanço e projéteis) e
`src/game/fireWeapon.js` (hitscan, sangue, fumaça e dano de um evento "fire"). `src/game/pistol.js`
só reexporta, para os testes das etapas 13 a 15. Integração em `src/main.js` e `src/hud/HudRenderer.js`;
página de depuração `debug/hud.html`; verificação `tools/check-weapons.mjs`.

## Tabela

Quadros `[letra, tics, ação]`, com valores de partida do info.c do Doom (lembrados de memória). Todas
as letras existem no freedoom1.wad, e nenhum quadro precisou ser corrigido.

| Slot | Arma | Prefixo | Munição | Ataque | Clarão |
|------|------|---------|---------|--------|--------|
| 1 | soco | PUNG | — | B4, C4 (soco), D5, C4, B5 (refire): 22 tics | — |
| 2 | pistola | PISG | balas | A4 (tiro), B6, C4, B5 (refire): 19 tics | PISF A 7 |
| 3 | espingarda | SHTG | cartuchos | A3, A7 (tiro), B5, C5, D4, C5, B5, A3, A7 (refire): 44 tics | SHTF A 4 + B 3 |
| 4 | metralhadora | CHGG | balas | A4 (tiro), B4 (tiro), B0 (refire): 8 tics, 2 tiros | CHGF A 5 / B 5 |

Os slots 5, 6 e 7 (lança-foguetes, plasma e BFG) estão na tabela como não utilizáveis: as teclas e a roda
os ignoram, com um aviso único no console por arma.

## Máquina de estados

Fases: descendo, subindo, parada e atacando. A ação de tiro roda ao entrar no quadro e gasta 1 de
munição (o soco não gasta); sem munição, o quadro não dispara. A ação `refire` é avaliada quando o
quadro dela termina: com o disparo ainda pressionado, sem troca pendente e com munição, o ataque
recomeça e o contador `refire` sobe 1; senão, ele volta a 0 e a arma passa à verificação de munição e ao
estado parado. Eventos: `fire` (arma, ação, refire, clarão) e `weaponChanged`. O balanço da etapa 13
vale para todas as armas, só no estado parado.

## Troca de arma

O pedido define a arma pendente. Com a arma parada, a descida começa na hora; atacando, espera o fim do
ataque. A descida soma 6 por tic até 128 e a subida tira 6 por tic até 32: 16 tics cada, 32 no total.
Pedidos para a arma atual, uma não possuída, uma não utilizável ou uma com lumps ausentes são
ignorados. Ao pegar itens, uma arma nova utilizável vira a pendente. Balas pegas com 0 balas e o soco na
mão trocam para a metralhadora (se possuída) ou para a pistola. Cartuchos pegos com 0 cartuchos, com o
soco ou a pistola na mão, trocam para a espingarda, se possuída.

## Verificação de munição

Como o P_CheckAmmo: uma arma tem munição com pelo menos 1 do tipo dela. Antes de começar um ataque e
no fim dele, sem munição, a próxima arma é a primeira desta ordem que estiver possuída e utilizável:
metralhadora com balas, espingarda com cartuchos, pistola com balas e soco.

## Tiros

- Pistola e metralhadora: dano `5 · (next255 % 3 + 1)`; com `refire > 0`, o yaw ganha
  `(next255 − next255) · 0.02197` graus. Alcance 2048. Som `pistol`.
- Espingarda: 7 projéteis, cada um com dano e desvio de yaw próprios (sempre com desvio) e o mesmo
  pitch. Som `shotgn`. Conta como 1 disparo, e como acerto se algum projétil pegar monstro ou barril.
- Soco: dano `(next255 % 10 + 1) · 2` (2 a 20), com desvio de yaw e alcance 64. Acertando monstro ou
  barril, toca `punch`. Na parede ou no plano, a fumaça começa no quadro C, sem som.

## Teclas

1 a 7 escolhem a arma (5 a 7 não fazem nada); a roda do mouse avança (para cima) ou volta pelas armas
possuídas e utilizáveis, a cada 100 unidades acumuladas e com pelo menos 120 ms entre trocas, só com o
pointer lock, o jogo iniciado e o menu oculto. Iluminação passou para L, CRT para X e visual para V, e
o HUD de texto continua no 0. Texturas, cor por setor, culling e teste do céu ficaram só no submenu
DEBUG. Nenhuma tecla usa Ctrl, Alt, Meta nem Shift. A tela READ THIS! tem duas páginas, que mudam com
as setas esquerda e direita ou com o Enter.

## Simplificações

Não há lança-foguetes, plasma, BFG nem motosserra utilizáveis. Também não há mira automática vertical
(vale o pitch da câmera), som de arma vazia nem aumento de luz do setor no disparo.
