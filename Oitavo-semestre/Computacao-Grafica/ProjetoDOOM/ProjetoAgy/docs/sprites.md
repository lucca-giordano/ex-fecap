# Sprites dos Objetos do Mapa (THINGS) - Doom WebGPU

Este documento descreve a arquitetura e as regras de renderização dos sprites 2D no mundo 3D do Doom utilizando WebGPU puro.

---

## 1. Localização e Montagem dos Sprites no WAD

- **Marcadores `S_START` e `S_END`**: Delimitam o intervalo de lumps de sprites dentro do arquivo WAD. Caso lumps com o mesmo nome apareçam mais de uma vez, a última ocorrência é adotada.
- **Formato Picture**: Cada lump de sprite possui um cabeçalho de 8 bytes contendo:
  - `width` (uint16) e `height` (uint16): dimensões do sprite.
  - `leftOffset` (int16): pivô horizontal medido a partir da borda esquerda.
  - `topOffset` (int16): pivô vertical medido a partir do topo até o chão.
  Seguem-se a tabela de ponteiros de colunas e os blocos de posts verticais terminados por `0xFF`.
- **Nomenclatura e Espelhamento**:
  - Nomes de 6 caracteres (`TROOA1`): prefixo de 4 caracteres (`TROO`), letra do quadro (`A`) e dígito de rotação (`1`). O dígito `0` representa vista única omnidirecional.
  - Nomes de 8 caracteres (`TROOA2A8`): contêm dois pares. O primeiro par (`A2`) utiliza os dados normais do lump; o segundo par (`A8`) reaproveita o mesmo lump lido de forma invertida horizontalmente (`u = width - 1 - col`).
  - **Offsets em Lumps Espelhados**: O Doom original utiliza o `leftOffset` do lump sem recalcular o espelhamento da âncora; o mesmo comportamento é mantido aqui e pode ser validado visualmente na página `debug/sprites.html`.

---

## 2. Posição, Orientação e Escolha de Vistas

- **Posicionamento no Mundo**: A base do objeto fica apoiada no chão do setor determinado via `findSector(x, y)` nas coordenadas do Doom, convertidas para o espaço de mundo via `doomToWorld(x, y, floorHeight)`.
- **Alinhamento com o Plano da Tela (Billboarding)**:
  - O quad estende-se de `-leftOffset` até `width - leftOffset` ao longo do vetor horizontal direito da câmera e de `topOffset - height` até `topOffset` verticalmente acima do chão.
  - O quad permanece perpendicular ao chão e alinhado ao plano da tela projetando o vetor lateral da câmera no plano horizontal $(\cos(\text{yaw}), 0, \sin(\text{yaw}))$. Isso replica com fidelidade o comportamento do motor original do Doom, evitando inclinações espúrias (pitch roll) quando o jogador olha para cima ou para baixo.
- **Regra de Escolha da Vista (1 a 8)**:
  - Ângulo de visão do jogador até o objeto nas coordenadas do Doom:
    $$a = \text{atan2}(thingY - camY, thingX - camX) \times \frac{180}{\pi} \pmod{360}$$
  - Cálculo do índice de rotação:
    $$rot = \left\lfloor \frac{((a - thingAngle) \pmod{360} + 202.5)}{45} \right\rfloor \pmod 8$$
    $$\text{vista} = rot + 1$$
  - Para quadros com vista única (dígito 0), a vista 0 é usada diretamente sem rotação.

---

## 3. Iluminação por Setor e Efeitos Especiais

- **Atenuação da Luz**:
  - `lightnum = floor(sector.lightLevel / 16)`.
  - Reutiliza a fórmula das paredes com a tabela `COLORMAP`:
    $$j = \min\left(47, \left\lfloor\frac{2560}{z}\right\rfloor\right), \quad \text{nível} = \text{clamp}\left((15 - lightnum) \times 4 - \left\lfloor\frac{j}{2}\right\rfloor, 0, 31\right)$$
- **Fullbright**: Entidades luminosas (tochas, lâmpadas, esferas de poder) utilizam nível 0 fixo na paleta iluminada.
- **Efeito Fuzz (Spectre - tipo 58)**: Implementado como aproximação estética através do descarte xadrez em espaço de tela: fragmentos onde `(floor(fragCoord.x) + floor(fragCoord.y)) % 2 != 0` são descartados, renderizando os demais com o nível de iluminação do setor.

---

## 4. Otimizações e Recursos na GPU

- **Texture Array `rg8uint`**: Uma única camada 2D por lump único de sprite efetivamente utilizado no mapa. Dimensões unificadas baseadas no maior sprite carregado.
- **Storage Buffer de Metadados**: Armazena largura, altura, `leftOffset` e `topOffset` indexados pela camada da textura.
- **Storage Buffer de Instâncias (32 bytes)**:
  - `vec3<f32> position` (12 bytes, offset 0)
  - `u32 layer` (4 bytes, offset 12)
  - `u32 lightnum` (4 bytes, offset 16)
  - `u32 flags` (4 bytes, offset 20: bit 0 = espelhado, bit 1 = fullbright, bit 2 = fuzz)
  - `u32 pad0, pad1` (8 bytes, offsets 24 e 28 para alinhamento WGSL de 16 bytes)
- **Quad Procedural**: 6 vértices por instância calculados no vertex shader, sem vertex buffer de geometria.
- **Depth Testing**: `less` com escrita de profundidade (`depthWriteEnabled: true`), permitindo que paredes e chãos ocluam os sprites e que as partículas sejam desenhadas na frente quando próximas.

---

## 5. Ordem das Passadas no Command Encoder

A renderização segue uma ordem linear e determinística por quadro:
1. **Passada de Computação de Partículas**: Simulação física de poeira e brasas via compute shader.
2. **Passada da Cena 3D**: Desenho das paredes e flats (pisos e tetos) na textura interna de cor e no buffer de profundidade (`loadOp: 'clear'`, `storeOp: 'store'`).
3. **Passada de Sprites 3D**: Renderiza os quads dos objetos ativos na mesma textura interna com o depth buffer guardado (`loadOp: 'load'`, `storeOp: 'store'`).
4. **Passada de Partículas**: Desenha as partículas com teste de profundidade sobre a cena e os sprites.
5. **Passada do Menu**: Desenha o buffer do menu 320x200 sobre a imagem interna antes do pós-processamento.
6. **Passada de Blit**: Mapeia a imagem interna para a tela com filtro CRT opcional.

---

## 6. Simplificações em Relação ao Doom Original

- **Sem IA ou Estados de Combate**: Monstros permanecem em seus estados estáticos de vigilância (quadros A/B em loop), sem movimentação, perseguição ou ataques.
- **Sem Colisão ou Coleta**: O jogador pode atravessar os objetos livremente e itens não são coletados.
- **Fuzz Aproximado**: Padrão de pontilhado xadrez estático em coordenadas de tela em vez da distorção do buffer do framebuffer original.
- **Animações Reduzidas**: Objetos utilizam sequências curtas de poucos quadros por tics (35 tics/s), congeladas quando o menu de pausa está aberto.
