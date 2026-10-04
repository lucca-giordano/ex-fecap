# Combate

Código puro em `src/game/`: `Rng.js`, `monsterTable.js`, `MonsterSystem.js`, `hitscan.js`,
`radiusAttack.js`, `effects.js` e `stats.js`. Integração em `src/main.js`; página de depuração
`debug/monsters.html`; verificação `tools/check-combat.mjs`.

## Hitscan

Coordenadas do Doom; o raio sai do olho do jogador (pés + 41) com o yaw e o pitch da câmera (sem mira
automática vertical). O alcance de 2048 vale para a distância horizontal t: direção 2D `(cos yaw, sin
yaw)` e altura `z(t) = z0 + tan(pitch)·t`.

1. O raio 2D é cruzado com todas as linhas do mapa (força bruta, com os dados de linhas da física) e
   os cruzamentos são ordenados por t, guardando de que lado cada linha foi cruzada.
2. A partir do setor da origem, os cruzamentos são percorridos em ordem. Antes de cada um, o piso e o
   teto do setor atual são testados entre o t anterior e o atual: se o raio sair por eles, a batida é
   no plano, em `t = (z do plano − z0) / tan(pitch)`. No cruzamento, linha de um lado só é parede; linha
   de dois lados tem abertura entre o maior chão e o menor teto, e o raio fora dela bate na parede
   (superior ou inferior); dentro dela, o setor atual passa a ser o do outro lado. Depois do último
   cruzamento, os planos são testados até o alcance.
3. Cada monstro atirável é um cilindro (raio e altura do tipo): vale a entrada no círculo (menor
   t ≥ 0) com z(t) entre o chão do monstro e o chão mais a altura, se for antes da parede ou do plano.
   Vale o mais próximo.
4. Sem batida, o resultado é "none". Batida no teto de céu (F_SKY1) não gera fumaça, como no Doom.

## Dano e dor

- Dano da pistola: `5 · (next255 % 3 + 1)` (5, 10 ou 15). Do segundo disparo contínuo em diante
  (`refire > 0`), o yaw recebe `(next255 − next255) · 0.02197` graus (até cerca de ±5.6°).
- `vida −= dano`. Vida ≤ 0 mata: morte esfacelada se `vida < −vida inicial` e o tipo tiver esses
  quadros (toca "slop"), senão morte normal (som de morte, sorteado quando há mais de um). O monstro
  deixa de ser atirável. Com vida > 0, dor se `next255 < chance de dor` e o tipo tiver estado de dor
  (toca o som de dor e volta a parado no fim da sequência). Mortos não recebem dano.
- Estados avançam por tic (35/s) no relógio de jogo, que para com o menu aberto. Quadro com −1 é
  terminal (corpo); a alma perdida e o barril são removidos no fim da morte. Um monstro que muda de
  estado durante o tic em andamento (por exemplo, morto pela explosão de outro que vem antes na lista)
  só começa a contar no tic seguinte, para a duração não depender da ordem.

## Tabela de monstros

Valores de partida do `info.c` do Doom (lembrados de memória), em `src/game/monsterTable.js`: vida,
raio, altura, chance de dor (em 256), quadros por estado `[letra, tics]` e sons. Cada letra é conferida
contra os lumps do WAD por `resolveMonsterTable`; no freedoom1.wad, todos os quadros da tabela existem
e nenhuma entrada foi corrigida. Efeitos: PUFF A4 B4 C4 D4 (o primeiro com brilho máximo e duração
`4 − (next255 & 3)`, mínimo 1) e BLUD C8 B8 A8 (começa em B com dano de 9 a 12 e em A com dano menor
que 9); os dois sobem 35 u/s, no máximo 256 ao mesmo tempo (o mais antigo é descartado).

## Barris e dano em raio

No terceiro quadro da morte do barril (BEXP C), dano em raio de 128: `dist = max(|dx|, |dy|) − raio do
alvo` (mínimo 0), sem efeito se `dist ≥ 128`, dano `128 − dist` (como o P_RadiusAttack). Linha de
visão aproximada: o segmento 2D entre os centros não pode cruzar uma linha de um lado só nem uma de
dois lados com abertura ≤ 0 (porta fechada); alturas não são consideradas. O dano ao jogador só é
somado num contador do HUD de texto (não é aplicado). Barris atingidos explodem em cadeia.

## Gerador aleatório

`Rng.js` usa mulberry32 com semente (`Date.now()` no jogo, fixa nos testes). Não é a tabela de 256
números do Doom: a distribuição é a mesma (0 a 255), os resultados não.

## Mudanças no sistema de sprites

- `buildSpriteScene` aceita quadros extras (dor, morte, morte esfacelada, PUFF, BLUD, BEXP) e devolve
  um mapa global PREFIXO+letra → vistas. Sem camadas suficientes, descarta morte esfacelada, depois dor
  e, por último, a animação de parado além do primeiro quadro. No E1M1 são 176 camadas.
- O dispositivo é pedido com `maxTextureArrayLayers = min(adaptador, 1024)`, com recuo para os limites
  padrão se o pedido for recusado.
- O buffer de instâncias comporta os objetos do mapa mais 256 efeitos; cada frame escreve os objetos
  (parados, em dor, morrendo ou corpos), sem os removidos, e os efeitos. O shader de sprites não mudou.
- O `SpriteSet` é criado dentro de `pushErrorScope("validation")`, com label em todos os objetos; se a
  validação falhar, os sprites ficam desligados na sessão e o erro vai para o quadro vermelho.

## Simplificações

Sem IA (os monstros não acordam, não andam e não atacam), sem mira automática vertical, sem knockback
(empurrão por dano), sem itens soltos pelos monstros, sem dano ao jogador e com gerador aleatório
próprio.
