// Layout de vértice compartilhado por paredes e flats (14 palavras de 4 bytes = 56 bytes):
//   posição (3 f32), normal (3 f32), cor (3 f32, modo sólido), uv (2 f32), layer (u32), kind (u32),
//   lightnum (u32, 0..15: luz do setor / 16, já com o contraste das paredes)

export const WORDS_PER_VERTEX = 14;
export const VERTEX_STRIDE = WORDS_PER_VERTEX * 4;

export const NO_TEXTURE = 0xFFFFFFFF; // layer sem textura (nome "-")
export const KIND = { wall: 0, flat: 1, sky: 2 };

// Atributos para o pipeline (shaderLocation 0..6).
export const VERTEX_ATTRIBUTES = [
  { shaderLocation: 0, offset: 0, format: 'float32x3' },  // posição
  { shaderLocation: 1, offset: 12, format: 'float32x3' }, // normal
  { shaderLocation: 2, offset: 24, format: 'float32x3' }, // cor
  { shaderLocation: 3, offset: 36, format: 'float32x2' }, // uv (em texels, não normalizado)
  { shaderLocation: 4, offset: 44, format: 'uint32' },    // layer
  { shaderLocation: 5, offset: 48, format: 'uint32' },    // kind
  { shaderLocation: 6, offset: 52, format: 'uint32' },    // lightnum
];

// Recebe uma lista de vértices { pos, normal, color, uv, layer, kind, light } e empacota num
// ArrayBuffer com duas views sobre os mesmos bytes: floats para os 11 primeiros campos, uint32 para os 3 últimos.
export function packVertices(list) {
  const buffer = new ArrayBuffer(list.length * VERTEX_STRIDE);
  const f32 = new Float32Array(buffer);
  const u32 = new Uint32Array(buffer);
  list.forEach((v, i) => {
    const o = i * WORDS_PER_VERTEX;
    f32.set(v.pos, o);
    f32.set(v.normal, o + 3);
    f32.set(v.color, o + 6);
    f32.set(v.uv, o + 9);
    u32[o + 11] = v.layer;
    u32[o + 12] = v.kind;
    u32[o + 13] = v.light;
  });
  return f32;
}
