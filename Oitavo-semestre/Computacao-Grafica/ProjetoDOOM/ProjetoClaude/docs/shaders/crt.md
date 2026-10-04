# Efeito CRT (pós-processamento)

Porte para WGSL do shader "PUBLIC DOMAIN CRT STYLED SCAN-LINE SHADER", de Timothy Lottes.
Original sem modificações em `src/shaders/external/crt.glsl`; porte em `src/shaders/crt.wgsl`.

## Análise

O shader simula um monitor de tubo (CRT) de fliperama com entrada RGB: a imagem é reamostrada numa
grade de "pixels emulados", cada linha emulada vira uma linha de varredura com perfil gaussiano, a tela
é levemente curvada e uma máscara de fósforo colorida é aplicada por cima. Todo o cálculo de luz é
feito em espaço linear.

Etapas, na ordem do código:

1. **Warp** (`Warp(pos)`): curva a tela. Leva `pos` (0 a 1) para -1 a 1, multiplica x por
   `1 + y² * warp.x` e y por `1 + x² * warp.y` e volta para 0 a 1. Perto das bordas a coordenada sai
   de 0..1, e o `Fetch` devolve preto: daí as bordas arredondadas.
2. **Fetch** (`Fetch(pos, off)`): lê a cena no pixel emulado mais próximo. Converte `pos` para a grade
   emulada (`pos * res`), soma o deslocamento `off` em pixels emulados (vizinho à esquerda/direita,
   linha de cima/baixo), arredonda para baixo e lê esse texel. Fora da tela devolve preto. A cor lida
   é convertida para linear (`ToLinear`).
3. **Dist** (`Dist(pos)`): distância, em pixels emulados, entre o ponto e o centro do pixel emulado
   mais próximo (de -0.5 a 0.5 em cada eixo). É a base dos pesos dos filtros.
4. **Gaus**: gaussiana 1D, `exp2(scale * pos²)`. Com `scale` negativo, o peso cai com a distância.
5. **Horz3 e Horz5**: filtro gaussiano horizontal de 3 e de 5 amostras na mesma linha emulada
   (deslocada por `off`). Os pesos vêm de `Gaus(dst ± k, hardPix)` e a soma é normalizada. Isso
   suaviza os pixels na horizontal como o feixe de um CRT; `hardPix` controla a nitidez.
6. **Scan**: peso da linha de varredura, `Gaus(Dist(pos).y + off, hardScan)`. O centro da linha recebe
   peso alto e o espaço entre linhas fica escuro; `hardScan` controla a espessura da linha.
7. **Tri**: combina as três linhas vizinhas (acima, atual, abaixo): `Horz3` para as vizinhas, `Horz5`
   para a atual, cada uma multiplicada pelo seu peso de `Scan`. Não normaliza, então os vãos entre
   linhas ficam escuros (as scanlines).
8. **Mask**: máscara de fósforo. A partir da coordenada em pixels da tela, desloca x por `3 * y`
   (máscara inclinada), toma a fase dentro de um período de 6 pixels e reforça um canal por terço
   (R, G ou B recebem `maskLight`, os demais `maskDark`).
9. **ToLinear e ToSrgb**: conversões entre sRGB e linear (curva padrão do sRGB). A entrada é
   linearizada no `Fetch`; o resultado final volta para sRGB no fim do `mainImage`.

`mainImage` original mostra três painéis lado a lado: sem efeito, scanline suave sem máscara e o efeito
completo (`Warp` + `Tri` + `Mask`), separados por barras escuras (`Bar`).

### Entradas

| Entrada | Uso no original | Mapeamento no projeto |
|---|---|---|
| `iChannel0` | imagem de entrada, lida com `texture()` | textura interna da cena (`rgba8unorm`, a mesma da etapa 6), lida com `textureLoad` |
| `iResolution` | tamanho da tela em pixels; também define `res = iResolution.xy / 6.0` | `rectSize` (tamanho do retângulo de exibição); `res` passa a ser `internalSize` |
| `fragCoord` | coordenada do pixel, origem no canto inferior esquerdo | reconstruída no blit: `(uv.x * rectSize.x, (1 - uv.y) * rectSize.y)` |

O código não usa `iTime` nem `iMouse`.

## Adaptações

| Construção no GLSL | Equivalente no WGSL | Motivo |
|---|---|---|
| `mainImage(out vec4 fragColor, in vec2 fragCoord)` com três painéis | `crtMainImage(fragCoord) -> vec3<f32>` só com o painel completo | Só o efeito completo interessa; painéis "sem efeito" e "scanline suave", a função `Bar` e as comparações com `iResolution.x * 0.333` e `0.666` foram descartados. |
| `Warp(fragCoord.xy/iResolution.xy + vec2(-0.333, 0.0))` | `Warp(fragCoord / post.rectSize)` | O deslocamento de -0.333 só existia para mostrar a imagem no terço direito do demo. |
| `#define res (iResolution.xy/6.0)` | `fn res() -> vec2<f32> { return post.internalSize; }` | O efeito emula a grade de pixels da imagem interna do jogo, então as scanlines coincidem com as linhas internas (400 linhas), e não com as linhas do monitor. A largura interna varia no modo moderno (320 a 1400), por isso vem de um uniform e não de constante. |
| `float hardScan=-8.0;` (variável global, alterada no painel do meio) | `const hardScan : f32 = -8.0;` | Sem o painel do meio não há mais escrita na variável; `#define` e globais viram `const` no nível do módulo. |
| `float hardPix=-3.0;` | `const hardPix : f32 = -3.0;` | Idem. |
| `vec2 warp=vec2(1.0/32.0,1.0/24.0);` | `const warp : vec2<f32> = vec2<f32>(1.0 / 32.0, 1.0 / 24.0);` | Idem. |
| `float maskDark=0.5; float maskLight=1.5;` (alteradas no painel do meio) | `const maskDark : f32 = 0.5; const maskLight : f32 = 1.5;` | Idem. |
| — | `const MASK_ENABLED = true;` | Opção do projeto. Com `false`, `Mask` devolve `vec3(1.0)`, o mesmo que `maskDark = maskLight = 1.0`. |
| — | `const WARP_ENABLED = true;` | Opção do projeto. Com `false`, `Warp` devolve `pos` sem alteração (a curvatura corta as bordas). |
| `texture(iChannel0, pos.xy, -16.0)` com `pos = floor(pos*res+off)/res` | `textureLoad(scene, vec2<i32>(idx.x, H - 1 - idx.y), 0)` com `idx = vec2<i32>(floor(pos * res() + off))` | Sem sampler: leitura do texel exato por índice inteiro. A textura tem a origem em cima e o `pos` do Shadertoy tem a origem embaixo, por isso a linha é `H - 1 - idx.y`. |
| `if(max(abs(pos.x-0.5),abs(pos.y-0.5))>0.5) return vec3(0.0);` | `if (idx.x < 0 \|\| idx.x >= W \|\| idx.y < 0 \|\| idx.y >= H) { return vec3<f32>(0.0); }` | A checagem original é feita sobre `pos` já arredondado e aceita `pos = 1.0`, que corresponde ao índice `W` (ou `H`), um texel além do fim da textura. Com sampler isso só repetia a borda; com `textureLoad`, ler fora dos limites é inválido. A checagem passa a ser feita sobre o índice inteiro. |
| `(c<=0.04045) ? c/12.92 : pow((c+0.055)/1.055, 2.4)` | `select(pow(max((c + 0.055) / 1.055, 0.0), 2.4), c / 12.92, c <= 0.04045)` | O ternário vira `select(falso, verdadeiro, cond)`. `pow` com base negativa é indefinido em WGSL, e `select` avalia os dois lados, então a base é protegida com `max(…, 0.0)`. |
| `(c<0.0031308 ? c*12.92 : 1.055*pow(c,0.41666)-0.055)` | `select(1.055 * pow(max(c, 0.0), 0.41666) - 0.055, c * 12.92, c < 0.0031308)` | Idem. |
| `ToLinear` / `ToSrgb` (comentário: "não seriam necessárias com texturas sRGB") | mantidas | A textura interna (`rgba8unorm`) e o canvas não usam formato sRGB, então os valores lidos estão em sRGB e a conversão é necessária para o cálculo linear. |
| `pos=...` alterando o parâmetro em `Fetch`, `Dist`, `Warp` e `Mask` | cópia para `var` (ou `let`) local | Parâmetros de função são imutáveis em WGSL. |
| `Mask(fragCoord.xy)` | `Mask(fragCoord)`, com `fragCoord` em pixels do retângulo de exibição e origem embaixo | Mesmo sistema do Shadertoy. A máscara é calculada em pixels reais da tela (período de 6 pixels) e pode gerar moiré em projetores ou telas de alta densidade; `MASK_ENABLED` permite desligar. |
| `fragColor.a = 1.0` | alpha 1.0 definido em `fs_main` do blit | O efeito devolve só `vec3`. |
| tipos implícitos (`1.0` e `1` misturados) | tipos explícitos (`f32`, `i32`, `vec2<f32>`) | WGSL não converte implicitamente entre inteiro e decimal. |

## Integração

- O efeito roda na segunda passada (blit) da etapa 6, que copia a textura interna da cena para o
  retângulo de exibição do canvas. A cena 3D não é alterada.
- `src/shaders/blit.wgsl` e `src/shaders/crt.wgsl` são concatenados num único módulo (WGSL não tem
  `#include`). O `crt.wgsl` usa a textura `scene` e o uniform `post` declarados no `blit.wgsl`.
- `fs_main` do blit calcula `rel` (pixel relativo ao retângulo), `uv = rel / tamanho` (origem em cima)
  e `fragCoord` no estilo Shadertoy, e chama `postProcess(rel, uv, fragCoord)`:
  - `post.crt = 0.0`: leitura nearest com o mesmo cálculo da etapa 6 (`floor(rel * interna / retângulo)`);
  - `post.crt = 1.0`: `crtMainImage(fragCoord)`.
- Os pixels fora do retângulo (barras pretas do modo retro) não são desenhados pelo blit (viewport) e
  ficam com a cor de limpeza preta.
- Bindings do blit (grupo 0):
  - `binding 0`: `scene`, textura interna (`texture_2d<f32>`), lida com `textureLoad`;
  - `binding 1`: uniform do blit da etapa 6 (`origin`, `size`, `internal`);
  - `binding 2`: uniform de pós-processamento `post`, 32 bytes:

| Campo | Tipo | Offset | Uso |
|---|---|---|---|
| `internalSize` | `vec2<f32>` | 0 | tamanho da textura interna (`res` do original) |
| `rectSize` | `vec2<f32>` | 8 | tamanho do retângulo de exibição (`iResolution`) |
| `time` | `f32` | 16 | reservado; o efeito CRT não lê |
| `crt` | `f32` | 20 | 0.0 desligado, 1.0 ligado |
| `_pad` | `vec2<f32>` | 24 | preenchimento até 32 bytes |

- Controles: tecla X e botão "CRT: ligado / desligado"; padrão `DEFAULT_CRT = true` em `src/gpu/Display.js`.

## Parâmetros

Constantes no topo de `src/shaders/crt.wgsl`:

| Constante | Valor | Original | Efeito |
|---|---|---|---|
| `hardScan` | -8.0 | -8.0 | dureza da scanline (-8 suave, -16 média) |
| `hardPix` | -3.0 | -3.0 | dureza dos pixels na linha (-2 suave, -4 duro) |
| `warp` | (1/32, 1/24) | (1/32, 1/24) | curvatura da tela (0 = nenhuma, 1/8 = extrema) |
| `maskDark` | 0.5 | 0.5 | intensidade dos canais apagados da máscara |
| `maskLight` | 1.5 | 1.5 | intensidade do canal aceso da máscara |
| `MASK_ENABLED` | true | — | `false` desliga a máscara de fósforo |
| `WARP_ENABLED` | true | — | `false` desliga a curvatura |

## Fonte

- Título: PUBLIC DOMAIN CRT STYLED SCAN-LINE SHADER (página do Shadertoy: "FixingPixelArt")
- Publicado no Shadertoy por: TimothyLottes
- Autor original, conforme o código: Timothy Lottes
- URL: https://www.shadertoy.com/view/XsjSzR
- Licença: domínio público, conforme o cabeçalho do próprio código
- Acessado em: 03/10/2026
