// Criação de módulos de shader com relatório de compilação (getCompilationInfo).
// Aceita vários arquivos concatenados (WGSL não tem #include) e traduz a linha do módulo para
// arquivo:linha nas mensagens.

// parts: [{ name, code }]
export async function createCheckedShaderModule(device, label, parts) {
  const code = parts.map((p) => p.code).join('\n');
  const module = device.createShaderModule({ label, code });

  // Linha inicial de cada parte dentro do módulo concatenado (1-based).
  const starts = [];
  let line = 1;
  for (const p of parts) {
    starts.push({ name: p.name, line });
    line += p.code.split('\n').length;
  }
  const locate = (lineNum) => {
    let part = starts[0];
    for (const s of starts) if (s.line <= lineNum) part = s;
    return `${part.name}:${lineNum - part.line + 1}`;
  };

  const info = await module.getCompilationInfo();
  console.log(`Shader "${label}" (${parts.map((p) => p.name).join(' + ')}): ` +
    `${info.messages.length} mensagem(ns) de compilação`);
  for (const m of info.messages) {
    const where = m.lineNum > 0 ? `${locate(m.lineNum)}:${m.linePos}` : '(sem posição)';
    const text = `[${m.type}] ${where} ${m.message}`;
    if (m.type === 'error') console.error(text);
    else if (m.type === 'warning') console.warn(text);
    else console.log(text);
  }
  return module;
}

export async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`falha ao baixar ${url}: HTTP ${response.status}`);
  return response.text();
}
