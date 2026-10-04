# Créditos

## Shaders

### Efeito CRT (pós-processamento)

- Título: PUBLIC DOMAIN CRT STYLED SCAN-LINE SHADER (página do Shadertoy: "FixingPixelArt")
- Publicado no Shadertoy por: TimothyLottes
- Autor original, conforme o código: Timothy Lottes
- URL: https://www.shadertoy.com/view/XsjSzR
- Licença: domínio público, conforme o cabeçalho do próprio código
- Acessado em: 03/10/2026
- Original sem modificações: `src/shaders/external/crt.glsl`
- Adaptação: `src/shaders/crt.wgsl`, porte de GLSL para WGSL. Mantido apenas o painel com o efeito
  completo (curvatura, scanlines com filtro gaussiano e máscara de fósforo); a resolução emulada passou
  a ser a resolução interna do jogo; leitura da imagem com `textureLoad` em vez de sampler, com
  checagem de limites no índice inteiro; parâmetros convertidos em constantes, com opções para
  desligar a máscara e a curvatura. Lista completa das alterações em `docs/shaders/crt.md`.

### Partículas de poeira e brasas (compute shader)

- Projeto: WebGPU Samples (webgpu/webgpu-samples), exemplo "Particles"
- Autores: WebGPU Samples Contributors (conforme o LICENSE do repositório)
- URL: https://github.com/webgpu/webgpu-samples/tree/main/sample/particles
- Licença: BSD-3-Clause
- Acessado em: 03/10/2026
- Originais sem modificações: `src/shaders/external/particles/`
- Adaptação: `src/shaders/particles.wgsl`. Mantidos o gerador aleatório (`init_rand`, `rand`), a
  simulação em compute shader com `workgroup_size(64)` e o desenho por instância com quad de 6 vértices.
  Removido o mapa de probabilidade; a struct da partícula foi refeita (tipo, vida total, fase, tamanho);
  a gravidade foi trocada por velocidades próprias com Y para cima; as partículas vivem numa caixa ao
  redor da câmera com envolvimento; o quad passou a ser opaco, sem blending, com tamanho mínimo em
  pixels e cores da paleta iluminada do Doom. Lista completa em `docs/shaders/particles.md`.

Licença do WebGPU Samples (texto integral, mantido conforme exigido pela licença):

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

## Assets

### Freedoom

- Projeto: Freedoom
- Arquivo usado: `assets/freedoom1.wad`
- Obtido em: <!-- PREENCHER: endereço de onde o arquivo foi obtido -->

Aviso de licença:

<!-- PREENCHER: colar aqui o aviso de licença do arquivo que acompanha o WAD -->
