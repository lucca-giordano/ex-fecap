// Cache de decodificação de texturas entre níveis (etapa 23). Puro.
// Guarda PNAMES e TEXTURE1/2 lidos uma vez, patches decodificados, texturas de parede montadas e flats.
// Os dados ficam na CPU; cada nível monta os seus texture arrays a partir daqui.

export class TextureCache {
  constructor() {
    this.pnames = null;
    this.defs = null;
    this.patches = new Map(); // índice do PNAMES -> imagem decodificada (ou null)
    this.walls = new Map();   // nome -> { texture, holes, badRefs }
    this.flats = new Map();   // nome -> bytes 64x64
  }

  // Existe uma textura de parede com esse nome no WAD? (precisa de um loadTextures antes)
  hasWall(name) {
    return Boolean(this.defs?.has(name));
  }
}
