// Configuração mínima do ESLint (ferramenta de desenvolvimento; não faz parte do jogo).
// Uso: npx --yes eslint@9 .

const browserGlobals = Object.fromEntries([
  'window', 'document', 'navigator', 'console', 'performance', 'fetch', 'localStorage',
  'requestAnimationFrame', 'cancelAnimationFrame', 'URL', 'Blob', 'Event', 'KeyboardEvent', 'MouseEvent',
  'HTMLElement', 'HTMLInputElement', 'Image', 'GPUBufferUsage', 'GPUTextureUsage', 'GPUShaderStage',
  'GPUMapMode', 'GPUColorWrite',
  // Usadas pelo código e ausentes da lista acima:
  'setTimeout', 'clearTimeout', 'ImageData',
  // Etapa 14 (som):
  'AudioContext', 'AudioBuffer', 'GainNode', 'StereoPannerNode', 'AudioBufferSourceNode', 'HTMLCanvasElement',
  'setInterval',
].map((name) => [name, 'readonly']));

export default [
  { ignores: ['src/shaders/external/**'] },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: browserGlobals },
    rules: {
      'no-undef': 'error',
      'no-redeclare': 'error',
      'no-use-before-define': ['error', { variables: true, functions: false }],
      'block-scoped-var': 'error',
      'no-const-assign': 'error',
      'no-unreachable': 'error',
      'no-dupe-keys': 'error',
      'no-unused-vars': 'warn',
    },
  },
  {
    files: ['tools/**/*.mjs', 'tools/**/*.js'],
    languageOptions: { globals: { process: 'readonly' } },
  },
];
