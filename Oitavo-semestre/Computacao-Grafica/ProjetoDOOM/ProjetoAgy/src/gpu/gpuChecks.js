/**
 * Utilitários de criação checada de recursos WebGPU com escopo de validação assíncrona.
 * Não lançam exceção: retornam { ok, value, error, messages, label }.
 */

/**
 * Cria um shader module de forma checada com pushErrorScope e getCompilationInfo.
 * @param {GPUDevice} device
 * @param {GPUShaderModuleDescriptor} descriptor
 * @returns {Promise<{ ok: boolean, value: GPUShaderModule|null, error: Error|null, messages: Array<Object>, label: string }>}
 */
export async function createShaderModuleChecked(device, descriptor) {
    const label = descriptor?.label || '(unlabeled shader)';
    let messages = [];
    let error = null;

    device.pushErrorScope('validation');
    let shaderModule = null;
    try {
        shaderModule = device.createShaderModule(descriptor);
    } catch (e) {
        error = e;
    }
    const validationError = await device.popErrorScope();
    if (validationError) {
        error = validationError;
    }

    if (shaderModule && shaderModule.getCompilationInfo) {
        try {
            const info = await shaderModule.getCompilationInfo();
            messages = info.messages ? Array.from(info.messages) : [];
            const hasError = messages.some((m) => m.type === 'error');
            if (hasError && !error) {
                const first = messages.find((m) => m.type === 'error');
                error = new Error(`Erro de compilação WGSL [${label}] linha ${first.lineNum}:${first.linePos}: ${first.message}`);
            }
        } catch {
            // Suporte opcional a getCompilationInfo em alguns navegadores
        }
    }

    const ok = !error && Boolean(shaderModule);
    return { ok, value: shaderModule, error, messages, label };
}

/**
 * Cria uma render pipeline de forma checada com pushErrorScope.
 * @param {GPUDevice} device
 * @param {GPURenderPipelineDescriptor} descriptor
 * @returns {Promise<{ ok: boolean, value: GPURenderPipeline|null, error: Error|null, label: string }>}
 */
export async function createRenderPipelineChecked(device, descriptor) {
    const label = descriptor?.label || '(unlabeled render pipeline)';
    device.pushErrorScope('validation');
    let pipeline = null;
    let error = null;
    try {
        pipeline = device.createRenderPipeline(descriptor);
    } catch (e) {
        error = e;
    }
    const validationError = await device.popErrorScope();
    if (validationError) {
        error = validationError;
    }

    const ok = !error && Boolean(pipeline);
    return { ok, value: pipeline, error, label };
}

/**
 * Cria uma compute pipeline de forma checada com pushErrorScope.
 * @param {GPUDevice} device
 * @param {GPUComputePipelineDescriptor} descriptor
 * @returns {Promise<{ ok: boolean, value: GPUComputePipeline|null, error: Error|null, label: string }>}
 */
export async function createComputePipelineChecked(device, descriptor) {
    const label = descriptor?.label || '(unlabeled compute pipeline)';
    device.pushErrorScope('validation');
    let pipeline = null;
    let error = null;
    try {
        pipeline = device.createComputePipeline(descriptor);
    } catch (e) {
        error = e;
    }
    const validationError = await device.popErrorScope();
    if (validationError) {
        error = validationError;
    }

    const ok = !error && Boolean(pipeline);
    return { ok, value: pipeline, error, label };
}

/**
 * Cria um bind group layout de forma checada com pushErrorScope.
 * @param {GPUDevice} device
 * @param {GPUBindGroupLayoutDescriptor} descriptor
 * @returns {Promise<{ ok: boolean, value: GPUBindGroupLayout|null, error: Error|null, label: string }>}
 */
export async function createBindGroupLayoutChecked(device, descriptor) {
    const label = descriptor?.label || '(unlabeled bind group layout)';
    device.pushErrorScope('validation');
    let layout = null;
    let error = null;
    try {
        layout = device.createBindGroupLayout(descriptor);
    } catch (e) {
        error = e;
    }
    const validationError = await device.popErrorScope();
    if (validationError) {
        error = validationError;
    }

    const ok = !error && Boolean(layout);
    return { ok, value: layout, error, label };
}

/**
 * Cria um bind group de forma checada com pushErrorScope.
 * @param {GPUDevice} device
 * @param {GPUBindGroupDescriptor} descriptor
 * @returns {Promise<{ ok: boolean, value: GPUBindGroup|null, error: Error|null, label: string }>}
 */
export async function createBindGroupChecked(device, descriptor) {
    const label = descriptor?.label || '(unlabeled bind group)';
    device.pushErrorScope('validation');
    let bindGroup = null;
    let error = null;
    try {
        bindGroup = device.createBindGroup(descriptor);
    } catch (e) {
        error = e;
    }
    const validationError = await device.popErrorScope();
    if (validationError) {
        error = validationError;
    }

    const ok = !error && Boolean(bindGroup);
    return { ok, value: bindGroup, error, label };
}
