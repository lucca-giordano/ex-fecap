import fs from 'fs';

// Lista oficial de palavras reservadas do WGSL conforme especificação W3C (seção "Reserved Words")
const RESERVED_WORDS = new Set([
    'NULL', 'Self', 'abstract', 'active', 'alignas', 'alignof', 'as', 'asm', 'asm_fragment',
    'async', 'attribute', 'auto', 'await', 'become', 'binding_array', 'cast', 'catch', 'class',
    'co_await', 'co_return', 'co_yield', 'coherent', 'column_major', 'common', 'compile',
    'compile_fragment', 'concept', 'const_cast', 'consteval', 'constexpr', 'constinit', 'crate',
    'debugger', 'decltype', 'delete', 'demote', 'demote_to_helper', 'do', 'dynamic_cast',
    'enum', 'explicit', 'export', 'extends', 'extern', 'external', 'fallthrough', 'filter',
    'final', 'finally', 'friend', 'from', 'fxgroup', 'get', 'goto', 'groupshared', 'highp',
    'impl', 'implements', 'import', 'inline', 'instanceof', 'interface', 'layout', 'lowp',
    'macro', 'macro_rules', 'match', 'mediump', 'meta', 'mod', 'module', 'move', 'mut',
    'mutable', 'namespace', 'new', 'nil', 'noexcept', 'noinline', 'nointerpolation',
    'noperspective', 'null', 'nullptr', 'of', 'operator', 'package', 'packoffset', 'partition',
    'pass', 'patch', 'pixelfragment', 'precise', 'precision', 'premerge', 'priv', 'protected',
    'pub', 'public', 'readonly', 'ref', 'regardless', 'register', 'reinterpret_cast', 'require',
    'resource', 'restrict', 'self', 'set', 'shared', 'sizeof', 'smooth', 'snorm', 'static',
    'static_assert', 'static_cast', 'std', 'subroutine', 'super', 'target', 'template', 'this',
    'thread_local', 'throw', 'trait', 'try', 'type', 'typedef', 'typeid', 'typename', 'typeof',
    'union', 'unless', 'unorm', 'unsafe', 'unsized', 'use', 'using', 'varying', 'virtual',
    'volatile', 'wgsl', 'where', 'with', 'writeonly', 'yield',
]);

const WGSL_SOURCES = [
    { file: 'src/shaders/particles.wgsl', isStandalone: true },
    { file: 'src/shaders.js', varName: 'shaderCode' },
    { file: 'src/blitShader.js', varName: 'blitShaderCode' },
    { file: 'src/gpu/MenuPass.js', varName: 'menuShaderCode' },
    { file: 'src/gpu/SpriteSet.js', varName: 'SPRITE_SHADER_WGSL' },
];

function extractWgsl(sourceInfo) {
    const raw = fs.readFileSync(sourceInfo.file, 'utf8');
    if (sourceInfo.isStandalone) {
        return { code: raw, startLine: 1 };
    }
    const idx = raw.indexOf(sourceInfo.varName);
    if (idx === -1) {
        throw new Error(`Variável ${sourceInfo.varName} não encontrada em ${sourceInfo.file}`);
    }
    const tick1 = raw.indexOf('`', idx);
    const tick2 = raw.indexOf('`', tick1 + 1);
    const code = raw.slice(tick1 + 1, tick2);
    const startLine = raw.slice(0, tick1 + 1).split('\n').length;
    return { code, startLine };
}

let totalFound = 0;

console.log('Verificando identificadores reservados do WGSL no projeto...\n');

for (const src of WGSL_SOURCES) {
    if (!fs.existsSync(src.file)) continue;
    const { code, startLine } = extractWgsl(src);
    const lines = code.split('\n');

    let inBlockComment = false;

    lines.forEach((line, lineIdx) => {
        const actualLineNumber = startLine + lineIdx;
        let lineClean = '';

        for (let i = 0; i < line.length; i++) {
            if (!inBlockComment && line[i] === '/' && line[i + 1] === '*') {
                inBlockComment = true;
                i++;
            } else if (inBlockComment && line[i] === '*' && line[i + 1] === '/') {
                inBlockComment = false;
                i++;
            } else if (!inBlockComment && line[i] === '/' && line[i + 1] === '/') {
                break; // Fim da linha (comentário de linha única)
            } else if (!inBlockComment) {
                lineClean += line[i];
            }
        }

        const tokens = lineClean.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
        for (const tok of tokens) {
            if (RESERVED_WORDS.has(tok)) {
                console.error(`  [RESERVADO] ${src.file}:${actualLineNumber} -> "${tok}"`);
                console.error(`    Linha: ${line.trim()}`);
                totalFound++;
            }
        }
    });
}

if (totalFound > 0) {
    console.error(`\nFalha: ${totalFound} identificador(es) reservado(s) encontrado(s) no WGSL.`);
    process.exit(1);
} else {
    console.log('Sucesso: 0 palavras reservadas encontradas em todos os shaders WGSL.');
    process.exit(0);
}
