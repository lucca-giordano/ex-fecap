// Quadro vermelho com o primeiro erro (desenvolvimento). Os erros também vão para o console.

export const SHOW_ERROR_OVERLAY = true;
const STACK_LINES = 15;

let box = null;
let extra = 0;

// Primeira linha do stack com "arquivo:linha:coluna".
function locationFromStack(stack) {
  const m = /(\S+?):(\d+):(\d+)\)?\s*$/m.exec(stack ?? '');
  return m ? `${m[1]}:${m[2]}:${m[3]}` : '(posição desconhecida)';
}

export function reportError(error, where) {
  console.error(error);
  const loading = document.getElementById('loading');
  if (loading && loading.style.display !== 'none') loading.textContent = 'Falha ao iniciar';
  if (!SHOW_ERROR_OVERLAY) return;

  if (box) {
    // Só o primeiro erro fica fixo; os seguintes viram contador.
    extra++;
    box.querySelector('.count').textContent = `+${extra} erros`;
    return;
  }
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const stack = error instanceof Error && error.stack ? error.stack.split('\n').slice(0, STACK_LINES).join('\n') : '';
  box = document.createElement('pre');
  box.id = 'errorOverlay';
  box.textContent = `${message}\n${where ?? locationFromStack(stack)}\n\n${stack}`;
  const count = document.createElement('div');
  count.className = 'count';
  box.prepend(count);
  document.body.append(box);
}

// Erros não tratados e promises rejeitadas sem catch.
export function installErrorOverlay() {
  window.addEventListener('error', (e) => {
    const where = e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : undefined;
    reportError(e.error ?? e.message, where);
  });
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason));
}
