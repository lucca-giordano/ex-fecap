# Projéteis

Código puro: `src/game/Missiles.js` (tipos, `MissileSystem`, `checkMissileMove` e `missileTargets`).
Também mudaram `src/game/MonsterAI.js` (bolas do diabrete e do barão), `src/game/aiTable.js` (barão) e
`src/game/weapons.js` (lança-foguetes). Integração em `src/main.js`; página de depuração
`debug/projectiles.html`; verificação `tools/check-projectiles.mjs`. Os valores vêm do info.c e do
p_mobj.c do Doom, lembrados de memória, e as letras dos quadros foram conferidas contra o freedoom1.wad.

## Tipos

| Tipo | Velocidade | Raio | Altura | Dano direto | Voo | Explosão | Sons |
|------|-----------|------|--------|-------------|-----|----------|------|
| troopShot (diabrete) | 10 | 6 | 8 | (n % 8 + 1) × 3 | BAL1 A4 B4 | C6 D6 E6 | firsht / firxpl |
| bruiserShot (barão) | 15 | 6 | 8 | × 8 | BAL7 A4 B4 | C6 D6 E6 | firsht / firxpl |
| rocket (jogador) | 20 | 11 | 8 | × 20 | MISL A (permanece) | B8 (dano em raio) C6 D4 | rlaunc / barexp |

Todos os quadros ficam em brilho máximo. No Freedoom, o BAL7 tem 8 vistas (pares espelhados), e não
vista única; o MISL A também tem 8. São usadas as vistas que o WAD tem.

## Movimento

- **Criação de monstro:** o projétil sai de (x, y) do monstro, a 32 unidades acima dos pés, mirando o
  alvo. O `vz` é a diferença de altura dos pés dividida pelo número de passos até o alvo.
- **Criação do jogador:** usa o ângulo e o `vz = velocidade · tan(pitch)` da câmera, sem mira
  automática.
- **Primeiro tic:** o primeiro quadro fica `next255 & 3` tics mais curto (mínimo 1). O projétil avança
  meio passo e passa pela checagem de colisão; se bloquear, explode na hora.
- **Cada tic:**
  1. o passo xy (dividido em duas metades se |vx| ou |vy| passar de 15, o que acontece com o foguete);
  2. o z;
  3. a animação.
- **Teto e chão:** se o z sair do setor do centro, o projétil explode (sem o hack do céu, como o
  P_ZMovement). Um projétil que dura 700 tics é removido, e acima de 128 projéteis o mais antigo é
  descartado.

## Colisão

- **Coisas:** caixa |dx|, |dy| < raio do alvo + raio do projétil. O projétil passa por cima se z estiver
  acima do topo do alvo e por baixo se o topo do projétil estiver abaixo dos pés do alvo. Com vários
  alvos, vale o mais próximo.
  - **Projétil de monstro:** atinge o jogador e barris vivos; monstros, corpos e o dono não colidem
    (sem infighting).
  - **Foguete:** atinge monstros e barris vivos, nunca o jogador diretamente.
  - **Decoração sólida:** para qualquer projétil, sem dano. A altura é fixa em 64, por simplificação.
- **Linhas:** uma linha conta se tocar o quadrado do destino ou cruzar o segmento do movimento (assim o
  projétil não atravessa paredes finas).
  - Bloqueia se for de um lado só, ou se [z, z + altura] não couber na abertura corrente; as portas
    fechadas bloqueiam.
  - As flags 0x0001 e 0x0002 não bloqueiam projéteis.
  - Bloqueado pela parte de cima com teto de céu do outro lado, o projétil some sem explodir.
- **Ponto da explosão:** a última posição válida.

## Dano

- **Direto:**
  - Projétil de monstro no jogador: `applyDamage`, com o atacante na posição atual do dono, se ele ainda
    existir.
  - Em barris e, para o foguete, em monstros: `damage()` (o monstro acorda).
  - Para a contagem de acertos do jogador, conta o dano direto do foguete em monstro ou barril.
- **Em raio (só o foguete):** acontece ao entrar no quadro B. Usa o `radiusAttack` da etapa 15 com
  máximo de 128. Atinge monstros, barris (com reação em cadeia) e o próprio jogador, sem atacante. Um
  monstro atingido diretamente leva o dano direto e o dano em raio.

## IA e arma

- **Diabrete:** ataca à distância no mesmo estado do corpo a corpo. No quadro G, usa a garra se estiver
  ao alcance e a bola de fogo se não estiver.
- **Barão (3003):**
  - velocidade 8, corrida A–D a 3 tics, ataque E8 F8 G8;
  - de perto, golpe de (n % 8 + 1) × 10; de longe, bola;
  - sons: ver `brssit`, ativo `dmact`.

  Não há barão no E1M1.
- **Lança-foguetes (slot 5):**
  - MISG A8 (clarão MISF A3 B4 C4 D4), B12 (foguete no tic 8), B0 (refire): 20 tics;
  - gasta 1 foguete por tiro;
  - a ordem de troca sem munição passou a ser metralhadora, espingarda, pistola, lança-foguetes e soco.

## Simplificações

Não há briga entre monstros, recuo por dano nem mira automática. A decoração sólida tem altura fixa (64).
Projéteis de monstro não têm dano em raio. Não há plasma, BFG nem monstros voadores.
