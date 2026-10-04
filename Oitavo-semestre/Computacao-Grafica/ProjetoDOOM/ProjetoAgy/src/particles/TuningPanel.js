import { pixelSizeAt, INTERNAL_HEIGHT } from './particleConfig.js';

/**
 * Painel HTML de calibragem em tempo real para os parâmetros de partículas.
 * Exibido à direita da tela sobre o canvas, com estilo monoespaçado verde como o HUD.
 */
export class TuningPanel {
    /**
     * @param {import('./ParticleParams.js').ParticleParams} particleParams
     * @param {import('./ParticleSystem.js').ParticleSystem} particleSystem
     * @param {import('../input/Controls.js').Controls} controls
     * @param {Function} [onCloseCallback]
     */
    constructor(particleParams, particleSystem, controls, onCloseCallback = null) {
        this.particleParams = particleParams;
        this.particleSystem = particleSystem;
        this.controls = controls;
        this.onCloseCallback = onCloseCallback;

        this.isOpen = false;
        this.container = null;
        this._fileHandle = null;
        this._unsubscribe = null;
        this._tableTbody = null;
        this._inputs = new Map(); // id -> { input, valSpan, path }

        this._createDOM();
        this._subscribeParams();
    }

    /**
     * Inscreve-se nas alterações de parâmetros para sincronizar os controles do painel.
     * @private
     */
    _subscribeParams() {
        this._unsubscribe = this.particleParams.subscribe((params) => {
            this._syncInputsFromParams(params);
            this._updateDiagnosticsTable(params);
        });
    }

    /**
     * Cria e anexa a estrutura HTML e estilos do painel.
     * @private
     */
    _createDOM() {
        const div = document.createElement('div');
        div.id = 'particle-tuning-panel';
        div.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            right: 0;
            width: 340px;
            height: 100vh;
            box-sizing: border-box;
            background: rgba(10, 16, 12, 0.94);
            border-left: 2px solid #33ff33;
            color: #33ff33;
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            padding: 14px;
            overflow-y: auto;
            z-index: 1000;
            box-shadow: -4px 0 20px rgba(0, 0, 0, 0.85);
            user-select: none;
        `;

        // Cabeçalho
        const header = document.createElement('div');
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #33ff33; padding-bottom: 8px; margin-bottom: 12px;';
        
        const title = document.createElement('h2');
        title.textContent = 'CALIBRAGEM DE PARTICULAS';
        title.style.cssText = 'font-size: 13px; margin: 0; font-weight: bold; letter-spacing: 1px; color: #55ff55;';
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'FECHAR [ESC]';
        closeBtn.style.cssText = 'background: #113311; border: 1px solid #33ff33; color: #33ff33; font-family: monospace; font-size: 11px; cursor: pointer; padding: 4px 8px;';
        closeBtn.addEventListener('click', () => this.close());

        header.appendChild(title);
        header.appendChild(closeBtn);
        div.appendChild(header);

        // Seção: Quantidade
        div.appendChild(this._createSectionTitle('1. QUANTIDADE & VOLUME'));
        div.appendChild(this._createSlider('count', 'Quantidade', 0, 8192, 10, 'count', true));
        div.appendChild(this._createSlider('emberRatio', 'Razão Brasas', 0, 1, 0.01, 'emberRatio'));
        div.appendChild(this._createSlider('boxHalfXZ', 'Meio-Volume XZ', 128, 1500, 8, 'boxHalfXZ', true));
        div.appendChild(this._createSlider('boxHalfY', 'Meio-Volume Y', 32, 400, 4, 'boxHalfY', true));

        // Seção: Poeira
        div.appendChild(this._createSectionTitle('2. POEIRA'));
        div.appendChild(this._createSlider('dust.size', 'Tamanho Mundo', 0.05, 4, 0.05, 'dust.size'));
        div.appendChild(this._createSlider('dust.lifeMin', 'Vida Mín (s)', 0.2, 60, 0.5, 'dust.lifeMin'));
        div.appendChild(this._createSlider('dust.lifeMax', 'Vida Máx (s)', 0.2, 60, 0.5, 'dust.lifeMax'));
        div.appendChild(this._createSlider('dust.speed', 'Velocidade', 0, 40, 1, 'dust.speed'));
        div.appendChild(this._createSlider('dust.lightnum', 'Lightnum', 0, 15, 1, 'dust.lightnum', true));

        // Seção: Brasas
        div.appendChild(this._createSectionTitle('3. BRASAS'));
        div.appendChild(this._createSlider('ember.size', 'Tamanho Mundo', 0.05, 4, 0.05, 'ember.size'));
        div.appendChild(this._createSlider('ember.lifeMin', 'Vida Mín (s)', 0.2, 60, 0.5, 'ember.lifeMin'));
        div.appendChild(this._createSlider('ember.lifeMax', 'Vida Máx (s)', 0.2, 60, 0.5, 'ember.lifeMax'));
        div.appendChild(this._createSlider('ember.riseMin', 'Subida Mín', 0, 120, 2, 'ember.riseMin'));
        div.appendChild(this._createSlider('ember.riseMax', 'Subida Máx', 0, 120, 2, 'ember.riseMax'));
        div.appendChild(this._createSlider('ember.drift', 'Deriva Lateral', 0, 40, 1, 'ember.drift'));
        div.appendChild(this._createSlider('ember.flickerHz', 'Flicker (Hz)', 0.5, 30, 0.5, 'ember.flickerHz'));

        // Seção: Renderização
        div.appendChild(this._createSectionTitle('4. RENDERIZACAO'));
        div.appendChild(this._createSlider('render.sizeScale', 'Escala Tamanho', 0.25, 4, 0.05, 'render.sizeScale'));
        div.appendChild(this._createSlider('render.minPixels', 'Pixels Mín', 1, 4, 1, 'render.minPixels', true));
        div.appendChild(this._createSlider('render.maxPixels', 'Pixels Máx', 1, 16, 1, 'render.maxPixels', true));
        div.appendChild(this._createSlider('render.fadeFraction', 'Fração de Fade', 0, 0.5, 0.01, 'render.fadeFraction'));
        div.appendChild(this._createCheckbox('render.pixelSnap', 'Alinhar à grade (pixelSnap)', 'render.pixelSnap'));

        // Seção: Cores
        div.appendChild(this._createSectionTitle('5. CORES (RGB / PLAYPAL)'));
        div.appendChild(this._createColorPicker('dust.color', 'Cor Poeira', 'dust.color'));
        div.appendChild(this._createColorPicker('ember.colorHot', 'Cor Brasa Quente', 'ember.colorHot'));
        div.appendChild(this._createColorPicker('ember.colorCool', 'Cor Brasa Fria', 'ember.colorCool'));

        // Seção: Diagnóstico
        div.appendChild(this._createSectionTitle('6. DIAGNOSTICO'));
        div.appendChild(this._createActionCheckbox('freezeParticles', 'Congelar partículas (dt = 0)', (checked) => {
            if (this.particleSystem) this.particleSystem.freeze = checked;
        }));
        div.appendChild(this._createActionCheckbox('disableFade', 'Desligar fade (fade = 1.0)', (checked) => {
            if (this.particleSystem) this.particleSystem.disableFade = checked;
        }));

        const resetParticlesBtn = document.createElement('button');
        resetParticlesBtn.textContent = 'REINICIAR PARTICULAS';
        resetParticlesBtn.style.cssText = 'width: 100%; margin: 8px 0; background: #113311; border: 1px solid #33ff33; color: #33ff33; padding: 6px; font-family: monospace; font-size: 11px; cursor: pointer;';
        resetParticlesBtn.addEventListener('click', () => {
            if (this.particleSystem && this.controls?.camera) {
                this.particleSystem.resetParticles(this.controls.camera.position);
            }
        });
        div.appendChild(resetParticlesBtn);

        // Tabela de profundidades
        div.appendChild(this._createDiagnosticsTable());

        // Seção: Arquivo
        div.appendChild(this._createSectionTitle('7. ARQUIVO & PERSISTENCIA'));
        const fileNotice = document.createElement('div');
        fileNotice.textContent = 'O navegador só grava no disco com permissão do usuário.';
        fileNotice.style.cssText = 'font-size: 10px; color: #88cc88; margin-bottom: 8px; font-style: italic;';
        div.appendChild(fileNotice);

        const btnGrid = document.createElement('div');
        btnGrid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 16px;';

        const saveBtn = this._createBtn('Salvar no arquivo...', () => this.saveToFile());
        const copyBtn = this._createBtn('Copiar JSON', () => this.copyJson());
        const importBtn = this._createBtn('Importar JSON...', () => this.importFilePrompt());
        const restoreFileBtn = this._createBtn('Restaurar do arquivo', async () => {
            try {
                localStorage.removeItem('doomgpu.particles.v1');
            } catch {}
            await this.particleParams.init();
        });
        const restoreDefaultsBtn = this._createBtn('Padrões do código', () => {
            this.particleParams.resetToDefaults();
        });

        btnGrid.appendChild(saveBtn);
        btnGrid.appendChild(copyBtn);
        btnGrid.appendChild(importBtn);
        btnGrid.appendChild(restoreFileBtn);
        btnGrid.appendChild(restoreDefaultsBtn);
        div.appendChild(btnGrid);

        document.body.appendChild(div);
        this.container = div;

        // Inicializa valores com o estado atual
        this._syncInputsFromParams(this.particleParams.get());
        this._updateDiagnosticsTable(this.particleParams.get());
    }

    _createSectionTitle(titleText) {
        const h3 = document.createElement('h3');
        h3.textContent = titleText;
        h3.style.cssText = 'font-size: 11px; margin: 14px 0 6px 0; border-bottom: 1px dashed #225522; padding-bottom: 2px; color: #aaffaa; text-transform: uppercase;';
        return h3;
    }

    _createSlider(id, label, min, max, step, paramPath, isInt = false) {
        const row = document.createElement('div');
        row.style.cssText = 'margin-bottom: 6px;';

        const labelRow = document.createElement('div');
        labelRow.style.cssText = 'display: flex; justify-content: space-between; margin-bottom: 2px;';

        const lbl = document.createElement('span');
        lbl.textContent = label;

        const valSpan = document.createElement('span');
        valSpan.style.cssText = 'color: #ffffff;';

        labelRow.appendChild(lbl);
        labelRow.appendChild(valSpan);
        row.appendChild(labelRow);

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = String(min);
        slider.max = String(max);
        slider.step = String(step);
        slider.style.cssText = 'width: 100%; accent-color: #33ff33; cursor: pointer; margin: 0;';

        slider.addEventListener('input', (e) => {
            const rawVal = parseFloat(e.target.value);
            const val = isInt ? Math.round(rawVal) : rawVal;
            valSpan.textContent = isInt ? String(val) : val.toFixed(step < 0.1 ? 2 : 1);
            this._updateParamByPath(paramPath, val);
        });

        // Libera foco ao soltar o slider para não reter as setas
        const releaseFocus = () => {
            slider.blur();
        };
        slider.addEventListener('pointerup', releaseFocus);
        slider.addEventListener('change', releaseFocus);

        row.appendChild(slider);
        this._inputs.set(id, { input: slider, valSpan, path: paramPath, isInt, step });

        return row;
    }

    _createCheckbox(id, label, paramPath) {
        const row = document.createElement('label');
        row.style.cssText = 'display: flex; align-items: center; gap: 8px; margin: 6px 0; cursor: pointer;';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.style.cssText = 'accent-color: #33ff33; cursor: pointer;';

        checkbox.addEventListener('change', (e) => {
            this._updateParamByPath(paramPath, e.target.checked);
            checkbox.blur();
        });

        const span = document.createElement('span');
        span.textContent = label;

        row.appendChild(checkbox);
        row.appendChild(span);

        this._inputs.set(id, { input: checkbox, path: paramPath, isCheckbox: true });
        return row;
    }

    _createActionCheckbox(id, label, callback) {
        const row = document.createElement('label');
        row.style.cssText = 'display: flex; align-items: center; gap: 8px; margin: 4px 0; cursor: pointer;';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.style.cssText = 'accent-color: #33ff33; cursor: pointer;';

        checkbox.addEventListener('change', (e) => {
            callback(e.target.checked);
            checkbox.blur();
        });

        const span = document.createElement('span');
        span.textContent = label;

        row.appendChild(checkbox);
        row.appendChild(span);
        return row;
    }

    _createColorPicker(id, label, paramPath) {
        const row = document.createElement('div');
        row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;';

        const span = document.createElement('span');
        span.textContent = label;

        const valBox = document.createElement('div');
        valBox.style.cssText = 'display: flex; align-items: center; gap: 6px;';

        const hexLabel = document.createElement('span');
        hexLabel.style.cssText = 'color: #fff; font-size: 11px;';

        const input = document.createElement('input');
        input.type = 'color';
        input.style.cssText = 'width: 32px; height: 22px; padding: 0; border: 1px solid #33ff33; background: transparent; cursor: pointer;';

        input.addEventListener('input', (e) => {
            const hex = e.target.value.toUpperCase();
            hexLabel.textContent = hex;
            this._updateParamByPath(paramPath, hex);
        });

        valBox.appendChild(hexLabel);
        valBox.appendChild(input);
        row.appendChild(span);
        row.appendChild(valBox);

        this._inputs.set(id, { input, hexLabel, path: paramPath, isColor: true });
        return row;
    }

    _createBtn(label, onClick) {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.style.cssText = 'background: #113311; border: 1px solid #33ff33; color: #33ff33; padding: 6px 4px; font-family: monospace; font-size: 10px; cursor: pointer;';
        btn.addEventListener('click', onClick);
        return btn;
    }

    _createDiagnosticsTable() {
        const tableContainer = document.createElement('div');
        tableContainer.style.cssText = 'margin: 8px 0; border: 1px solid #225522; background: rgba(0, 0, 0, 0.4);';

        const table = document.createElement('table');
        table.style.cssText = 'width: 100%; border-collapse: collapse; text-align: right; font-size: 11px;';

        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr style="border-bottom: 1px solid #33ff33; color: #88ff88;">
                <th style="padding: 4px; text-align: left;">Dist (z)</th>
                <th style="padding: 4px;">Poeira (px)</th>
                <th style="padding: 4px;">Brasa (px)</th>
            </tr>
        `;
        table.appendChild(thead);

        this._tableTbody = document.createElement('tbody');
        table.appendChild(this._tableTbody);
        tableContainer.appendChild(table);

        return tableContainer;
    }

    _updateDiagnosticsTable(params) {
        if (!this._tableTbody) return;
        const depths = [16, 32, 64, 128, 256, 512];
        const dustSize = params.dust?.size ?? 0.35;
        const emberSize = params.ember?.size ?? 0.6;
        const height = INTERNAL_HEIGHT;

        let rowsHtml = '';
        for (const z of depths) {
            const dPx = pixelSizeAt(dustSize, z, params, height);
            const ePx = pixelSizeAt(emberSize, z, params, height);
            rowsHtml += `
                <tr style="border-bottom: 1px solid #1a3a1a;">
                    <td style="padding: 3px 4px; text-align: left; color: #88ff88;">${z}</td>
                    <td style="padding: 3px 4px; color: #ffffff;">${dPx} px</td>
                    <td style="padding: 3px 4px; color: #ffaa33;">${ePx} px</td>
                </tr>
            `;
        }
        this._tableTbody.innerHTML = rowsHtml;
    }

    _updateParamByPath(path, value) {
        const parts = path.split('.');
        if (parts.length === 1) {
            this.particleParams.set({ [parts[0]]: value });
        } else if (parts.length === 2) {
            this.particleParams.set({
                [parts[0]]: { [parts[1]]: value },
            });
        }
    }

    _syncInputsFromParams(params) {
        if (!params) return;

        for (const [, entry] of this._inputs.entries()) {
            const parts = entry.path.split('.');
            let val;
            if (parts.length === 1) {
                val = params[parts[0]];
            } else if (parts.length === 2) {
                val = params[parts[0]]?.[parts[1]];
            }

            if (val === undefined) continue;

            if (entry.isCheckbox) {
                entry.input.checked = Boolean(val);
            } else if (entry.isColor) {
                entry.input.value = val;
                if (entry.hexLabel) entry.hexLabel.textContent = val;
            } else {
                entry.input.value = String(val);
                if (entry.valSpan) {
                    entry.valSpan.textContent = entry.isInt ? String(val) : Number(val).toFixed(entry.step < 0.1 ? 2 : 1);
                }
            }
        }
    }

    /**
     * Abre o painel, libera o cursor do mouse e ativa modo de rotação por setas.
     */
    open() {
        if (this.isOpen) return;
        this.isOpen = true;
        this.container.style.display = 'block';

        if (this.controls) {
            this.controls.tuningMode = true;
            this.controls.clearKeys();
        }

        if (document.exitPointerLock) {
            document.exitPointerLock();
        }

        this._syncInputsFromParams(this.particleParams.get());
        this._updateDiagnosticsTable(this.particleParams.get());
    }

    /**
     * Fecha o painel e solicita pointer lock novamente.
     */
    close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.container.style.display = 'none';

        if (this.controls) {
            this.controls.tuningMode = false;
            this.controls.clearKeys();
            this.controls.requestLock();
        }

        if (typeof this.onCloseCallback === 'function') {
            this.onCloseCallback();
        }
    }

    /**
     * Alterna a visibilidade do painel.
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    async saveToFile() {
        const jsonStr = JSON.stringify(this.particleParams.get(), null, 2);
        if ('showSaveFilePicker' in window) {
            try {
                if (!this._fileHandle) {
                    this._fileHandle = await window.showSaveFilePicker({
                        suggestedName: 'particles.json',
                        types: [{
                            description: 'JSON Files',
                            accept: { 'application/json': ['.json'] },
                        }],
                    });
                }
                const writable = await this._fileHandle.createWritable();
                await writable.write(jsonStr);
                await writable.close();
                console.log('[TuningPanel] Arquivo salvo com sucesso via File System Access API.');
                return;
            } catch (err) {
                if (err.name === 'AbortError') return;
                console.warn('[TuningPanel] Erro ao usar showSaveFilePicker. Usando download Blob.', err);
            }
        }

        // Fallback: Download via Blob
        this.particleParams.exportToFile();
    }

    async copyJson() {
        try {
            const jsonStr = JSON.stringify(this.particleParams.get(), null, 2);
            await navigator.clipboard.writeText(jsonStr);
            console.log('[TuningPanel] Configuração copiada para clipboard.');
        } catch (err) {
            console.warn('[TuningPanel] Falha ao copiar para clipboard:', err);
        }
    }

    importFilePrompt() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.style.display = 'none';
        input.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
                const text = await file.text();
                const ok = this.particleParams.importFromFile(text);
                if (ok) {
                    console.log(`[TuningPanel] Parâmetros importados com sucesso de ${file.name}.`);
                }
            } catch (err) {
                console.warn('[TuningPanel] Falha ao ler arquivo selecionado:', err);
            }
        });
        document.body.appendChild(input);
        input.click();
        document.body.removeChild(input);
    }
}
