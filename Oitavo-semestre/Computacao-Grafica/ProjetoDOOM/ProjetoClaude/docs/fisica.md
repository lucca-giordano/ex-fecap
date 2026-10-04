# Física do modo "andar"

Código: `src/physics/collisionData.js` (linhas do mapa, preparadas uma vez) e `src/physics/collision.js`
(constantes, bloqueio, empurrão e `stepPlayer`). Tudo em coordenadas do Doom (x leste, y norte,
z para cima); a câmera recebe o olho convertido por `doomToWorld` e a física nunca vê o sistema do
renderizador. No modo "voar" nada disso roda.

## Constantes (valores do Doom)

| Constante | Valor | Origem |
|---|---|---|
| `PLAYER_RADIUS` | 16 | raio do jogador no `mobjinfo` do Doom |
| `PLAYER_HEIGHT` | 56 | altura do jogador no `mobjinfo` |
| `EYE_HEIGHT` | 41 | `VIEWHEIGHT` do Doom |
| `STEP_HEIGHT` | 24 | maior degrau que o Doom deixa subir andando |
| `GRAVITY` | 1225 u/s² | 1 unidade por tic² no Doom, com 35 tics/s (35² = 1225) |
| `MAX_SUBSTEP` | 8 unidades | deslocamento máximo por subpasso (menor que o raio) |
| `MAX_PHYSICS_DT` | 0.1 s | maior intervalo aceito por quadro |

## Regra de bloqueio

Para uma linha e os pés do jogador em `feetZ`:

1. Linha de um lado só: bloqueia.
2. Flag `0x0001` (impassable): bloqueia.
3. Linha de dois lados: `openTop = min(tetos)`, `openBottom = max(chãos)`. Bloqueia se
   `openTop - openBottom < 56` (inclui portas fechadas, com teto na altura do chão), se
   `openTop - feetZ < 56` ou se `openBottom - feetZ > 24`. Descer qualquer altura é permitido: o
   jogador cai.

## Empurrão por círculo

O jogador é um círculo de raio 16. Depois de cada deslocamento, para cada linha que bloqueia e cuja
caixa (aumentada pelo raio) contém o centro, calcula-se o ponto do segmento mais próximo do centro; se
a distância for menor que o raio, o centro é afastado ao longo de (centro − ponto) até o raio (+0.01).
Até 4 rodadas por subpasso resolvem cantos com várias linhas. Se o centro cair exatamente sobre o
segmento, o afastamento é pela normal, do lado em que o jogador estava antes.

Por que desliza: o empurrão só corrige a componente do movimento que aponta para dentro da parede
(ao longo da direção perpendicular à parede, ou da direção até a ponta do segmento). A componente
paralela à parede não é alterada, então correr contra uma parede em qualquer ângulo vira um movimento
ao longo dela, sem parar e sem tremer.

## Subpassos

O deslocamento de cada quadro é dividido em subpassos de no máximo 8 unidades (e no máximo 1/70 s,
para a gravidade ter precisão em quadros longos). Como 8 é menor que o raio, o centro nunca atravessa
uma parede entre dois testes. Em cada subpasso: deslocar, empurrar, descobrir o setor sob o centro
(chão e teto) e aplicar o movimento vertical:

- acima do chão: `vz -= GRAVITY * dt`, `z += vz * dt`;
- no chão ou abaixo (inclusive ao subir um degrau de até 24): `z = chão` e `vz = 0` na hora.

Rede de segurança: a última posição válida (finita e com teto − chão ≥ 56 sob o centro) é guardada; se
o estado ficar inválido, o jogador volta a ela (ou ao início do jogador 1), com aviso no console.

Troca de modo: de voar para andar, os pés ficam em `max(olho − 41, chão)` e o jogador cai se estiver
alto; se a posição estiver fora do mapa (voando além das paredes externas), espremida ou sobreposta a
uma parede depois do empurrão, ele vai para o ponto de início. "Fora do mapa" é testado no subsector
do ponto: a BSP sempre devolve um subsector, mas dentro da área jogável o ponto fica do lado interno de
todos os segs dele (tolerância de 1 unidade, pelos vértices de divisão arredondados no WAD). De andar para voar, o olho continua onde está. A física só roda com o jogo iniciado e
o menu fechado.

## Simplificações em relação ao Doom

- Sem momento nem atrito: a velocidade horizontal é a desejada no quadro (WASD), sem aceleração.
- Sem portas, elevadores ou outros setores móveis: portas fechadas são só paredes.
- Sem colisão com objetos (sprites), sem dano de queda, sem pulo e sem agachar.
- Sem o balanço da visão ao andar e sem a suavização da câmera ao subir degraus.
