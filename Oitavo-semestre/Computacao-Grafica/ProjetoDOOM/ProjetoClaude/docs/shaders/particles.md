# Partículas de poeira e brasas (compute shader)

Adaptação do exemplo "Particles" do WebGPU Samples. Originais sem modificações em
`src/shaders/external/particles/`; adaptação em `src/shaders/particles.wgsl`, `src/gpu/ParticlePass.js`
e `src/particles/particleConfig.js`.

## Análise

Conteúdo confirmado em `particle.wgsl` e `main.ts.txt`:

- **Struct da partícula** (`Particle`): `position : vec3f`, `lifetime : f32`, `color : vec4f`,
  `velocity : vec3f`. O `main.ts` declara o tamanho como 48 bytes (posição 12 + vida 4 + cor 16 +
  velocidade 12 + 4 de preenchimento), com a posição no offset 0 e a cor no offset 16.
- **Gerador aleatório**: estado privado `var<private> rnd : vec4u`. `init_rand(invocation_id, seed)`
  multiplica um `vec4` de constantes pelo id da invocação e faz XOR com a semente. `rand()` multiplica
  o estado por outro `vec4` de constantes, faz XOR com o estado rotacionado (`rnd.yzwx >> 4`) e devolve
  `f32(rnd.x ^ rnd.y) / f32(0xffffffff)`, um número entre 0 e 1. Usa só aritmética inteira (não usa
  `fract` nem `cos`).
- **Simulação** (`simulate`, `@compute @workgroup_size(64)`): um invocation por partícula, sem teste de
  limite do índice. Aplica gravidade no eixo z (`velocity.z -= deltaTime * 0.5`), integra a posição,
  envelhece (`lifetime -= deltaTime`) e define o alfa com `smoothstep(0.0, 0.5, lifetime)`. Com
  `lifetime < 0`, a partícula renasce: desce pelos níveis de mip de uma textura de probabilidade
  sorteando um quadrante por nível, usa a coordenada final como posição no plano (z = 0) e a cor do
  texel (multiplicada por `brightnessFactor`), velocidade aleatória (x e y em ±0.05, z até 0.3) e vida
  entre 0.5 e 3.5.
- **Vertex shader** (`vs_main`): recebe posição e cor por instância e `quad_pos` (−1..+1) por vértice;
  posiciona o quad com `mat2x3f(right, up) * quad_pos` multiplicado por 0.01 e aplica a matriz
  `modelViewProjectionMatrix`.
- **Fragment shader** (`fs_main`): recorte circular por alfa,
  `color.a *= max(1.0 - length(quad_pos), 0.0)`.
- **Uniforms**: `RenderParams` (matriz 4x4, `right : vec3f`, `up : vec3f`; o `main.ts` reserva 4 bytes
  de preenchimento depois de cada vec3) e `SimulationParams` (`deltaTime`, `brightnessFactor`,
  `seed : vec4u`; 32 bytes com o preenchimento).
- **main.ts**: cria o buffer de partículas com usage `VERTEX | STORAGE`; a pipeline de desenho usa dois
  vertex buffers (partículas com `stepMode: 'instance'`, atributos posição e cor; quad de 6 vértices
  `vec2f`), blending aditivo (`src-alpha`, `one`), `depthWriteEnabled: false` e `depthCompare: 'less'`.
  A pipeline de compute usa `entryPoint: 'simulate'` com bind group de uniform, buffer de partículas e
  textura. A cada frame: semente nova com `Math.random()`, uma passada de compute com
  `dispatchWorkgroups(Math.ceil(numParticles / 64))` (50 000 partículas) e uma passada de desenho com
  `draw(6, numParticles)`. Os vetores `right` e `up` vêm da view matrix (`view[0], view[4], view[8]` e
  `view[1], view[5], view[9]`). O restante (geração do mapa de probabilidade com `probabilityMap.wgsl`,
  configurações de HDR e interface `dat.gui`) não é usado aqui.

## Adaptações

| Elemento do original | O que mudou | Motivo |
|---|---|---|
| Textura e mapa de probabilidade (`probabilityMap.wgsl`, pipelines `import_level`/`export_level`, binding 2 da simulação) | Removidos. O nascimento é em posição aleatória dentro da caixa ao redor da câmera | O efeito não depende de imagem |
| `Particle { position, lifetime, color, velocity }` | `Particle { position : vec3f @0, life : f32 @12, velocity : vec3f @16, kind : f32 @28, params : vec4f @32 }`, 48 bytes; `params` = (vida total, fase, tamanho de mundo, geração) | Tipo (poeira/brasa), vida total, fase e tamanho por partícula; a cor sai da paleta no desenho |
| — | `params.w` guarda a "geração": 0 no buffer zerado; o uniform traz a geração atual, e toda partícula de geração diferente renasce com vida escalonada (aleatória entre 0 e a vida total). O botão "Reiniciar partículas" incrementa a geração | Nascimento inicial e reinício feitos na GPU, sem duplicar na CPU as regras de nascimento |
| Gravidade em z (`velocity.z -= deltaTime * 0.5`) | Removida; Y é o eixo vertical | Convenção do renderizador; as brasas sobem por velocidade própria |
| Renascimento com vida 0.5 a 3.5 e velocidades fixas | Vidas, velocidades, subida, deriva, tamanhos e fração de brasas vêm do uniform da simulação (parâmetros ajustáveis). Direção horizontal com ângulo e módulo aleatórios; vertical da poeira até `speed * 0.5` | Efeito de poeira e brasas calibrável sem recompilar |
| Integração `position += deltaTime * velocity` | Mais um balanço horizontal `sin`/`cos` com a fase da partícula; amplitude `speed * 0.25` (poeira) ou `drift * 0.5` (brasa); período 5 s (poeira) ou 2 s (brasa) | Movimento lento e irregular |
| Sem limite de região | Envolvimento relativo à câmera por componente: `((d + h) - 2h * floor((d + h) / 2h)) - h` | Partículas sempre ao redor do jogador; não usa `%`, que trunca para zero e erra com negativos |
| Sem teste de limite em `simulate` | `if (idx >= count) { return; }` | Só as partículas ativas (`count`) são simuladas; a última workgroup passa do total |
| `SimulationParams { deltaTime, brightnessFactor, seed }` | `{ deltaTime, time, count, emberRatio, generation, 3 x pad, seed, cameraPos, boxHalf, dust, emberLife, emberMove }`, 128 bytes | Parâmetros de nascimento e movimento, câmera, caixa e geração; `brightnessFactor` era só para HDR |
| `init_rand` e `rand` | Mantidos sem alteração, com semente nova por frame enviada no uniform (como no `main.ts`) | A qualidade estatística é suficiente: só sorteia posição, tipo, vida, velocidade e fase de partículas decorativas |
| `RenderParams { mvp, right : vec3f, up : vec3f }` | `{ viewProj, sizeParams, view, flags : vec4u, palette : vec4u, ember }`, 144 bytes; sem `right` e `up` | O quad é montado em pixels da tela (já alinhado a ela); vec4 evita o alinhamento de vec3 |
| Billboard `mat2x3f(right, up) * quad_pos * 0.01` (tamanho fixo de mundo) | Modelo de tamanho em pixels da imagem interna: `upp = w * 2 * tanHalfFov / alturaInterna`; `basePx = size * sizeScale / upp`; `sizePx = clamp(round(basePx), minPixels, maxPixels)`; `sizePx = round(sizePx * fade)` (some abaixo de 1). Centro em pixels internos; com `pixelSnap`, alinhado à grade (tamanho ímpar no meio do pixel, par na borda); cantos `centro ± sizePx / 2` convertidos para NDC e multiplicados pelo `w` do centro; z e w do centro em todos os vértices. Partícula atrás do plano near ou a mais de `sizePx` fora da tela não é desenhada | Quadrados nítidos de 1 a poucos pixels, que crescem ao se aproximar e diminuem ao se afastar, sem tremer com `pixelSnap` |
| Alfa por `smoothstep` + recorte circular + blending aditivo | Quad opaco (alfa 1), sem blending; nascer e morrer por encolhimento: `fade = clamp(min(idade, vidaRestante) / (fadeFraction * vidaTotal), 0, 1)` (1 com `fadeFraction = 0` ou "Desligar fade") | Visual do Doom: borda dura, sem transparência |
| Cor da textura (`color`) | Índices da paleta 0 mais próximos das cores hexadecimais dos parâmetros, lidos da paleta iluminada 256x32 (`litPalette`) com `textureLoad` | Cores fiéis à paleta e iluminação pelo COLORMAP |
| — | Poeira: nível pela fórmula de chãos e tetos com `dust.lightnum` e z = w; brasa: nível 0, alternando quente/fria em `flickerHz` por hash da fase e do tempo; iluminação desligada: nível 0 | Integração com a iluminação da etapa 6 |
| Atributos por instância: posição e cor | Posição (`@0`), vida (`@12`), tipo (`@28`) e `params` (`@32`) | Dados usados no vertex shader |
| `depthWriteEnabled: false` | `depthWriteEnabled: true`, `depthCompare: 'less'`, lendo o depth da cena (`depthLoadOp: 'load'`) | Quads opacos escondidos atrás de paredes e do chão |
| Formato de saída `rgba16float` (HDR) | `rgba8unorm`, a textura interna da cena | Mesma textura do renderizador; o CRT age depois |
| Pipelines com `createComputePipeline` / `createRenderPipeline` | `createComputePipelineAsync` / `createRenderPipelineAsync` com tratamento de erro | Em caso de falha, o recurso é desligado na sessão e o jogo continua |

## Integração

Ordem no command encoder, a cada frame com partículas ativas (jogo iniciado, configuração `particles`
ligada, `count > 0` e pipelines disponíveis):

1. **Compute** (`simulate`): `dispatchWorkgroups(ceil(count / 64))`. Uniform `SimulationParams`
   (binding 0) e buffer de partículas como storage (binding 1). Com o menu aberto ou "Congelar
   partículas", `deltaTime = 0`.
2. **Cena** (existente), com `depthStoreOp: 'store'`.
3. **Partículas**: na textura interna da cena (`loadOp: 'load'`) e no depth da cena
   (`depthLoadOp: 'load'`, `depthStoreOp: 'store'`). Uniform `RenderParams` (binding 0) e paleta
   iluminada (binding 1). Vertex buffers: partículas (`stepMode: 'instance'`) e quad.
   `draw(6, count)`.
4. **Menu** (se visível) e **blit/CRT** (existentes). O CRT age sobre as partículas.

Na tela de título (jogo não iniciado) nenhuma passada de partículas acontece. O buffer comporta
`MAX_PARTICLES = 8192`; as partículas acima de `count` não são simuladas nem desenhadas e mantêm o
estado no buffer.

Configuração `particles` (liga/desliga; tecla P e item PARTICLES do menu), persistida em
`doomgpu.settings.v1`. Os demais valores são os parâmetros abaixo.

## Parâmetros

Definidos em `src/particles/particleConfig.js` (`DEFAULT_PARTICLE_PARAMS` e `PARAM_FIELDS`), com os
mesmos padrões em `config/particles.json`. Valores fora da faixa são limitados, com aviso no console;
campos ausentes recebem o valor da camada anterior; campos desconhecidos são ignorados; `version`
diferente de 1 faz o objeto inteiro ser ignorado.

| Campo | Padrão | Faixa | Quando vale |
|---|---|---|---|
| `version` | 1 | deve ser 1 | — |
| `count` | 1200 | inteiro 0 a 8192 | na hora |
| `emberRatio` | 0.25 | 0 a 1 | próximos nascimentos |
| `boxHalfXZ` | 512 | 128 a 1500 | na hora |
| `boxHalfY` | 128 | 32 a 400 | na hora |
| `dust.size` | 0.35 | 0.05 a 4 | próximos nascimentos |
| `dust.lifeMin` / `dust.lifeMax` | 6 / 12 | 0.2 a 60; `lifeMax` ≥ `lifeMin` | próximos nascimentos |
| `dust.speed` | 6 | 0 a 40 | próximos nascimentos (o balanço usa o valor atual) |
| `dust.color` | `#C0B8A8` | `#RRGGBB` | na hora |
| `dust.lightnum` | 7 | inteiro 0 a 15 | na hora |
| `ember.size` | 0.6 | 0.05 a 4 | próximos nascimentos |
| `ember.lifeMin` / `ember.lifeMax` | 1.5 / 3.5 | 0.2 a 60; `lifeMax` ≥ `lifeMin` | próximos nascimentos |
| `ember.riseMin` / `ember.riseMax` | 24 / 48 | 0 a 120; `riseMax` ≥ `riseMin` | próximos nascimentos |
| `ember.drift` | 8 | 0 a 40 | próximos nascimentos (o balanço usa o valor atual) |
| `ember.colorHot` / `ember.colorCool` | `#FFA030` / `#C84010` | `#RRGGBB` | na hora |
| `ember.flickerHz` | 8 | 0.5 a 30 | na hora |
| `render.sizeScale` | 1.0 | 0.25 a 4 | na hora |
| `render.minPixels` | 1 | inteiro 1 a 4 | na hora |
| `render.maxPixels` | 6 | inteiro 1 a 16; ≥ `minPixels` | na hora |
| `render.pixelSnap` | true | booleano | na hora |
| `render.fadeFraction` | 0.15 | 0 a 0.5 | na hora |

As cores são convertidas, na CPU, no índice mais próximo da paleta 0 do PLAYPAL (distância euclidiana ao
quadrado em RGB) sempre que mudam.

Constantes fixas no código: `MAX_PARTICLES = 8192`, `WORKGROUP_SIZE = 64`, `tanHalfFov = 0.75` (lido de
`FOVY` em `src/camera.js`) e, em `particles.wgsl`, os fatores e períodos do balanço e o fator vertical
da poeira.

## Calibragem

- Tecla **T** (com o jogo iniciado) ou item **PARTICLE TUNING** do menu de opções abrem o painel à
  direita. O mouse é liberado; WASD, Espaço, C e R continuam funcionando e as **setas** giram a câmera
  (90 graus por segundo). O menu do motor não aparece enquanto o painel está aberto. **T**, **Esc** ou
  o botão "Fechar" fecham o painel e pedem o mouse de volta; se o pedido falhar, aparece o menu.
- Seções: Quantidade, Poeira, Brasas, Renderização, Cores, Diagnóstico e Arquivo. Cada controle aplica
  a mudança na hora. Ao soltar um slider, o foco volta ao jogo.
- **Diagnóstico** (só na sessão, fora do JSON): "Congelar partículas" (simulação com dt = 0) e
  "Desligar fade" (tamanho sem encolhimento). A tabela mostra o tamanho em pixels de uma poeira e de uma
  brasa nas profundidades 16, 32, 64, 128, 256 e 512, calculado por `pixelSizeAt` com os valores atuais
  e a altura interna atual.
- **Reiniciar partículas**: todas renascem com vidas escalonadas.

## Persistência

Ordem de prioridade (a última vence): padrões do código < `config/particles.json` < localStorage
(chave `doomgpu.particles.v1`, com o objeto inteiro). O arquivo é lido com `fetch` e
`cache: "no-store"` ao iniciar; se faltar ou for inválido, valem os padrões do código. Cada alteração
é gravada no localStorage com debounce de 300 ms.

Botões da seção Arquivo:

- **Salvar no arquivo...**: grava o JSON com `showSaveFilePicker` (nome sugerido `particles.json`); o
  arquivo escolhido é reaproveitado nas gravações seguintes da sessão. Sem a API ou com o diálogo
  cancelado, baixa `particles.json`. Colocado em `config/particles.json`, vira o padrão do projeto.
- **Copiar JSON**: copia o objeto para a área de transferência.
- **Importar JSON...**: lê um arquivo e aplica com validação.
- **Restaurar do arquivo**: apaga o localStorage e relê `config/particles.json`.
- **Restaurar padrões do código**: volta aos padrões de `particleConfig.js`.

## Fonte

- Fonte: https://github.com/webgpu/webgpu-samples/tree/main/sample/particles
- Projeto: WebGPU Samples (webgpu/webgpu-samples)
- Autores: WebGPU Samples Contributors (conforme o LICENSE do repositório)
- Licença: BSD-3-Clause
- Acessado em: 03/10/2026
- Arquivos: particle.wgsl, probabilityMap.wgsl, main.ts.txt (referência), LICENSE-webgpu-samples.txt
