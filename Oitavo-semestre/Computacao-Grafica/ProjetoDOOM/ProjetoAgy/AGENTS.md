Contexto: trabalho de faculdade de computação gráfica, em grupo, com apresentação em 05/10/2026. O objetivo é recriar o Doom no navegador usando WebGPU puro (sem Three.js, Babylon.js ou outra engine), em JavaScript com ES modules, servido por um servidor estático. Começamos do zero. Os dados vêm do arquivo freedoom1.wad.

Fidelidade visual: o resultado deve ser o mais idêntico possível ao Doom original. O mapa é geometria 3D simples (paredes com textura superior, central e inferior; chãos e tetos a partir dos subsectors), os inimigos e itens são sprites 2D que giram só no eixo vertical para encarar o jogador. Texturas sem filtro suavizado, resolução interna baixa esticada para a tela, e iluminação por setor usando a tabela COLORMAP do WAD. A única diferença em relação ao original é a câmera livre, que permite olhar para cima e para baixo.

Regras de trabalho:
- Trabalhamos em etapas lineares. Faça somente a etapa que eu pedir, sem adiantar as próximas.
- Prefira a solução mais simples que funcione, porque o prazo é curto.
- Antes de escrever código, explique em poucas linhas a abordagem e as decisões técnicas. Ao usar uma estrutura do formato WAD, diga qual é e o que ela guarda.
- Comente os trechos não óbvios.
- Quando algo der erro, peça a mensagem do console em vez de adivinhar a causa.
- Use sempre WebGPU e WGSL, nunca WebGL.

Etapa 1: crie a estrutura do projeto e uma página que inicialize o WebGPU (adaptador, dispositivo, contexto do canvas), com mensagem clara caso o navegador não suporte. Desenhe uma sala simples (chão, teto e quatro paredes, cada superfície com uma cor diferente) usando vertex buffer, index buffer e depth buffer. Implemente uma câmera em primeira pessoa com WASD e mouse (pointer lock), com rotação horizontal e vertical (pitch limitado a cerca de 89 graus). Use as unidades do Doom como escala, com o jogador de 56 unidades de altura e olhos a 41 unidades do chão.