// Procura palavras reservadas do WGSL usadas como identificadores. Uso: node tools/check-wgsl-reserved.mjs
// Lê todos os .wgsl do projeto e os trechos de WGSL embutidos em strings de .js/.mjs, remove os
// comentários e compara cada identificador com a lista. Sai com código diferente de zero se houver
// ocorrência nos shaders do projeto. Os originais em src/shaders/external/ (sem modificação, não
// compilados pelo jogo) só geram aviso.
//
// Lista: a fornecida no pedido da etapa 12; NÃO foi conferida contra a seção "Reserved Words" da
// especificação do WGSL (sem acesso a ela nesta verificação).

import fs from 'node:fs';
import path from 'node:path';

const RESERVED = new Set(`NULL Self abstract active alignas alignof as asm asm_fragment async attribute auto await become
binding_array cast catch class co_await co_return co_yield coherent column_major common compile compile_fragment concept
const_cast consteval constexpr constinit crate debugger decltype delete demote demote_to_helper do dynamic_cast enum
explicit export extends extern external fallthrough filter final finally friend from fxgroup get goto groupshared highp
impl implements import inline instanceof interface layout lowp macro macro_rules match mediump meta mod module move mut
mutable namespace new nil noexcept noinline nointerpolation noperspective null nullptr of operator package packoffset
partition pass patch pixelfragment precise precision premerge priv protected pub public readonly ref regardless register
reinterpret_cast require resource restrict self set shared sizeof smooth snorm static static_assert static_cast std
subroutine super target template this thread_local throw trait try type typedef typeid typename typeof union unless
unorm unsafe unsized use using varying virtual volatile wgsl where with writeonly yield`.split(/\s+/));

const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const SKIP_DIRS = new Set(['node_modules', '.git']);
const EXTERNAL = path.join('src', 'shaders', 'external');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

// Remove comentários (// e /* */, que no WGSL podem ser aninhados) preservando as quebras de linha.
function stripComments(code) {
  let out = '';
  let depth = 0;
  for (let i = 0; i < code.length; i++) {
    const two = code.slice(i, i + 2);
    if (depth === 0 && two === '//') {
      while (i < code.length && code[i] !== '\n') i++;
      out += '\n';
      continue;
    }
    if (two === '/*') { depth++; i++; continue; }
    if (depth > 0 && two === '*/') { depth--; i++; continue; }
    if (depth > 0) { if (code[i] === '\n') out += '\n'; continue; }
    out += code[i];
  }
  return out;
}

function scan(code, file, startLine, hits) {
  stripComments(code).split('\n').forEach((text, i) => {
    for (const m of text.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) {
      if (RESERVED.has(m[0])) hits.push({ file, line: startLine + i, id: m[0] });
    }
  });
}

const files = walk(ROOT);
const rel = (f) => path.relative(ROOT, f);
const hits = [];

const wgslFiles = files.filter((f) => f.endsWith('.wgsl'));
for (const f of wgslFiles) scan(fs.readFileSync(f, 'utf8'), rel(f), 1, hits);

// WGSL embutido em strings de JavaScript: literais (crase ou aspas) com marcas de WGSL.
const WGSL_MARK = /@(vertex|fragment|compute|group|binding)\b|\bfn\s+\w+\s*\(/;
const embedding = [];
for (const f of files.filter((x) => /\.(m?js)$/.test(x) && !rel(x).startsWith(`tools${path.sep}check-wgsl-reserved`))) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/`[^`]*`|'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g)) {
    if (!WGSL_MARK.test(m[0])) continue;
    const line = src.slice(0, m.index).split('\n').length;
    embedding.push(`${rel(f)}:${line}`);
    scan(m[0].slice(1, -1), rel(f), line, hits);
  }
}

console.log(`Arquivos .wgsl lidos (${wgslFiles.length}): ${wgslFiles.map(rel).join(', ')}`);
console.log(`Arquivos .js/.mjs com WGSL embutido em strings: ${embedding.length ? embedding.join(', ') : 'nenhum'}`);
console.log('Aviso: lista de palavras reservadas não conferida contra a especificação do WGSL (lista do pedido).');

let errors = 0;
for (const h of hits) {
  const external = h.file.startsWith(EXTERNAL);
  console.log(`${external ? 'aviso (original externo)' : 'ERRO'}  ${h.file}:${h.line}  ${h.id}`);
  if (!external) errors++;
}
console.log(errors ? `${errors} ocorrência(s) nos shaders do projeto` : 'Nenhuma palavra reservada nos shaders do projeto');
process.exit(errors ? 1 : 0);
