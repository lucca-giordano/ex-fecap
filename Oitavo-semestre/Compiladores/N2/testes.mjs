// Roda os casos de teste no terminal: node testes.mjs
import { analisarLexico } from "./lexer.js";
import { analisarSintatico } from "./parser.js";
import { casos } from "./casos.js";

// Executa as duas fases como a página: se houver erro léxico, o parser não roda.
export function executar(programa) {
    const { tokens, erros } = analisarLexico(programa);
    if (erros.length > 0) {
        return { errosLexicos: erros };
    }
    try {
        return { ast: analisarSintatico(tokens) };
    } catch (e) {
        return { erroSintatico: { linha: e.linha, esperado: e.esperado, encontrado: e.encontrado } };
    }
}

// Casos extras, além dos 8 oficiais, para as decisões de projeto.
const extras = [
    ["palavra-chave não quebra palavra maior", "tela 1 por 1\nretas (0, 0) (1, 1)",
        { errosLexicos: [{ linha: 2, lexema: "retas" }] }],
    ["reta não casa com o começo de retangulo", "tela 1 por 1\nretangulo (0, 0) 1 por 1",
        { ast: { tipo: "programa", tela: { tipo: "tela", largura: 1, altura: 1 },
            itens: [{ tipo: "retangulo", x: 0, y: 0, largura: 1, altura: 1, estilo: {} }] } }],
    ["zeros à esquerda e hexadecimal curto", "tela 00 por 007\n#fff",
        { errosLexicos: [{ linha: 1, lexema: "00" }, { linha: 1, lexema: "007" }, { linha: 2, lexema: "#fff" }] }],
    ["# não é comentário", "tela 1 por 1\n# comentario",
        { errosLexicos: [{ linha: 2, lexema: "#" }, { linha: 2, lexema: "comentario" }] }],
    ["barra simples não é comentário", "tela 1 por 1 / x",
        { errosLexicos: [{ linha: 1, lexema: "/" }, { linha: 1, lexema: "x" }] }],
    ["comentário com # e cor no meio", "tela 1 por 1 // #FF0000 azul {",
        { ast: { tipo: "programa", tela: { tipo: "tela", largura: 1, altura: 1 }, itens: [] } }],
    ["atributo repetido", "tela 1 por 1\nreta (0, 0) (1, 1) com traco azul espessura 2 traco verde",
        { erroSintatico: { linha: 2, esperado: "PREENCHIMENTO ou o fim da forma (TRACO repetido)", encontrado: 'TRACO "traco"' } }],
    ["com sem atributo", "tela 1 por 1\nreta (0, 0) (1, 1) com",
        { erroSintatico: { linha: 2, esperado: "TRACO, PREENCHIMENTO ou ESPESSURA", encontrado: "o fim do programa" } }],
    ["programa sem tela", "reta (0, 0) (1, 1)",
        { erroSintatico: { linha: 1, esperado: "TELA", encontrado: 'RETA "reta"' } }],
    ["programa vazio", "// nada",
        { erroSintatico: { linha: 1, esperado: "TELA", encontrado: "o fim do programa" } }],
    ["segunda tela", "tela 1 por 1\ntela 2 por 2",
        { erroSintatico: { linha: 2, esperado: "RETA, CIRCULO, RETANGULO, GRUPO ou o fim do programa", encontrado: 'TELA "tela"' } }],
    ["deslocamento sem parênteses", "tela 1 por 1\ngrupo desloca 1 2 { }",
        { erroSintatico: { linha: 2, esperado: "ABRE_PAR", encontrado: 'NUM "1"' } }],
    ["grupo sem chave", "tela 1 por 1\ngrupo rotaciona 5 reta (0, 0) (1, 1)",
        { erroSintatico: { linha: 2, esperado: "ROTACIONA, DESLOCA ou ABRE_CHAVE", encontrado: 'RETA "reta"' } }],
    ["estilo em grupo", "tela 1 por 1\ngrupo { } com traco azul",
        { erroSintatico: { linha: 2, esperado: "RETA, CIRCULO, RETANGULO, GRUPO ou o fim do programa", encontrado: 'COM "com"' } }],
    ["chave a mais", "tela 1 por 1\ngrupo { }\n}",
        { erroSintatico: { linha: 3, esperado: "RETA, CIRCULO, RETANGULO, GRUPO ou o fim do programa", encontrado: 'FECHA_CHAVE "}"' } }],
];

let falhas = 0;
function conferir(nome, programa, esperado) {
    const obtido = executar(programa);
    const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
    console.log((ok ? "ok    " : "FALHOU") + "  " + nome);
    if (!ok) {
        falhas = falhas + 1;
        console.log("  esperado: " + JSON.stringify(esperado));
        console.log("  obtido:   " + JSON.stringify(obtido));
    }
}

for (const caso of casos) {
    conferir(caso.nome, caso.programa, caso.esperado);
}
for (const [nome, programa, esperado] of extras) {
    conferir("extra · " + nome, programa, esperado);
}
console.log(falhas === 0 ? "\nTodos os testes passaram." : "\n" + falhas + " teste(s) falharam.");
process.exitCode = falhas === 0 ? 0 : 1;
