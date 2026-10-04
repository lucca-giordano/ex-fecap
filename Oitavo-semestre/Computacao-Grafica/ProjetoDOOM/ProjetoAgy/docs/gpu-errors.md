# Diagnóstico e Tratamento de Erros de GPU (WebGPU)

Registro técnico de incidentes, conceitos de validação do WebGPU, instrumentação preventiva e procedimentos de diagnóstico.

---

## Incidente: Tela Preta por Pipeline Inválida (Etapa 11)

### 1. Sintoma Observado
Ao carregar o jogo com os sprites ativados, o canvas HTML permanecia completamente preto.
O HUD de depuração continuava atualizando posição e ângulo da câmera ao interagir com mouse e teclado, evidenciando que a CPU e o loop JavaScript rodavam sem travar. O console exibia repetidamente (cortado após ~248 vezes pelo navegador):

```text
[Invalid RenderPipeline (unlabeled)] is invalid due to a previous error.
 - While encoding [RenderPassEncoder (unlabeled)].SetPipeline([Invalid RenderPipeline (unlabeled)]).
 - While finishing [CommandEncoder (unlabeled)].

[Invalid CommandBuffer] is invalid due to a previous error.
 - While calling [Queue].Submit([[Invalid CommandBuffer]])

WebGPU: too many warnings, no more warnings will be reported to the console for this GPUDevice.
```

---

## Conceitos Fundamentais do WebGPU

1. **Falha Silenciosa no JavaScript (Assincronia da GPU)**:
   O WebGPU **não lança exceções síncronas** no JavaScript quando a criação de uma pipeline (`createRenderPipeline` ou `createComputePipeline`) falha por erro de validação ou de shader WGSL. A API devolve um objeto inválido na CPU e emite o erro assincronamente via escopo de validação (`GPUErrorScope`). Blocos `try/catch` síncronos ao redor dessas chamadas não capturam absolutamente nada.

2. **Invalidação em Cascata do Command Buffer**:
   Se uma pipeline inválida for submetida a um Render Pass Encoder (`setPipeline`), o passe inteiro é invalidado. Quando `commandEncoder.finish()` é invocado, o `GPUCommandBuffer` gerado torna-se nulo/inválido. Na chamada `queue.submit([commandBuffer])`, o frame inteiro é descartado pela GPU. O resultado é a tela preta total, mesmo que todas as outras passadas daquele frame (cena 3D, céu, partículas, menu e blit) estivessem perfeitamente válidas.

3. **Isolamento de Eventos de Erro de GPU**:
   Erros de validação do WebGPU não passam por `window.onerror` nem por `window.addEventListener('unhandledrejection')`. Sem registrar `device.addEventListener('uncapturederror', ...)` ou envolver a criação com `pushErrorScope('validation')`, os erros de GPU passam desapercebidos pelo código da aplicação.

4. **Objetos Sem Label (`[unlabeled]`)**:
   Quando recursos WebGPU (buffers, texturas, views, layouts e pipelines) são instanciados sem a propriedade `label`, as mensagens de diagnóstico do navegador apontam apenas `[unlabeled]`, obscurecendo qual módulo provocou a falha.

---

## Causas Confirmadas no Código

A análise detalhada do código identificou duas causas fundamentais para a falha da pipeline de sprites:

1. **Incompatibilidade de Formato de Cor no Render Target**:
   - Em `src/main.js`, `SpriteSet` era instanciado recebendo `presentationFormat` (`bgra8unorm` no Google Chrome sob Windows).
   - Contudo, a passada `spriteSet.recordRenderPass` renderizava sobre `display.sceneColorView`, pertencente a `display.sceneColorTexture`, cujo formato é `'rgba8unorm'`.
   - A especificação WebGPU proíbe vincular uma pipeline configurada para um formato (`bgra8unorm`) a um passe com anexo de cor em formato diferente (`rgba8unorm`). Essa incompatibilidade invalida a pipeline ou a codificação do render pass.

2. **Tipagem Heterogênea no `textureLoad` de Textura Array (WGSL)**:
   - Em `src/gpu/SpriteSet.js` (linha 122), o shader utilizava:
     `let texel = textureLoad(spriteTextures, vec2<i32>(u, v), in.layer, 0);`
   - O argumento de coordenadas `vec2<i32>` utilizava inteiros com sinal (`i32`), enquanto o índice de camada `in.layer` era `u32`.
   - Pela especificação WGSL, `textureLoad(texture_2d_array<T>, coords: vec2<I>, array_index: I, level: I)` exige estritamente que coordenadas e índice da camada pertençam ao mesmo tipo inteiro `I`. Essa divergência pode invalidar a compilação no compilador nativo (Dawn/Tint).

---

## Correções Aplicadas

1. **Alinhamento do Formato de Cor**:
   - O construtor e inicializador de `SpriteSet` foram ajustados para utilizar explicitamente `'rgba8unorm'`, coincidindo com a textura offscreen da cena.
2. **Homogeneização de Tipos no WGSL**:
   - Atualizado para `textureLoad(spriteTextures, vec2<i32>(u, v), i32(in.layer), 0i)` e `textureLoad(litPalette, vec2<i32>(i32(texel.r), level), 0i)`.
3. **Módulo Central de Criação Checada (`src/gpu/gpuChecks.js`)**:
   - Implementadas as funções `createShaderModuleChecked`, `createRenderPipelineChecked`, `createComputePipelineChecked`, `createBindGroupLayoutChecked` e `createBindGroupChecked`.
   - Cada helper encapsula a chamada em `device.pushErrorScope('validation')` e `await device.popErrorScope()`, além de verificar `shaderModule.getCompilationInfo()`.
4. **Padronização Universal de Labels (`"modulo.objeto"`)**:
   - Todos os recursos GPU receberam identificadores descritivos (`sprites.pipeline`, `sprites.textureArray`, `display.blitPipeline`, `scene.shaderModule`, etc.).
5. **Captura de Erros Não Tratados (`uncapturederror`)**:
   - Registrado `device.addEventListener('uncapturederror', ...)` em `src/main.js`, roteando a mensagem para o quadro vermelho da aplicação (`displayDevError`).
6. **Fallback de Sessão para Recursos Opcionais**:
   - Se a pipeline de sprites, partículas ou menu falhar, o recurso é desligado na sessão atual sem persistir no `localStorage`. A passada não é codificada no Command Encoder, mantendo a cena 3D e o blit em execução regular.
7. **Validação nos 5 Primeiros Frames**:
   - Os primeiros 5 frames de renderização e submissão são envolvidos por escopos de validação não bloqueantes para interceptar eventuais erros de gravação de passadas.
8. **Parâmetro de Teste de Fallback**:
   - Abertura com `?breakSprites=1` na URL força intencionalmente a criação de `SpriteSet` com um entry point inexistente, provando o funcionamento do fallback seguro em tempo real.
9. **Página de Diagnóstico (`debug/gpu-check.html`)**:
   - Cria o dispositivo WebGPU, exibe limites de hardware, formato preferido do canvas e valida individualmente todos os shader modules e pipelines do motor usando os descritores reais.

---

## Estado das Verificações (Sem Navegador)

### O que foi verificado:
- **`node --check`**: Todos os 43 arquivos `.js` e `.mjs` do projeto validados com 0 erros de sintaxe.
- **ESLint**: 0 erros em todo o código (2 advertências pré-existentes de variáveis não utilizadas em `debug/colormap.js` e `debug/menu.js`).
- **Testes Automatizados de Sprites (`tools/check-sprites.mjs`)**: Sucesso em 100% dos testes de registro, dimensões e decodificação de lumps do WAD.
- **Testes de Menu (`tools/check-menu.mjs`)**: 100% de aprovação de limites e desenho de patches.
- **Testes de Partículas (`tools/check-particles.mjs`)**: 100% de aprovação em tamanhos de struct WGSL, alinhamentos de 16 bytes e monotonicidade.

### O que NÃO foi verificado:
- Inicialização de contexto WebGPU em hardware e driver gráfico real.
- Compilação dos shaders pelo compilador nativo do navegador (Dawn/Tint).
- Saída visual do canvas e taxa de quadros (FPS) em execução interativa.

---

## Incidente 2: Palavra Reservada no WGSL (Etapa 11)

### 1. Sintoma Observado
Ao iniciar o jogo com os sprites habilitados, o canvas WebGPU ficava totalmente preto. O loop JavaScript e o HUD continuavam responsivos a comandos de teclado e mouse, mas o console do navegador emitia mensagens sucessivas de pipeline e command buffer inválidos:
```text
Error while parsing WGSL: :51:9 error: 'meta' is a reserved keyword
    let meta = spriteMeta[inst.layer];
        ^^^^
[Invalid ShaderModule] is invalid due to a previous error.
 - While validating vertex stage: [Invalid ShaderModule]
```
Por consequência da pipeline inválida ser associada à passada de sprites, todo o `GPUCommandBuffer` era rejeitado pela fila da GPU (`[Invalid CommandBuffer]`), anulando toda a renderização do frame.

### 2. Causa Exata
No shader de vértices embutido em `src/gpu/SpriteSet.js` (linha ~51), a variável local que recebia os metadados do sprite atual foi nomeada como `meta`:
```wgsl
let meta = spriteMeta[inst.layer];
```
Pela especificação oficial do WGSL (W3C WebGPU Shading Language, seção "Reserved Words"), a palavra `meta` é uma palavra reservada da linguagem e seu uso como identificador de variável é estritamente proibido pela gramática do WGSL.

### 3. Por que Ferramentas JavaScript Tradicionais Não Detectam
O código WGSL em projetos WebGPU puros em JavaScript é frequentemente armazenado como strings literais de template (delimitadas por crases `` ` ``). Para ferramentas estáticas como o parser do V8 (`node --check`) e o analisador léxico do ESLint, esse conteúdo é tratado meramente como uma cadeia de texto opaca (`string`). Nenhum linter JavaScript padrão valida regras léxicas, sintáticas ou palavras reservadas pertencentes à gramática do WGSL.

### 4. Como a Página `debug/gpu-check.html` Localizou o Erro
A página `debug/gpu-check.html` realiza uma validação isolada e determinística de cada recurso WebGPU antes de tentar montar a cena:
- Solicita o dispositivo GPU real e compila individualmente cada `GPUShaderModule`.
- Consulta a promessa `shaderModule.getCompilationInfo()`.
- Cria pipelines de render e compute isoladas com `device.pushErrorScope('validation')`.
Ao isolar o módulo `sprites.shaderModule`, a página capturou diretamente o relatório de compilação do Tint/Dawn com a linha, coluna e mensagem exata de erro (`'meta' is a reserved keyword`), sem a poluição de centenas de avisos gerados em cascata pelo loop de renderização contínuo do jogo.

### 5. Alterações Realizadas no Projeto
1. **Renomeação no WGSL (`src/gpu/SpriteSet.js`)**:
   A variável local foi renomeada de `meta` para `spriteInfo` em todos os pontos de declaração e acesso dentro de `SPRITE_SHADER_WGSL`. O nome do buffer global `spriteMeta` foi preservado intacto.
2. **Ferramenta de Verificação Estática de Palavras Reservadas (`tools/check-wgsl-reserved.mjs`)**:
   Criado script em Node.js que inspeciona todos os arquivos `.wgsl` e blocos de WGSL embutidos em arquivos `.js`, remove comentários e compara cada identificador contra a lista canônica de palavras reservadas da especificação W3C.
3. **Robustez do Fallback em Tempo de Execução (`src/core/Settings.js` e `src/main.js`)**:
   - Incluída a validação de tipo para a chave `'sprites'` no `SettingsManager`.
   - Adicionado parâmetro `persist` em `settings.set(key, value, persist = true)` para permitir desativações de sessão sem sobrescrever as preferências salvas no `localStorage`.
   - Adicionada flag estrita `spritesAvailable` em `src/main.js`, inicializada em `false` e somente definida como `true` caso `await spriteSet.init()` conclua com sucesso.
   - O loop de frame consulta `spritesAvailable` antes de construir instâncias e antes de codificar `spriteSet.recordRenderPass()`, garantindo que eventuais falhas não invalidem o `GPUCommandBuffer`.

