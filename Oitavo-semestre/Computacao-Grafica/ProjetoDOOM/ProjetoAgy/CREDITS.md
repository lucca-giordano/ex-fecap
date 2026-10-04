# Créditos e Atribuições

## Shaders

### CRT Scan-Line Post-Processing Shader
- **Título original:** FixingPixelArt / PUBLIC DOMAIN CRT STYLED SCAN-LINE SHADER
- **Publicado no Shadertoy por:** TimothyLottes
- **Autor original:** Timothy Lottes
- **URL original:** https://www.shadertoy.com/view/XsjSzR
- **Licença:** Domínio Público ("PUBLIC DOMAIN CRT STYLED SCAN-LINE SHADER by Timothy Lottes. Please take and use, change, or whatever.")
- **Adaptações realizadas:**
  - Porte da linguagem GLSL (WebGL/Shadertoy) para WGSL (WebGPU puro).
  - Remoção dos painéis de demonstração e barras divisórias, isolando apenas o pipeline completo de scanlines, curvatura e máscara de fósforo.
  - Substituição da amostragem com textura e filtro em ponto flutuante por leitura direta e inteira via `textureLoad` sem sampler.
  - Correção de leitura fora de limites da textura na amostragem discreta (`idx >= W` ou `idx >= H`).
  - Alinhamento da resolução de varredura `res` com a resolução interna emulada do jogo (`internalSize`).
  - Adaptação do sistema de coordenadas do Shadertoy (origem no canto inferior esquerdo) para o WebGPU (origem no canto superior esquerdo).
  - Adição de flags de configuração em tempo de compilação (`WARP_ENABLED` e `MASK_ENABLED`) e proteções matemáticas para `pow(max(c, 0.0), exp)`.

### Particles Compute & Render Shader
- **Projeto:** WebGPU Samples (webgpu/webgpu-samples)
- **Autores:** WebGPU Samples Contributors (conforme o LICENSE do repositório)
- **URL original:** https://github.com/webgpu/webgpu-samples/tree/main/sample/particles
- **Licença:** BSD-3-Clause
- **Adaptações realizadas:**
  - Remoção da geração de mapa de probabilidades (`probabilityMap.wgsl`) e imagens externas, substituindo por distribuição espacial pseudoaleatória uniforme dentro de uma caixa tridimensional centrada no jogador.
  - Reestruturação da struct `Particle` para 48 bytes sem campo explícito de cor, usando a paleta do Doom (`litPalette`, 256x32) com iluminação por distância e setor.
  - Adaptação do eixo vertical para Y para cima e remoção da gravidade para baixo (brasas sobem com velocidade constante e poeira flutua suavemente).
  - Implementação de toroide de reposicionamento relativo à câmera ($d = ((d + h) - 2h \cdot \lfloor(d+h)/(2h)\rfloor) - h$).
  - Substituição de máscaras circulares e transparência por quads opacos com bordas duras e fator de escala/encolhimento (`fade`), mantendo o visual retro de pixels sólidos.
  - Suporte a dimensionamento mínimo em tela (`MIN_PIXELS = 2.0`), preservando a legibilidade das partículas a qualquer distância.
  - Integração de buffer de instâncias com teste e escrita no Z-buffer existente da cena.
- **Texto integral da licença:**
```
Copyright 2019 WebGPU Samples Contributors

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

   1. Redistributions of source code must retain the above copyright notice,
      this list of conditions and the following disclaimer.

   2. Redistributions in binary form must reproduce the above copyright notice,
      this list of conditions and the following disclaimer in the documentation
      and/or other materials provided with the distribution.

   3. Neither the name of the copyright holder nor the names of its
      contributors may be used to endorse or promote products derived from this
      software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

---

## Assets

### Freedoom
- **Nome do projeto:** Freedoom (freedoom1.wad)
- **Origem / Repositório oficial:** https://freedoom.github.io/
- **Arquivo utilizado:** `assets/freedoom1.wad` (Fase E1M1)
- **Aviso de licença:**
<!-- ESPAÇO RESERVADO PARA AVISO DE LICENÇA DO FREEDOOM:
     Cole aqui o texto da licença que acompanha a distribuição do freedoom1.wad (BSD-3-Clause / modified BSD license). -->
