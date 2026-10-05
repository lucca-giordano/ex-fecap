# Etapa 22: automapa, códigos de trapaça, créditos e levantamento dos mapas

## Pedido

Levantamento somente leitura de todos os mapas do WAD, automapa composto na CPU, códigos de trapaça,
noclip, tela de créditos e a verificação `tools/check-automap.mjs`.

## Decisões

- **Parte 0 primeiro.** `tools/survey-maps.mjs` reconhece os mapas pelo mesmo critério do `loadMap`
  (marcador seguido dos 10 lumps) e deriva "suportado" das tabelas reais do projeto.
  - Encontrou 36 mapas (E1M1 a E4M9). O E1M1 é o 1º do ranking, só com o especial 23 não suportado.
  - Os tipos de decoração que o projeto não conhece (34, 63, 22, 42, 41, 62, 59, 53, 61, 51) aparecem
    como "desconhecido".
  - Saídas: `docs/levantamento-mapas.md` e `tools/out/survey.json`.
- **Cores do automapa:** o índice mais próximo da paleta 0 ficou em parede 179 (215, 0, 0), chão 69,
  teto 231, especial 39 184, dois lados 98, allmap 101, coisas 119 (67, 147, 55), grade 109 e jogador 4.
- **Conflito de teclas:**
  - dentro do automapa, F, G, + e −, 0 são tratados no keydown do `main`, e o `onAction` ignora as ações
    globais dessas teclas;
  - os códigos usam um gancho novo, `onKey` do `Controls`, que roda antes do despacho e só bloqueia
    ações que não são de segurar;
  - depois de "ID", qualquer letra é consumida (regra do prefixo antes e depois da tecla), para F, L, P,
    T e M não dispararem.
- **Noclip:** é um caminho separado em `stepPlayer` (`options.noclip`); o caminho normal não mudou.
- **Créditos:** copiados de `CREDITS.md` e do `SOURCE.txt` das partículas. O site e a licença do
  Freedoom estão por preencher em `CREDITS.md` e aparecem como "VER CREDITS.MD". A tela tem duas páginas,
  com o mesmo controle da READ THIS!.

## Arquivos

Criados:

- `src/automap/AutomapState.js`, `src/automap/seen.js`, `src/automap/AutomapRenderer.js` e
  `src/game/Cheats.js`;
- `tools/survey-maps.mjs` e `tools/check-automap.mjs`;
- `docs/automapa-cheats.md` e este arquivo;
- gerados pelo levantamento: `docs/levantamento-mapas.md` e `tools/out/survey.json`.

Alterados:

- `src/input/Controls.js`: ação `toggleAutomap` e gancho `onKey`;
- `src/physics/collision.js`: noclip;
- `src/hud/HudRenderer.js`: automapa antes da barra e arma oculta;
- menu: `src/menu/Menu.js`, `src/menu/MenuRenderer.js`, `src/menu/helpPages.js` e `src/menu/menuText.js`;
- `src/game/itemText.js` (mensagens) e `src/main.js`;
- `tools/check-menu.mjs`: créditos e o 4º item do principal.

## Verificações (sem navegador)

- `node --check` em todos os `.js` e `.mjs` (cópias `.mjs` temporárias) e ESLint.
- `tools/check-automap.mjs`, testes a a i:
  - cores, recorte e Bresenham;
  - projeção, zoom, mapa inteiro e pan;
  - seta;
  - linhas vistas: no E1M1, 129 de 1175 linhas marcadas a partir do início, 1.87 ms por chamada;
  - códigos;
  - noclip: parede de um lado só, sólido e degrau de 128;
  - créditos;
  - levantamento.
- Os demais scripts de verificação das etapas anteriores, incluindo o hash da geometria estática.

Os resultados de cada comando estão no resumo da etapa.
