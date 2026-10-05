# Automapa, códigos de trapaça, noclip e créditos

Código puro:

- `src/automap/AutomapState.js`: estado, zoom, pan e projeção;
- `src/automap/seen.js`: linhas vistas;
- `src/automap/AutomapRenderer.js`: cores, recorte, Bresenham e desenho;
- `src/game/Cheats.js`: códigos de trapaça;
- `src/menu/helpPages.js`: páginas da ajuda e dos créditos.

O noclip é uma opção do `stepPlayer`, em `src/physics/collision.js`. Integração em `src/main.js` e
`src/hud/HudRenderer.js`; verificação `tools/check-automap.mjs`. Nenhuma pipeline nem shader mudou: o
automapa é composto na CPU, na camada de HUD de 320x200.

## Automapa

- **Tecla:** Tab (ação `toggleAutomap`), só com o jogo iniciado e o menu fechado.
- **Teclas próprias:** com o automapa aberto, F (seguir), G (grade), + e − (zoom contínuo), 0 (mapa
  inteiro ou visão anterior) e as setas (mover, sem seguir e com o painel de calibragem fechado) têm
  função própria. As ações globais dessas teclas (tela cheia, andar ou voar, velocidade, HUD de texto)
  são ignoradas enquanto ele está aberto. WASD e o mouse continuam jogando.
- **Cores**, na ordem do am_map.c (o índice vem do `nearestPaletteIndex` da paleta 0):
  1. a linha é desenhada se estiver mapeada ou com IDDT; a flag 0x0080 só aparece com IDDT;
  2. um lado só: parede vermelha;
  3. especial 39: vermelho médio;
  4. flag 0x0020: parede;
  5. chão diferente: marrom;
  6. teto diferente: amarelo;
  7. senão, cinza só com IDDT;
  8. não mapeada com allmap: cinza do allmap.

  As alturas são as correntes, então uma porta que abre muda de cor.
- **Projeção e região:**
  - tela = (160 + (x − centro) · escala, 84 − (y − centro) · escala), com o norte para cima;
  - a região ocupa as linhas 0 a 167, com fundo preto opaco; a barra fica por cima e a arma não é
    desenhada;
  - recorte de Cohen-Sutherland e Bresenham de 1 pixel.
- **Zoom e movimento:**
  - zoom de 1.02 por tic, limitado entre a escala que mostra o mapa inteiro e 168 / 32;
  - com "seguir", o centro acompanha o jogador; sem ele, as setas movem 4 pixels de tela por tic, dentro
    da caixa do mapa.
- **Linhas vistas:**
  - a cada 2 tics com o jogador vivo, também com o automapa fechado;
  - 192 raios 2D no campo de visão horizontal (2 · atan(0.75 · aspecto): 90 graus no modo retro);
  - cada raio marca as linhas que cruza e só continua por linhas de dois lados com o olho (pés + 41)
    dentro da abertura;
  - as linhas do setor do jogador também são marcadas;
  - no E1M1, a partir do início, leva 1.87 ms por chamada no teste em Node.
- **Seta e coisas:** a seta do jogador e os triângulos das coisas (só com IDDT nível 2) seguem as
  figuras do Doom. A grade de 128 unidades fica alinhada aos múltiplos de 128, e não ao BLOCKMAP, por
  simplificação.
- **Limitações:**
  - no modo moderno, as faixas laterais fora dos 320 pixels continuam mostrando a cena;
  - não há marcadores nem rotação;
  - o allmap está pronto no desenho, mas o poder que o liga ainda não existe.

## Códigos de trapaça

O reconhecedor guarda as últimas 12 letras (`event.code` de KeyA a KeyZ) e casa o final com IDDQD,
IDKFA, IDFA, IDCLIP, IDSPISPOPD, IDDT e IDMYPOS. Ele ignora `e.repeat` e é limpo ao perder o foco, ao
abrir o menu e ao perder o pointer lock.

Conflito com os atalhos (F, L, P, T, M, O, V, X…): o reconhecedor roda antes do despacho de ações do
`Controls`. Uma tecla é consumida, e não dispara ações de alternância nem de pressão, se o buffer antes
dela já terminava num prefixo de código com 2 letras ou mais ("ID"…), se o buffer depois dela termina
num prefixo assim, ou se ela completou um código. As teclas de segurar (andar, subir, descer, atirar,
setas) nunca são bloqueadas, e "I" sozinha não é consumida.

Efeitos:

- **IDDQD:** alterna o GOD MODE e sobe a vida a 100.
- **IDKFA e IDFA:** armas 1 a 7, mochila, munição máxima e armadura 200 azul; o IDKFA dá também as
  chaves.
- **IDCLIP e IDSPISPOPD:** alternam o noclip.
- **IDDT:** cicla o automapa entre 0, 1 e 2.
- **IDMYPOS:** mostra "ANG=… X=… Y=…".

As mensagens usam o sistema de mensagens da etapa 16, em inglês (textos do Doom, de memória) e português.

## Noclip

Com o noclip ligado, `stepPlayer` não empurra contra linhas e sólidos, coloca os pés no chão do setor
sob o centro (sem limite de degrau) e não devolve o jogador à última posição válida. Desligado, o código
é o mesmo de antes, e o `check-collision` passa sem alteração. O noclip só existe na sessão e volta a
desligado no NEW GAME e no reinício.

## Créditos

O item CREDITS (CREDITOS em português) é o 4º do menu principal e é desenhado com a fonte STCFN. A tela
tem duas páginas, como a READ THIS!. O conteúdo foi copiado de `CREDITS.md` e de
`src/shaders/external/particles/SOURCE.txt`. O site e a licença do Freedoom aparecem como "VER
CREDITS.MD", porque esses campos ainda estão por preencher em `CREDITS.md`. A fonte só tem maiúsculas,
então as URLs aparecem em maiúsculas.
