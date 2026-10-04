# Efeito de Pós-Processamento CRT (Monitor de Tubo)

## Fonte
- **Título da página:** FixingPixelArt
- **Publicado no Shadertoy por:** TimothyLottes
- **Autor original:** Timothy Lottes
- **URL:** https://www.shadertoy.com/view/XsjSzR
- **Licença:** Domínio público, conforme o cabeçalho do próprio código ("PUBLIC DOMAIN CRT STYLED SCAN-LINE SHADER by Timothy Lottes")
- **Data de acesso:** 03/10/2026

---

## Análise

O efeito recria a estética visual de um monitor arcade CGA de tubo de raios catódicos (CRT) de alta qualidade alimentado por sinal RGB direto. Ele simula a curvatura física da tela de vidro, a amostragem discreta da grade de pixels original, a dispersão horizontal do feixe eletrônico com feixes gaussianos sobrepostos, o intervalo escuro entre linhas de varredura (scanlines) e o padrão de máscara de sombra (shadow mask) de fósforo colorido.

O algoritmo executa as seguintes etapas, na ordem do código original:

1. **Warp (Curvatura da tela):**
   Mapeia as coordenadas normalizadas $[0, 1]$ para $[-1, 1]$, aplicando uma distorção não-linear em barril onde cada eixo é distorcido proporcionalmente ao quadrado da distância ao centro no eixo oposto ($pos \cdot (1 + pos_{\perp}^2 \cdot warp)$). Em seguida, remaneja o resultado para $[0, 1]$. Pontos fora dos limites do tubo caem fora do intervalo e são descartados como pretos na leitura.
2. **Fetch e Dist (Amostragem discreta e distância ao texel):**
   - `Fetch`: Amostra o buffer da cena na resolução emulada discreta `res` com um deslocamento de texel `off`. Se a posição estiver fora dos limites válidos, retorna preto (`vec3(0.0)`). O texel lido em sRGB é convertido para o espaço de cores linear via `ToLinear`.
   - `Dist`: Calcula a distância vetorial contínua (em frações de texel emulado, intervalo $[-0.5, 0.5]$) do fragmento atual até o centro do texel mais próximo.
3. **Horz3 e Horz5 (Filtros horizontais gaussianos):**
   Aplicam convolução gaussiana unidimensional ao longo da linha horizontal para simular a resposta finita do feixe de elétrons ao longo do traçado:
   - `Horz3`: Filtro de 3 toques (deslocamentos $-1, 0, +1$) ponderados pela distância horizontal e pelo expoente de dureza `hardPix`.
   - `Horz5`: Filtro de 5 toques (deslocamentos $-2, -1, 0, +1, +2$) na linha central, gerando uma transição horizontal mais suave e contínua.
4. **Scan (Peso vertical da scanline):**
   Calcula a atenuação vertical do feixe de elétrons a partir da distância vertical `dst.y` somada ao deslocamento da linha `off`, usando a curva gaussiana $\exp_2(hardScan \cdot \Delta y^2)$. Isso produz a queda de intensidade entre linhas consecutivas, criando as scanlines pretas ou tênues.
5. **Tri (Interpolação de três scanlines sobrepostas):**
   Combina as três linhas de varredura verticais mais próximas do ponto: a linha anterior (`off = -1.0`, usando `Horz3` e peso `wa`), a linha central (`off = 0.0`, usando `Horz5` e peso `wb`) e a linha seguinte (`off = 1.0`, usando `Horz3` e peso `wc`). A soma linear $a \cdot wa + b \cdot wb + c \cdot wc$ gera a transição suave de brilho e feixes sobrepostos.
6. **Mask (Máscara de fósforo / Shadow mask):**
   Simula o padrão de fósforo físico da tela (tríade RGB). A grade é rotacionada com `pos.x += pos.y * 3.0` com repetição a cada 6 pixels reais da tela. Conforme a posição fracionária, o canal correspondente (R, G ou B) recebe ganho `maskLight` enquanto os outros dois recebem atenuação `maskDark`.
7. **ToLinear e ToSrgb (Transformações de espaço de cor):**
   - `ToLinear`: Converte os canais sRGB da textura de entrada para espaço linear puro ($c \le 0.04045 \implies c/12.92$, senão $((c+0.055)/1.055)^{2.4}$) para garantir que as misturas gaussianas de luz e sobreposição de feixes ocorram em radiância linear correta.
   - `ToSrgb`: Converte a cor final filtrada de volta para sRGB ($c < 0.0031308 \implies c \times 12.92$, senão $1.055 \times c^{1/2.4} - 0.055$) para envio ao monitor.

### Entradas Utilizadas
- **`iChannel0`:** Textura de cor da cena emulada. No nosso projeto, corresponde à textura fora da tela (`sceneTexture`), de formato `rgba8unorm`.
- **`iResolution`:** Resolução da tela de exibição. No nosso projeto, corresponde a `blitUniforms.rectSize` (o tamanho em pixels físicos do retângulo de destino no canvas).
- **Confirmação:** O código de Timothy Lottes **não** utiliza `iTime` nem `iMouse`. O efeito é estático e determinístico em relação à geometria e coordenadas dos pixels.

---

## Adaptações

| Construção no GLSL original | Equivalente no WGSL adaptado | Motivo da adaptação |
| :--- | :--- | :--- |
| `void mainImage(out vec4 fragColor, in vec2 fragCoord)` com divisões `if (fragCoord.x < iResolution.x * 0.333) ...` e barras divisórias `Bar(...)` | Função `crtPostProcess(uv, fragCoord) -> vec3<f32>` isolada, portando somente o painel direito | Os painéis comparativos de demonstração do Shadertoy (imagem original sem filtro e scanlines suaves) não fazem parte do jogo. Mantivemos unicamente a pipeline completa do CRT. |
| `#define res (iResolution.xy/6.0)` | `blitUniforms.internalSize` (uniform dinâmico) | Alinha as scanlines diretamente às linhas de renderização internas do jogo ($640 \times 400$ no modo retro, ou $W \times 400$ no moderno), em vez de depender arbitrariamente da resolução da tela. |
| `texture(iChannel0, pos.xy, -16.0)` com sampler GLSL e checagem de limites `if(max(abs(pos.x-0.5),abs(pos.y-0.5))>0.5)` | Leitura direta via `textureLoad(sceneTexture, vec2<i32>(col, row), 0)` com verificação de limites em índices inteiros | O WebGPU dispensa o uso de sampler aqui. A checagem original em ponto flutuante aceitava `pos = 1.0` após arredondamento, acessando um texel além do fim da textura. A checagem corrigida em inteiros (`idx.x < 0 \|\| idx.x >= W \|\| idx.y < 0 \|\| idx.y >= H`) garante ausência de leituras fora do buffer. |
| Origem das coordenadas no canto inferior esquerdo (OpenGL/Shadertoy) | `row = H - 1 - idx.y` dentro de `Fetch` e `fragCoord = vec2(uv.x * rectSize.x, (1.0 - uv.y) * rectSize.y)` | No WebGPU a origem da textura e do canvas é no canto superior esquerdo. A conversão explícita garante que a imagem e a máscara não fiquem invertidas verticalmente. |
| Variáveis globais mutáveis `hardScan`, `hardPix`, `warp`, `maskDark`, `maskLight` | Constantes `const` declaradas no nível do módulo com anotações de tipo explícitas (`f32`, `vec2<f32>`) | O WGSL não permite variáveis globais mutáveis sem bindings específicos, e o painel central que alterava esses valores foi descartado. |
| Curvatura fixa incondicional | Constante `const WARP_ENABLED: bool = true;` | Permite desligar a curvatura da tela sem alterar a lógica de scanlines e máscara, caso seja desejado evitar corte nas bordas da geometria. |
| Máscara fixa incondicional | Constante `const MASK_ENABLED: bool = true;` | Permite desativar a máscara de fósforo se houver padrão de moiré indesejado em monitores de alta densidade ou projetores. |
| `pow(x, y)` sem proteção | `pow(max(c, 0.0), exponent)` em `ToLinear1` e `ToSrgb1` | A especificação do WGSL define `pow(x, y)` como indefinido para $x \le 0.0$. |
| Modificação de parâmetros formais nas funções (`pos = pos * 2.0 - 1.0`, etc.) | Declaração de variáveis locais mutáveis `var pos = posInput;` | Parâmetros de função em WGSL são imutáveis por especificação. |

---

## Integração

O efeito é integrado diretamente na segunda passada de renderização (passada de **Blit**), que transfere a imagem 3D da textura fora da tela (`sceneTexture`) para o canvas final.

- **Ponto de entrada:** A função `postProcess(uv: vec2<f32>, fragCoord: vec2<f32>) -> vec3<f32>` no fragment shader de blit recebe:
  - `uv`: Coordenadas normalizadas do retângulo de destino $[0, 1]$ com origem no topo esquerdo.
  - `fragCoord`: Coordenadas em pixels no padrão Shadertoy (com origem no canto inferior esquerdo do retângulo de exibição).
- **Chaveamento dinâmico:**
  - Quando `blitUniforms.crt < 0.5`: executa o caminho tradicional da Etapa 6 com amostragem nearest pura pixel-a-pixel.
  - Quando `blitUniforms.crt >= 0.5`: invoca `crtPostProcess(uv, fragCoord)`.
- **Uniform Buffer do Blit (32 bytes):**
  - `internalSize: vec2<f32>` (offset 0, 8 bytes): Dimensões da textura interna da cena ($640 \times 400$ no modo retro).
  - `rectSize: vec2<f32>` (offset 8, 8 bytes): Dimensões do retângulo de exibição em pixels no canvas.
  - `time: f32` (offset 16, 4 bytes): Tempo decorrido em segundos (reservado).
  - `crt: f32` (offset 20, 4 bytes): Estado do efeito ($0.0$ = desligado, $1.0$ = ligado).
  - `padding: vec2<f32>` (offset 24, 8 bytes): Alinhamento para múltiplos de 16 bytes.

---

## Parâmetros

As seguintes constantes controlam a aparência e o comportamento do shader em `src/shaders/crt.wgsl`:

- `hardScan: f32 = -8.0;`: Dureza das linhas de varredura verticais (valores típicos: $-8.0$ suave, $-16.0$ médio/intenso).
- `hardPix: f32 = -3.0;`: Dureza do filtro gaussiano horizontal ao longo da scanline (valores típicos: $-2.0$ suave, $-4.0$ nítido).
- `warp: vec2<f32> = vec2<f32>(1.0 / 32.0, 1.0 / 24.0);`: Coeficientes de curvatura em barril horizontal e vertical ($0.0$ para plano, $1.0/8.0$ extremo).
- `maskDark: f32 = 0.5;`: Fator de atenuação para os fósforos inativos da máscara.
- `maskLight: f32 = 1.5;`: Fator de realce para o fósforo ativo da máscara.
- `WARP_ENABLED: bool = true;`: Ativa ou desativa a curvatura geométrica da tela.
- `MASK_ENABLED: bool = true;`: Ativa ou desativa a grade de fósforo RGB.
