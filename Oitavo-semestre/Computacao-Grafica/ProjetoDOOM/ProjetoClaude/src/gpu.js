// Inicialização do WebGPU: adaptador, dispositivo e contexto do canvas.

export async function initWebGPU(canvas) {
  if (!navigator.gpu) {
    throw new Error(
      'Este navegador não suporta WebGPU. Use Chrome ou Edge atualizados ' +
      '(ou habilite WebGPU nas flags do navegador).'
    );
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error('WebGPU existe, mas nenhum adaptador de GPU foi encontrado (driver ou GPU incompatível).');
  }

  // Etapa 15: mais camadas para os sprites (parado, dor, morte, efeitos), até 1024 se o adaptador permitir.
  // Se o pedido for recusado, usa os limites padrão.
  const wantedLayers = Math.min(adapter.limits.maxTextureArrayLayers, 1024);
  let device;
  try {
    device = await adapter.requestDevice({ label: 'dispositivo', requiredLimits: { maxTextureArrayLayers: wantedLayers } });
  } catch (err) {
    console.warn(`WebGPU: requiredLimits recusado (${err.message}); usando os limites padrão`);
    device = await adapter.requestDevice({ label: 'dispositivo' });
  }
  console.log(`WebGPU: maxTextureArrayLayers = ${device.limits.maxTextureArrayLayers} (pedido ${wantedLayers})`);
  device.lost.then((info) => {
    console.error('Dispositivo WebGPU perdido:', info.message);
  });

  const context = canvas.getContext('webgpu');
  // Formato preferido da tela (normalmente bgra8unorm) evita conversões extras.
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'opaque' });

  return { adapter, device, context, format };
}
