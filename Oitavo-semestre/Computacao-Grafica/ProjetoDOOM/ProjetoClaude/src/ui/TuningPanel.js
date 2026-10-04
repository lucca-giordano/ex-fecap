// Painel HTML de calibragem das partículas. Os controles são gerados a partir de PARAM_FIELDS e
// alteram os parâmetros na hora (ParticleParams). Diagnóstico (congelar, sem fade) vale só na sessão.

import { PARAM_FIELDS, pixelSizeAt } from '../particles/particleConfig.js';

const TABLE_DEPTHS = [16, 32, 64, 128, 256, 512];

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else e.setAttribute(k, v);
  }
  e.append(...children);
  return e;
}

export class TuningPanel {
  // params: ParticleParams; getInternalHeight(): altura atual da imagem interna.
  // onClose(): fechar (botão); onRestart(): reiniciar partículas.
  constructor(root, params, { getInternalHeight, onClose, onRestart }) {
    this.root = root;
    this.params = params;
    this.getInternalHeight = getInternalHeight;
    this.diagnostics = { freeze: false, noFade: false };
    this.fileHandle = null; // handle do showSaveFilePicker, reaproveitado na sessão
    this.inputs = new Map(); // path -> { input, value }
    this.build(onClose, onRestart);
    params.subscribe(() => this.refresh());
    this.refresh();
  }

  get isOpen() {
    return this.root.style.display !== 'none';
  }

  show() { this.root.style.display = ''; this.refresh(); }
  hide() { this.root.style.display = 'none'; }

  build(onClose, onRestart) {
    const root = this.root;
    root.replaceChildren();
    const closeBtn = el('button', {}, 'Fechar (T / Esc)');
    closeBtn.addEventListener('click', () => onClose());
    root.append(el('div', { class: 'tuning-head' }, el('b', {}, 'Calibragem das partículas'), closeBtn));

    // Seções na ordem da tabela de campos.
    const sections = new Map();
    for (const f of PARAM_FIELDS) {
      if (!sections.has(f.section)) {
        const box = el('fieldset', {}, el('legend', {}, f.section));
        sections.set(f.section, box);
        root.append(box);
      }
      sections.get(f.section).append(this.buildField(f));
    }

    // Diagnóstico (sessão, fora do JSON) e tabela de tamanhos.
    const diag = el('fieldset', {}, el('legend', {}, 'Diagnóstico'));
    for (const [key, label] of [['freeze', 'Congelar partículas'], ['noFade', 'Desligar fade']]) {
      const cb = el('input', { type: 'checkbox' });
      cb.addEventListener('change', () => { this.diagnostics[key] = cb.checked; cb.blur(); });
      diag.append(el('label', { class: 'row' }, cb, ` ${label}`));
    }
    this.sizeTable = el('table');
    diag.append(el('div', {}, 'Tamanho em pixels (imagem interna):'), this.sizeTable);
    const restart = el('button', {}, 'Reiniciar partículas');
    restart.addEventListener('click', () => { onRestart(); restart.blur(); });
    diag.append(restart);
    root.append(diag);

    // Arquivo.
    const file = el('fieldset', {}, el('legend', {}, 'Arquivo'));
    file.append(el('div', { class: 'note' },
      'O navegador só grava no disco com sua permissão. As mudanças ficam no localStorage; ' +
      'use "Salvar no arquivo..." para gerar o config/particles.json.'));
    const importInput = el('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
    importInput.addEventListener('change', () => this.importFile(importInput));
    const buttons = [
      ['Salvar no arquivo...', () => this.saveToFile()],
      ['Copiar JSON', () => this.copyJson()],
      ['Importar JSON...', () => importInput.click()],
      ['Restaurar do arquivo', async () => { await this.params.restoreFromFile(); this.status('Restaurado de config/particles.json'); }],
      ['Restaurar padrões do código', () => { this.params.restoreDefaults(); this.status('Padrões do código restaurados'); }],
    ];
    for (const [label, action] of buttons) {
      const b = el('button', {}, label);
      b.addEventListener('click', () => { b.blur(); action(); });
      file.append(b);
    }
    this.statusLine = el('div', { class: 'note' });
    file.append(importInput, this.statusLine);
    root.append(file);
  }

  buildField(f) {
    if (f.type === 'bool') {
      const input = el('input', { type: 'checkbox' });
      input.addEventListener('change', () => { this.params.set(f.path, input.checked); input.blur(); });
      this.inputs.set(f.path, { input });
      return el('label', { class: 'row' }, input, ` ${f.label}`);
    }
    if (f.type === 'color') {
      const input = el('input', { type: 'color' });
      input.addEventListener('input', () => this.params.set(f.path, input.value.toUpperCase()));
      input.addEventListener('change', () => input.blur());
      this.inputs.set(f.path, { input });
      return el('label', { class: 'row' }, input, ` ${f.label}`);
    }
    const input = el('input', { type: 'range', min: f.min, max: f.max, step: f.step });
    const value = el('span', { class: 'value' });
    input.addEventListener('input', () => this.params.set(f.path, Number(input.value)));
    // Soltar o slider devolve o teclado ao jogo (as setas não mexem mais no slider).
    input.addEventListener('pointerup', () => input.blur());
    input.addEventListener('change', () => input.blur());
    this.inputs.set(f.path, { input, value });
    return el('label', { class: 'row' }, el('span', { class: 'name' }, f.label), input, value);
  }

  // Atualiza os controles e a tabela a partir dos parâmetros atuais.
  refresh() {
    const p = this.params.get();
    for (const f of PARAM_FIELDS) {
      const { input, value } = this.inputs.get(f.path);
      const v = this.params.get(f.path);
      if (f.type === 'bool') input.checked = v;
      else if (f.type === 'color') input.value = v.toLowerCase();
      else {
        if (document.activeElement !== input) input.value = String(v);
        value.textContent = Number.isInteger(v) ? String(v) : v.toFixed(2);
      }
    }
    const H = this.getInternalHeight();
    const row = (name, size) => el('tr', {}, el('td', {}, name),
      ...TABLE_DEPTHS.map((d) => el('td', {}, String(pixelSizeAt(size, d, p, H)))));
    this.sizeTable.replaceChildren(
      el('tr', {}, el('th', {}, 'prof.'), ...TABLE_DEPTHS.map((d) => el('th', {}, String(d)))),
      row('poeira', p.dust.size),
      row('brasa', p.ember.size),
    );
  }

  status(text) {
    this.statusLine.textContent = text;
  }

  async saveToFile() {
    const text = this.params.toJSON();
    if (window.showSaveFilePicker) {
      try {
        if (!this.fileHandle) {
          this.fileHandle = await window.showSaveFilePicker({
            suggestedName: 'particles.json',
            types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
          });
        }
        const writable = await this.fileHandle.createWritable();
        await writable.write(text);
        await writable.close();
        this.status(`Salvo em ${this.fileHandle.name}`);
        return;
      } catch (err) {
        // Cancelado ou recusado: cai no download.
        console.warn('Partículas: seletor de arquivo indisponível ou cancelado:', err.message);
        if (err.name !== 'AbortError') this.fileHandle = null;
      }
    }
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = el('a', { href: url, download: 'particles.json' });
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    this.status('Baixado como particles.json');
  }

  async copyJson() {
    try {
      await navigator.clipboard.writeText(this.params.toJSON());
      this.status('JSON copiado');
    } catch (err) {
      this.status(`Falha ao copiar: ${err.message}`);
    }
  }

  async importFile(input) {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    try {
      this.params.replace(JSON.parse(await file.text()));
      this.status(`Importado: ${file.name}`);
    } catch (err) {
      this.status(`JSON inválido: ${err.message}`);
      console.warn('Partículas: importação falhou:', err);
    }
  }
}
