import {
    createShaderModuleChecked,
    createRenderPipelineChecked,
    createComputePipelineChecked,
} from '../src/gpu/gpuChecks.js';
import { shaderCode, getScenePipelineDescriptor } from '../src/shaders.js';
import { blitShaderCode, getBlitPipelineDescriptor } from '../src/blitShader.js';
import { menuShaderCode, getMenuPipelineDescriptor } from '../src/gpu/MenuPass.js';
import { SPRITE_SHADER_WGSL, getSpritePipelineDescriptor } from '../src/gpu/SpriteSet.js';
import {
    getParticleComputePipelineDescriptor,
    getParticleRenderPipelineDescriptor,
} from '../src/particles/ParticleSystem.js';

async function runGpuDiagnostics() {
    const infoContainer = document.getElementById('device-info');
    const shadersTbody = document.getElementById('shaders-tbody');
    const pipelinesTbody = document.getElementById('pipelines-tbody');

    if (!navigator.gpu) {
        infoContainer.innerHTML = '<div class="limit-item" style="border-left-color: #ef5350;"><div class="label">Erro Crítico</div><div class="val">WebGPU não suportado neste navegador.</div></div>';
        return;
    }

    let adapter, device;
    try {
        adapter = await navigator.gpu.requestAdapter();
        if (!adapter) throw new Error('Nenhum adaptador WebGPU disponível.');
        device = await adapter.requestDevice();
    } catch (e) {
        infoContainer.innerHTML = `<div class="limit-item" style="border-left-color: #ef5350;"><div class="label">Erro de Inicialização</div><div class="val">${e.message}</div></div>`;
        return;
    }

    const preferredFormat = navigator.gpu.getPreferredCanvasFormat();
    const limits = device.limits;

    // 1. Exibição dos Limites e Formatos
    const limitsList = [
        { label: 'preferredCanvasFormat', val: preferredFormat },
        { label: 'maxTextureArrayLayers', val: limits.maxTextureArrayLayers },
        { label: 'maxTextureDimension2D', val: limits.maxTextureDimension2D },
        { label: 'maxStorageBuffersPerShaderStage', val: limits.maxStorageBuffersPerShaderStage },
        { label: 'maxBindGroups', val: limits.maxBindGroups },
        { label: 'maxUniformBufferBindingSize', val: `${(limits.maxUniformBufferBindingSize / 1024).toFixed(0)} KB (${limits.maxUniformBufferBindingSize} B)` },
        { label: 'maxStorageBufferBindingSize', val: `${(limits.maxStorageBufferBindingSize / (1024 * 1024)).toFixed(0)} MB (${limits.maxStorageBufferBindingSize} B)` },
    ];

    infoContainer.innerHTML = limitsList.map((item) => `
        <div class="limit-item">
            <div class="label">${item.label}</div>
            <div class="val">${item.val}</div>
        </div>
    `).join('');

    // 2. Carregamento do código de partículas
    let particleShaderCode = '';
    try {
        const resp = await fetch('../src/shaders/particles.wgsl');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        particleShaderCode = await resp.text();
    } catch (err) {
        console.error('Falha ao carregar particles.wgsl para teste:', err);
    }

    // 3. Teste dos Módulos de Shader
    const shaderConfigs = [
        { label: 'scene.shaderModule', code: shaderCode },
        { label: 'display.blitShaderModule', code: blitShaderCode },
        { label: 'menu.shaderModule', code: menuShaderCode },
        { label: 'particles.shaderModule', code: particleShaderCode },
        { label: 'sprites.shaderModule', code: SPRITE_SHADER_WGSL },
    ];

    const shaderResults = new Map();
    const shaderRowsHtml = [];

    for (const conf of shaderConfigs) {
        const res = await createShaderModuleChecked(device, {
            label: conf.label,
            code: conf.code,
        });
        shaderResults.set(conf.label, res);

        let detailsHtml = '';
        if (res.messages && res.messages.length > 0) {
            detailsHtml = res.messages.map((m) => {
                const badgeClass = m.type === 'error' ? 'badge-err' : (m.type === 'warning' ? 'badge-warn' : 'badge-ok');
                return `<div><span class="badge ${badgeClass}">${m.type}</span> Linha ${m.lineNum}:${m.linePos} - ${m.message}</div>`;
            }).join('');
        } else if (res.ok) {
            detailsHtml = '<span style="color:#66bb6a;">Compilação limpa (0 mensagens/erros).</span>';
        }

        if (res.error) {
            detailsHtml += `<div class="msg-pre">${res.error.message}</div>`;
        }

        const statusBadge = res.ok
            ? '<span class="badge badge-ok">OK</span>'
            : '<span class="badge badge-err">ERRO</span>';

        shaderRowsHtml.push(`
            <tr>
                <td><strong>${conf.label}</strong></td>
                <td>${statusBadge}</td>
                <td>${detailsHtml}</td>
            </tr>
        `);
    }

    shadersTbody.innerHTML = shaderRowsHtml.join('');

    // 4. Teste de Criação das Pipelines
    const sceneModule = shaderResults.get('scene.shaderModule')?.value;
    const blitModule = shaderResults.get('display.blitShaderModule')?.value;
    const menuModule = shaderResults.get('menu.shaderModule')?.value;
    const partModule = shaderResults.get('particles.shaderModule')?.value;
    const spriteModule = shaderResults.get('sprites.shaderModule')?.value;

    // Layout para cena 3D
    const sceneBindGroupLayout = device.createBindGroupLayout({
        label: 'scene.diagBindGroupLayout',
        entries: [
            { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
            { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
            { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'uint', viewDimension: '2d-array' } },
            { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'uint', viewDimension: '2d-array' } },
            { binding: 4, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } },
        ],
    });
    const scenePipelineLayout = device.createPipelineLayout({
        label: 'scene.diagPipelineLayout',
        bindGroupLayouts: [sceneBindGroupLayout],
    });

    const pipelineConfigs = [
        {
            label: 'scene.pipelineCullBack',
            type: 'Render',
            tester: () => createRenderPipelineChecked(
                device,
                getScenePipelineDescriptor(sceneModule, scenePipelineLayout, 'back', 'rgba8unorm', 'depth24plus')
            ),
        },
        {
            label: 'scene.pipelineNoCull',
            type: 'Render',
            tester: () => createRenderPipelineChecked(
                device,
                getScenePipelineDescriptor(sceneModule, scenePipelineLayout, 'none', 'rgba8unorm', 'depth24plus')
            ),
        },
        {
            label: 'display.blitPipeline',
            type: 'Render',
            tester: () => createRenderPipelineChecked(
                device,
                getBlitPipelineDescriptor(blitModule, preferredFormat)
            ),
        },
        {
            label: 'menu.pipeline',
            type: 'Render',
            tester: () => createRenderPipelineChecked(
                device,
                getMenuPipelineDescriptor(menuModule, 'auto', 'rgba8unorm')
            ),
        },
        {
            label: 'particles.computePipeline',
            type: 'Compute',
            tester: () => createComputePipelineChecked(
                device,
                getParticleComputePipelineDescriptor(partModule, 'auto')
            ),
        },
        {
            label: 'particles.renderPipeline',
            type: 'Render',
            tester: () => createRenderPipelineChecked(
                device,
                getParticleRenderPipelineDescriptor(partModule, 'auto', 'rgba8unorm', 'depth24plus')
            ),
        },
        {
            label: 'sprites.pipeline',
            type: 'Render',
            tester: () => createRenderPipelineChecked(
                device,
                getSpritePipelineDescriptor(spriteModule, 'rgba8unorm', 'depth24plus')
            ),
        },
    ];

    const pipelineRowsHtml = [];

    for (const conf of pipelineConfigs) {
        const res = await conf.tester();
        const statusBadge = res.ok
            ? '<span class="badge badge-ok">OK</span>'
            : '<span class="badge badge-err">ERRO</span>';

        let detailsHtml = res.ok
            ? '<span style="color:#66bb6a;">Pipeline criada com sucesso (sem erros de validação).</span>'
            : `<div class="msg-pre">${res.error?.message || 'Falha de validação desconhecida'}</div>`;

        pipelineRowsHtml.push(`
            <tr>
                <td><strong>${conf.label}</strong></td>
                <td>${conf.type}</td>
                <td>${statusBadge}</td>
                <td>${detailsHtml}</td>
            </tr>
        `);
    }

    pipelinesTbody.innerHTML = pipelineRowsHtml.join('');
}

window.addEventListener('DOMContentLoaded', runGpuDiagnostics);
