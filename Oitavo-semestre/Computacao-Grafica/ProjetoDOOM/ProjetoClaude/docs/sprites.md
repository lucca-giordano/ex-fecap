# Sprites dos objetos (THINGS)

## Localização e montagem

- Os lumps de sprite ficam entre os marcadores `S_START` e `S_END` (alternativa: `SS_START`/`SS_END`;
  sem marcadores, todos os lumps com nome de sprite e mais de 8 bytes). Nome repetido: vale a última
  ocorrência. Código: `src/wad/Sprites.js`.
- Nome: 4 caracteres de prefixo + letra do quadro + dígito da vista, com um segundo par opcional.
  `TROOA1` = quadro A, vista 1; `TROOA0` = vista única; `TROOA2A8` = o mesmo lump serve à vista 2 e,
  espelhado na horizontal, à vista 8. O segundo par é sempre o espelhado (o Freedoom tem, por exemplo,
  `SKULA8A2`, em que a vista 2 é a espelhada).
- Imagens no formato "picture" (o mesmo dos patches das texturas), decodificadas pelo `decodePatch` da
  etapa 5. Os offsets `leftOffset` e `topOffset` do cabeçalho definem a âncora.
- Tabela de tipos em `src/sprites/thingTable.js`: tipo → prefixo, sequência de quadros da animação
  parada, tics por quadro (35 tics por segundo), fullbright e fuzz. Letras sem as 8 vistas no WAD saem
  da sequência; tipo sem nenhum quadro fica "não resolvido" e não é desenhado.
- Filtro de dificuldade (`SKILL = 3`): o objeto existe se não tem a flag `0x0010` (só multiplayer) e
  tem o bit da dificuldade (`0x0001` para 1 e 2, `0x0002` para 3, `0x0004` para 4 e 5).
- Posição: base no chão do setor do objeto (`findSector` ao carregar), convertida por `doomToWorld`.
  Um texel equivale a uma unidade do Doom: ao longo da direita, de `-leftOffset` a `width - leftOffset`;
  na vertical, de `topOffset - height` a `topOffset` acima da base.
- GPU (`src/gpu/SpriteSet.js`): texture array `rg8uint` (índice da paleta, opacidade) com uma camada
  por lump usado, metadados por camada (largura, altura, offsets) em storage buffer e uma instância de
  32 bytes por objeto (base `vec3<f32>` @0, layer @12, lightnum @16, flags @20, preenchimento), reescrita
  a cada frame.

## Orientação

O quad fica sempre de pé e usa o vetor "direita" horizontal da câmera, e não a direção do objeto até
a câmera. Assim todos os sprites ficam paralelos ao plano da tela, como no Doom original: o renderizador
do Doom projeta cada sprite como uma faixa de colunas verticais na tela, com largura dada pela
distância ao longo da direção de vista, sem girar o sprite na direção do jogador e sem inclinar com o
olhar para cima ou para baixo.

## Regra da vista e animação

- Ângulo do jogador até o objeto, em graus nas coordenadas do Doom:
  `a = atan2(thingY - camY, thingX - camX)`.
- Vista: `floor(((a - ângulo do objeto) mod 360 + 202.5) / 45) mod 8 + 1` (1 = de frente para o
  jogador, 5 = de costas), como o `R_ProjectSprite` do Doom. Vista única: sempre a mesma.
- Vista espelhada: mesmo lump com as colunas invertidas (`u = width - 1 - coluna`) e o mesmo
  `leftOffset`, como no original.
- Animação: relógio de jogo em tics, que não avança com o menu aberto; quadro =
  `sequência[floor((tics + deslocamento) / ticsPorQuadro) % tamanho]`, com deslocamento por objeto
  (hash do índice).

## Iluminação

- `lightnum` = luz do setor do objeto / 16, sem o contraste das paredes.
- Nível pela mesma função das paredes (`lightLevel` de `walls.wgsl`, reaproveitada concatenando
  `walls.wgsl` antes de `sprites.wgsl`): `j = min(47, floor(2560 / z))`,
  `nível = clamp((15 - lightnum) * 4 - floor(j / 2), 0, 31)`. O z é a profundidade de vista, passada do
  vertex shader como o `w` do clip space, do mesmo jeito que nas paredes.
- Fullbright (tochas, lâmpadas, esferas): nível 0. Iluminação desligada: nível 0 para todos.

## Simplificações em relação ao Doom

- Objetos parados: sem IA, sem movimento, sem colisão, sem pegar itens; a animação é só a sequência
  parada de cada tipo (inimigos em AB, corpos num quadro fixo).
- Fuzz (espectro, tipo 58): aproximação em xadrez (descarte dos pixels com `x + y` ímpar na tela), em
  vez do efeito original de deslocar e escurecer o fundo.
- Sem ordenação e sem transparência: pixels opacos com teste e escrita de profundidade; os
  transparentes são descartados.

## Ordem das passadas

1. Compute das partículas.
2. Cena (paredes, chãos e tetos), com o depth guardado.
3. **Sprites** (cor e depth da cena, `load`/`store`).
4. Partículas.
5. Menu (se visível).
6. Blit/CRT para o canvas.

Na tela de título não há passada de sprites. Com o menu aberto e o jogo iniciado, os sprites são
desenhados sobre a cena congelada, sem animar.

Controle: configuração `sprites` (tecla O e item SPRITES do menu de opções), persistida.
