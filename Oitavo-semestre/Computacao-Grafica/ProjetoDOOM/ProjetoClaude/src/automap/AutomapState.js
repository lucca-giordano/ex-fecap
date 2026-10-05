// Estado do automapa (etapa 22), só da sessão. Puro. Escala em pixels da camada de 320x200 por unidade
// do Doom; centro em coordenadas do Doom. Como o am_map.c do Doom, sem marcadores e sem rotação.

export const AM_WIDTH = 320;
export const AM_HEIGHT = 168;       // região acima da barra de status (linhas 0 a 167)
export const ZOOM_STEP = 1.02;      // por tic com + ou - pressionado
export const PAN_PIXELS = 4;        // pixels de tela por tic com as setas (follow desligado)
export const MIN_VIEW_UNITS = 32;   // maxScale = 168 / 32

export class AutomapState {
  // map: mapa (vértices para a caixa; linedefs para o tamanho de mapped).
  constructor(map) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const v of map.vertexes) {
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    }
    this.box = { minX, maxX, minY, maxY };
    this.minScale = Math.min(AM_WIDTH / Math.max(1, maxX - minX), AM_HEIGHT / Math.max(1, maxY - minY));
    this.maxScale = AM_HEIGHT / MIN_VIEW_UNITS;
    this.lineCount = map.linedefs.length;
    this.reset();
  }

  // NEW GAME, reinício por morte e RESET MONSTERS.
  reset() {
    this.visible = false;
    this.follow = true;
    this.grid = false;
    this.cheat = 0;          // IDDT: 0, 1 (todas as linhas), 2 (e as coisas)
    this.bigMode = false;    // Digit0: mapa inteiro
    this.saved = null;
    this.mapped = new Uint8Array(this.lineCount);
    this.allmap = false;     // reservado para o poder "mapa de computador"
    this.scale = this.clampScale(this.minScale / 0.7);
    this.centerX = (this.box.minX + this.box.maxX) / 2;
    this.centerY = (this.box.minY + this.box.maxY) / 2;
  }

  clampScale(s) {
    return Math.min(this.maxScale, Math.max(this.minScale, s));
  }

  mappedCount() {
    let n = 0;
    for (const v of this.mapped) n += v;
    return n;
  }

  cycleCheat() {
    this.cheat = (this.cheat + 1) % 3;
    return this.cheat;
  }

  // Digit0: mapa inteiro (escala mínima, centralizado, follow desligado) <-> estado anterior.
  toggleBigMode() {
    if (!this.bigMode) {
      this.saved = { scale: this.scale, centerX: this.centerX, centerY: this.centerY, follow: this.follow };
      this.scale = this.minScale;
      this.centerX = (this.box.minX + this.box.maxX) / 2;
      this.centerY = (this.box.minY + this.box.maxY) / 2;
      this.follow = false;
      this.bigMode = true;
    } else {
      Object.assign(this, this.saved);
      this.bigMode = false;
    }
  }

  // Um tic: zoom contínuo, seguir o jogador ou mover com as setas (limitado à caixa do mapa).
  // input: { zoomIn, zoomOut, panX (-1..1), panY (-1..1) }; player: { x, y }.
  tick(input, player) {
    if (input.zoomIn) this.scale = this.clampScale(this.scale * ZOOM_STEP);
    if (input.zoomOut) this.scale = this.clampScale(this.scale / ZOOM_STEP);
    if (this.follow) {
      this.centerX = player.x;
      this.centerY = player.y;
    } else if (input.panX || input.panY) {
      const step = PAN_PIXELS / this.scale;
      this.centerX = Math.min(this.box.maxX, Math.max(this.box.minX, this.centerX + (input.panX ?? 0) * step));
      this.centerY = Math.min(this.box.maxY, Math.max(this.box.minY, this.centerY + (input.panY ?? 0) * step));
    }
  }

  // Projeção: tela = (160 + (x - centroX) * escala, 84 - (y - centroY) * escala); o y do Doom sobe.
  toScreen(x, y) {
    return [Math.round(AM_WIDTH / 2 + (x - this.centerX) * this.scale), Math.round(AM_HEIGHT / 2 - (y - this.centerY) * this.scale)];
  }
}
