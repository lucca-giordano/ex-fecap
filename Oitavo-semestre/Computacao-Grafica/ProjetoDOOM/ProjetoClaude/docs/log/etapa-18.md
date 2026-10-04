# Etapa 18: IA dos monstros

## Pedido

Monstros que acordam por visão e som, perseguem e atacam no estilo do Doom, com animações de corrida e
ataque. O dano ao jogador é só contado. Inclui o submenu MONSTER DEBUG, a página `debug/ai.html` e a
verificação `tools/check-ai.mjs`.

## Decisões

- Tabelas de IA separadas (`aiTable.js`), conferidas em `resolveMonsterTable`. Nenhum quadro de
  corrida, ataque, dor ou morte faltou no freedoom1.wad, e nenhum tipo do E1M1 ficou passivo.
- Correções e acréscimos às tabelas:
  - o som de dor passou a tocar ao entrar no 2º quadro de dor (A_Pain do Doom), não mais no dano;
  - os quadros F de tiro do POSS e do SPOS têm brilho máximo, como no Doom;
  - o dano também zera o tempo de reação, como o P_DamageMobj.
- O `MonsterSystem` ganhou os estados chase, melee e missile, ações nos quadros e posição, chão e ângulo
  dinâmicos. Sem IA (tipo sem tabela ou MONSTER AI desligado), ele se comporta como na etapa 17.
- O `shoot()` não mudou: o tiro de monstro passa o jogador como único alvo cilíndrico.
- `MonsterAI` aceita `world.sectorAt` opcional para os mapas sintéticos das verificações; no jogo, usa o
  BSP.
- Sprites:
  - corrida e ataque entram como quadros extras;
  - o descarte segue a ordem xdie, dor e corrida além de A e B, por camadas ou acima de 256 MiB;
  - o E1M1 precisa de 278 camadas de 124x128 (cerca de 8.4 MiB), sem descarte.

  Nenhuma pipeline nem shader mudou, e a falha do `SpriteSet` agora também vai ao quadro vermelho.
- RESET MONSTERS e KILL ALL MONSTERS saíram do GAME DEBUG para o MONSTER DEBUG, com MONSTER AI e NO
  TARGET (configurações só da sessão).

## Arquivos

Criados: `src/game/aiTable.js`, `src/game/sight.js`, `src/game/sound.js`, `src/game/MonsterAI.js`,
`src/game/PlayerDamageSink.js`, `debug/ai.html`, `debug/ai.js`, `tools/check-ai.mjs`, `docs/ia.md`, este
arquivo.

Alterados: `src/game/MonsterSystem.js`, `src/game/monsterTable.js`, `src/sprites/spriteLogic.js`,
`src/core/Settings.js`, `src/menu/Menu.js`, `src/menu/MenuRenderer.js`, `src/menu/menuText.js`,
`src/main.js`, `tools/check-menu.mjs` (MONSTER DEBUG) e `tools/check-combat.mjs` (o som de dor agora
toca 3 tics depois).

## Verificações (sem navegador)

- `node --check` em todos os `.js` e `.mjs` (cópias `.mjs` temporárias) e ESLint.
- `tools/check-ai.mjs`, testes a a n:
  - tabelas e distâncias;
  - alcance de ataque corpo a corpo e à distância (fração de 0.215 a 392 unidades);
  - visão em mapas sintéticos e no E1M1: nenhum monstro vê o início do jogador; 250 de 2756 pares de
    monstros têm visão, todos conferidos por força bruta;
  - alerta sonoro contra uma BFS independente: 38 de 182 setores a partir do início;
  - acordar;
  - P_NewChaseDir;
  - perseguição: 20 de 20 sementes contornam a parede;
  - duração dos ataques (26 e 24 tics) e dor levando à corrida;
  - danos e desvios;
  - tiro de monstro: 0.25% de acerto fora da mira;
  - colisão em caixa e 2000 tics de perseguição no E1M1: sem cruzar paredes, sem NaN e com o z no chão;
    nenhum dos 29 monstros chega a 128 do início, que fica atrás de portas;
  - determinismo;
  - lumps.
- Os demais scripts de verificação das etapas anteriores.

Os resultados de cada comando estão no resumo da etapa.
