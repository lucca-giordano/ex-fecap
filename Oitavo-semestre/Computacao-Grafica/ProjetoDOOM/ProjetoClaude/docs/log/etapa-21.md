# Etapa 21: projéteis, lança-foguetes e barão

## Pedido

Bola de fogo do diabrete, bola do barão e foguete do jogador; lança-foguetes utilizável no slot 5; barão
com IA; sprites dos projéteis; a página `debug/projectiles.html`; e a verificação
`tools/check-projectiles.mjs`.

## Decisões

- `MissileSystem` é puro. Os alvos de cada projétil vêm de `missileTargets`, a mesma regra no jogo e nos
  testes. O dano direto e o dano em raio são callbacks que o `main` liga a `applyDamage`, `damage()` e
  `radiusAttack`.
- O diabrete e o barão têm o ataque à distância no MESMO estado do corpo a corpo. A ação do quadro G
  decide entre o golpe e o projétil. O diabrete não subtrai 128 no `checkMissileRange`, porque tem
  ataque corpo a corpo: a fração medida a 264 unidades é 0.221.
- O lança-foguetes usa uma ação `gunFlash` (só o clarão, sem munição nem disparo) e uma `fireRocket`. O
  som "rlaunc" é do projétil, e o disparo não toca "pistol".
- Sprites dos projéteis entram como quadros extras de categoria `effect` (nunca descartados). As
  instâncias já aceitavam qualquer base e ângulo, então o construtor de instâncias não mudou.
  - Capacidade: objetos + 256 efeitos + 128 largados + 128 projéteis.
  - Com o barão e os projéteis, são 373 camadas de 124x128, cerca de 11.3 MiB, sem descarte.
- Tabelas conferidas contra o freedoom1.wad: todas as letras e sons existem, e nenhuma correção de valor
  foi necessária. O BAL7 tem 8 vistas no Freedoom, e não vista única.
- O E1M1 não tem barão (tem 18 diabretes). A IA do barão é verificada em cenários sintéticos.

## Arquivos

Criados: `src/game/Missiles.js`, `debug/projectiles.html`, `debug/projectiles.js`,
`tools/check-projectiles.mjs`, `docs/projeteis.md`, este arquivo.

Alterados:

- `src/game/aiTable.js`, `src/game/MonsterAI.js`, `src/game/weapons.js` e `src/main.js`;
- `src/input/Controls.js` e `src/menu/menuText.js` (textos das armas 1 a 5);
- testes:
  - `tools/check-ai.mjs`: a dor leva à corrida, conferida com o demônio, porque o diabrete com justHit
    agora dispara; fora do alcance da garra, a bola de fogo;
  - `tools/check-weapons.mjs`: o slot 5 é utilizável, os lumps MISG e MISF entram na lista, e o ciclo e
    a ordem de troca foram atualizados.

## Verificações (sem navegador)

- `node --check` em todos os `.js` e `.mjs` (cópias `.mjs` temporárias) e ESLint.
- `tools/check-projectiles.mjs`, testes a a l:
  - tabelas e dano direto;
  - voo: o tempo até o jogador a 400 unidades e o foguete em dois meio-passos por tic;
  - paredes, janelas, porta, flag 0x0001 e céu;
  - 2000 disparos em sala fechada, sem atravessar;
  - alvos;
  - explosão e dano em raio;
  - limites;
  - IA: o diabrete dispara nas 20 sementes e o barão funciona de perto e de longe;
  - arma: ciclo de 20 tics, foguete no tic 8 e clarão de 15 tics;
  - integração com o dano e o rosto;
  - determinismo;
  - lumps e camadas.
- Os demais scripts de verificação, incluindo o hash da geometria estática (`check-specials`).

Os resultados de cada comando estão no resumo da etapa.
