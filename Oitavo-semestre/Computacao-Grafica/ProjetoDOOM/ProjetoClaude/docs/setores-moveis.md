# Setores móveis: portas, elevadores, uso, interruptores e saída

Código puro:

- `src/game/LevelState.js`: estado da fase;
- `src/game/specials.js`: tabela de especiais;
- `src/game/Doors.js` e `src/game/Platforms.js`: portas e elevadores;
- `src/game/UseLines.js`: uso, cruzamento, interruptores, monstros e o tic dos thinkers;
- `src/map/dynamicGeometry.js`: geometria dos setores móveis.

Integração em `src/main.js`; página de depuração `debug/specials.html`; verificação
`tools/check-specials.mjs`; linha de base da geometria em `tools/baseline-geometry.mjs`. Os valores vêm
do p_doors.c, p_plats.c, p_switch.c e p_spec.c do Doom, lembrados de memória.

## Desenho

- As alturas dos setores e as texturas das sidedefs mudam no próprio mapa
  (`map.sectors[i].floorHeight` e `ceilingHeight`). Física, visão, hitscan, dano em raio e colisão dos
  monstros já liam esses campos, então enxergam as portas sem cópia. `LevelState` guarda os originais
  para o reset, a cópia dos especiais (`lineSpecial`), o mapa de tags, as linhas de cada setor e o
  centro de cada setor para os sons.
- A geometria estática não muda durante o jogo. As linhas que tocam um setor móvel, as linhas de
  interruptor e os planos dos setores móveis saem dela (parâmetro `exclude` de `buildWalls` e
  `buildFlats`) e vão para buffers próprios, desenhados com a mesma pipeline.
- Com exclusão vazia, a saída estática é byte a byte igual à de antes da refatoração: o hash SHA-256
  confere com `tools/baselines/geometry-e1m1.json`, gravado antes de qualquer mudança.
- Cada linha dinâmica tem 5 quads em posições fixas (direita baixa, alta e central; esquerda baixa e
  alta). Um quad que não se aplica fica zerado e vira um triângulo degenerado.
- Os índices não mudam. Uma mudança de altura recalcula só o setor e as suas linhas, e o buffer de
  vértices inteiro é reenviado no quadro. No E1M1 são 84 896 bytes por conjunto de vértices (dois: cor
  por flat e por setor) e 9 096 bytes de índices.
- Se a criação dos buffers dinâmicos falhar, a geometria estática volta a ser montada sem exclusões e
  os setores móveis ficam desligados na sessão.

## Especiais suportados

| Tipo | Especiais |
|------|-----------|
| Porta manual (uso, setor de trás) | 1 normal; 26, 27 e 28 normal com chave azul, amarela e vermelha; 31 abre e fica; 32, 33 e 34 abre e fica com chave azul, vermelha e amarela; 117 rápida; 118 rápida abre e fica |
| Interruptor S1 | 11 saída, 51 saída secreta, 21 elevador, 29 porta, 50 fechar, 103 abrir |
| Interruptor SR | 42 fechar, 61 abrir, 62 elevador, 63 porta |
| Cruzamento W1 | 2 abrir, 3 fechar, 4 porta, 10 elevador, 52 saída, 124 saída secreta |
| Cruzamento WR | 75 fechar, 86 abrir, 88 elevador, 90 porta |

Cartão e caveira da mesma cor valem igualmente. Os outros especiais não têm efeito: são contados e
listados. No E1M1, o único é o 23 (piso desce, S1), em uma linha.

## Portas

As portas sobem 2 unidades por tic (as rápidas, 8) até o menor teto vizinho menos 4. As do tipo normal
esperam 150 tics e descem até o chão. Os sons são `doropn` e `dorcls` (rápidas: `bdopn` e `bdcls`), no
centro do setor.

Usar de novo uma porta manual repetível em movimento:

- se ela estiver descendo, ela volta a subir;
- se estiver subindo ou esperando, desce na hora (só o jogador faz isso).

Esmagamento: se o próximo passo de descida deixar um alvo vivo sem espaço, o passo é desfeito. As portas
normais reabrem; as do tipo `close` esperam e tentam de novo. Alvos são o jogador (56), monstros e barris
vivos; corpos, itens e largados não contam. No E1M1, a porta normal 55 leva 274 tics no ciclo completo.

## Elevadores

O tipo é "desce, espera, sobe e fica". O elevador desce 4 por tic até o menor chão vizinho, espera 105
tics e sobe até o chão original, com `pstart` e `pstop`. Subindo contra um alvo vivo, ele volta a descer.
Monstros, itens e largados do setor acompanham o chão; o jogador acompanha pela física. No E1M1, o
elevador da tag 1 leva 173 tics no ciclo completo.

## Uso, cruzamento e interruptores

- **Uso (E):** um raio de 64 unidades na direção do olhar percorre as linhas em ordem de distância.
  - A primeira linha com especial encerra o raio: vista por trás, não faz nada; de frente, ativa se for
    de uso.
  - Uma linha sem especial e sem abertura toca `oof`. O Doom 1.9 toca `noway` nesse caso.
- **Cruzamento:** só no modo andar, entre a posição anterior e a atual do jogador, nos dois sentidos e
  na ordem do percurso. As trocas discretas de posição (troca de modo, NEW GAME, reinício) invalidam a
  posição anterior.
- **Interruptores:** a primeira textura SW1 ou SW2 da sidedef da frente (alta, média, baixa) troca pela
  contraparte quando a ação acontece, com `swtchn`; numa saída, o som é `swtchx`.
  - O S1 fica apertado.
  - O SR volta depois de 35 tics, e nesse tempo outros usos da linha são ignorados.
- **Chave negada:** toca `oof` e mostra "You need a ... key to open this door.".

## Saída e estatísticas

As saídas 11, 51, 52 e 124 marcam o fim da fase. Depois de 35 tics, tudo congela e a camada de HUD
mostra INTERPIC com as mortes, os itens e o tempo da fase. Depois de mais 35 tics, E, Enter ou clique
fazem o mesmo reinício do NEW GAME, que restaura alturas, especiais, texturas, thinkers, chaves, itens e
monstros.

## Monstros e som

- **Monstros e portas:** um monstro cujo passo falha numa linha de especial 1 voltada para ele tenta
  abri-la. Se ela abriu ou já está abrindo, o passo conta como feito. Monstros não abrem portas de chave
  nem de uma vez, e nunca fecham portas.
- **Som:** o alerta avalia a abertura de cada linha na hora, com as alturas correntes. Uma porta fechada
  bloqueia e uma aberta deixa passar.

## Simplificações

Não há teleportes, escadas, pisos automáticos, esmagadores, luzes piscantes, dano de piso, segredos nem
projéteis. Monstros não ativam linhas de cruzamento. O tipo de elevador é único. Uma porta rápida não
toca som ao terminar de fechar.
