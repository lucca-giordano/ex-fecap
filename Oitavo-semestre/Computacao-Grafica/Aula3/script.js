async function initWebGPU() {

    // 1. Verificar se o navegador suporta WebGPU
    if(!navigator.gpu){
        alert("Seu navegador não suporta WebGPU");
        return;
    }

    // 2. Obter adaptador do WebGPU
    const adpt = await navigator.gpu.requestAdapter();
    if(!adpt){
        alert("Falha ao obter adaptador WebGPU");
        return;
    }

    // 3. Encontrar a GPU
    const gpu = await adpt.requestDevice();

    // 4. Configurar o canvas
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("webgpu");
    const canvasSize = navigator.gpu.getPreferredCanvasFormat();

    ctx.configure({
        device: gpu,
        format: canvasSize,
        alphaMode: "premultiplied"
    })

    // 5. Dados do triangulo
    const vertices = new Float32Array([
//       X     Y     R  G  B  A
         0,  0.4,  1, 0, 0, 1,
        -0.6, -0.6,  0, 1, 0, 1,
         0.6, -0.6,  0, 0, 1, 1
    ])

    // 6. Criar o buffer de VRAM
    const buffer = gpu.createBuffer({
        size: vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    })

    gpu.queue.writeBuffer(buffer, 0, vertices);

    // 7. Criar o shader
    const shader =
    `
    struct SaidaVertex{
        @builtin(position) posicao: vec4f,
        @location(0) cor: vec4f,
    }

    @vertex
    fn vs_main(@location(0) pos: vec2f, @location(1) cor: vec4f) -> SaidaVertex{
        var saida: SaidaVertex;
        saida.posicao = vec4f(pos, 0.0, 1.0);
        saida.cor = cor;
        return saida;
    }

    @fragment
    fn fs_main(entrada: SaidaVertex) -> @location(0) vec4f {
        return entrada.cor;
    }

    `;

    const moduloShader = gpu.createShaderModule({
        code: shader,
    });

    // 8. Criar a pipeline
    const pipeline = gpu.createRenderPipeline({
        layout: "auto",
        vertex: {
            module: moduloShader,
            entryPoint: "vs_main",
            buffers: [{
                arrayStride: 6 * 4,
                attributes: [
                    {
                        shaderLocation: 0,
                        offset: 0,
                        format: "float32x2"
                    },
                    {
                        shaderLocation: 1,
                        offset: 2 * 4,
                        format: "float32x4"
                    }
                ]
            }]
        },
        fragment: {
            module: moduloShader,
            entryPoint: "fs_main",
            targets: [{
                format: canvasSize
            }]
        },
        primitive: {
            topology: "triangle-list"
        }
    })

    function frame(){
        const textureView = ctx.getCurrentTexture().createView();
        const encondeCom = gpu.createCommandEncoder();
        const renderPass = encondeCom.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: {r: 0.1, g: 0.1, b: 0.1, a: 1.0},
                loadOp: "clear",
                storeOp: "store"
            }]
        });

        renderPass.setPipeline(pipeline);
        renderPass.setVertexBuffer(0, buffer);
        renderPass.draw(3);
        renderPass.end();
        gpu.queue.submit([encondeCom.finish()]);
        requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
}

initWebGPU();