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

    // 5. Dados dos objetos
    const invaderData = new Float32Array([
//       X     Y      R  G  B  A
       -0.25, -0.15,  1, 0, 0, 1,
        0.3,  -0.2,   0, 1, 0, 1,
        0.05,  0.28,  0, 0, 1, 1
    ])

    const shipData = new Float32Array([
       -0.09, -0.14,  0.2,  0.5,  1,  1,
        0.09, -0.14,  0.2,  0.5,  1,  1,
        0,     0.16,  1,    1,    1,  1,
    ]);

    const bulletData = new Float32Array([
       -0.015, -0.045,  0.6, 1.0, 0.2, 1,
        0.015, -0.045,  0.6, 1.0, 0.2, 1,
        0.000,  0.055,  1.0, 1.0, 0.6, 1, 
    ])

    // 6. Criar o buffer de VRAM
    function createVerticesBuffer(data){
        const buffer = gpu.createBuffer({
            size: data.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        gpu.queue.writeBuffer(buffer, 0, data);
        return buffer;
    }

    const invaderBuffer = createVerticesBuffer(invaderData);
    const shipBuffer = createVerticesBuffer(shipData);
    const bulletBuffer = createVerticesBuffer(bulletData);



    // 7. Criar o shader
    const shader =
    `
    struct SaidaVertex{
        @builtin(position) posicao: vec4f,
        @location(0) cor: vec4f,
    }

    @group(0) @binding(0)
    var<uniform> matrix: mat4x4f;

    @vertex
    fn vs_main(@location(0) pos: vec2f, @location(1) cor: vec4f) -> SaidaVertex{
        var saida: SaidaVertex;
        saida.posicao = matrix * vec4f(pos, 0.0, 1.0);
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

    // 9. Matrizes de transformação

    function createRotationMatrix(angleRad){
        const c = Math.cos(angleRad);
        const s = Math.sin(angleRad);
        return new Float32Array([
             c, s, 0, 0,
            -s, c, 0, 0,
             0, 0, 1, 0,
             0, 0, 0, 1
        ])
    }

    function createTranslationMatrix(x, y){
        return new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            x, y, 0, 1
        ])
    }

    function createScaleMatrix(factor){
        return new Float32Array([
            factor, 0, 0, 0,
            0, factor, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1,
        ]);
    }

    function multiplyMatrices(a, b){
        const result = new Float32Array(16);

        for(let col = 0; col < 4; col++){
            for(let row = 0; row < 4; row++){
                let sum = 0;

                for(let k = 0; k < 4; k++){
                    sum += a[k * 4 + row] * b[col * 4 + k];
                }

                result[col * 4 + row] = sum;
            }
        }
        return result;
    }

    function createUniformBindGroup(){
        const bufferUniform = gpu.createBuffer({
            size: 16 * 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const bindGroup = gpu.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [{
                binding: 0,
                resource: {
                    buffer: bufferUniform,
                }
            }]
        });

        return {bufferUniform, bindGroup}
    }

    const invaderUniform = createUniformBindGroup();
    const shipUniform = createUniformBindGroup();

    // Estado dos objetos

    const STATE = {
        // Dados do ivnasor
        invaderX: -0.6, invaderY: -0.25,
        invaderDir: 1, invaderSpeed: 0.25,
        invaderLimit: 0.7,
        invaderScale: 0.6,
        angle: 0,
        rotationSpeed: 3,

        // Dados da nave
        shipX: 0.0, shipY: -0.75,
        shipSpeed: 0.9,

        // Dados do tiro
        bulletInterval: 0.5,
        timeSinceLastShot: 0,
        bulletSpeed: 1.4,
    }

    let lastTime = performance.now();

    // 10. loop de renderização
    function frame(now){
        const dt = (now - lastTime) / 1000;
        lastTime = now;

        STATE.angle += STATE.rotationSpeed * dt;
        STATE.invaderX += STATE.invaderDir * STATE.invaderSpeed * dt;

        if (STATE.invaderX > STATE.invaderLimit) STATE.invaderDir = -1;
        if (STATE.invaderX < -STATE.invaderLimit) STATE.invaderDir = 1;

        const translationMatrix = createTranslationMatrix(
            STATE.invaderX,
            STATE.invaderY
        );
        
        const rotationMatrix = createRotationMatrix(STATE.angle);
        const scaleMatrix = createScaleMatrix(STATE.invaderScale);
        
        const invaderMatrix = multiplyMatrices(
            translationMatrix,
            multiplyMatrices(rotationMatrix, scaleMatrix)
        );

        gpu.queue.writeBuffer(invaderUniform.bufferUniform, 0, invaderMatrix);

        const textureView = ctx.getCurrentTexture().createView();
        const encondeCommand = gpu.createCommandEncoder();
        const renderPass = encondeCommand.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: {r: 0.1, g: 0.1, b: 0.1, a: 1.0},
                loadOp: "clear",
                storeOp: "store"
            }]
        });

        renderPass.setPipeline(pipeline);
        renderPass.setVertexBuffer(0, invaderBuffer);
        renderPass.setBindGroup(0, invaderUniform.bindGroup)
        renderPass.draw(3);
        renderPass.end();
        gpu.queue.submit([encondeCommand.finish()]);
        requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
}

initWebGPU();