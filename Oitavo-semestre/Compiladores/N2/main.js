import { analisarLexico } from "./lexer.js";
import { analisarSintatico } from "./parser.js";
import { paraMermaid } from "./geradorMermaid.js";
import { casos } from "./casos.js";

const entrada = document.getElementById("entrada");
const seletor = document.getElementById("exemplos");
const veredito = document.getElementById("veredito");
const conferencia = document.getElementById("conferencia");
const corpoTokens = document.getElementById("tokens");
const contagem = document.getElementById("contagem");
const astJson = document.getElementById("ast-json");
const astArvore = document.getElementById("ast-arvore");
const blocoAst = document.getElementById("bloco-ast");

let casoAtual = null;
// caso de teste carregado no editor (null se o texto foi digitado)

// ---------- menu de exemplos ----------

for (let k = 0; k < casos.length; k++) {
    const opcao = document.createElement("option");
    opcao.value = String(k);
    opcao.textContent = casos[k].nome;
    seletor.append(opcao);
}

function carregarCaso(k) {
    casoAtual = casos[k];
    seletor.value = String(k);
    entrada.value = casoAtual.programa;
    analisar();
}

seletor.addEventListener("change", () => {
    if (seletor.value !== "") carregarCaso(Number(seletor.value));
});

entrada.addEventListener("input", () => {
    // o texto mudou: não é mais o caso de teste original
    if (casoAtual !== null && entrada.value !== casoAtual.programa) {
        casoAtual = null;
        seletor.value = "";
    }
});

// ---------- análise ----------

function analisar() {
    const texto = entrada.value;
    const { tokens, erros } = analisarLexico(texto);
    mostrarTokens(tokens);

    let resultado;
    if (erros.length > 0) {
        // erro léxico: a análise sintática não roda
        resultado = { errosLexicos: erros };
    } else {
        try {
            resultado = { ast: analisarSintatico(tokens) };
        } catch (falha) {
            resultado = {
                erroSintatico: { linha: falha.linha, esperado: falha.esperado, encontrado: falha.encontrado }
            };
        }
    }

    mostrarVeredito(resultado);
    mostrarAst(resultado.ast);
    mostrarConferencia(resultado);
}

function celula(texto, classe) {
    const td = document.createElement("td");
    td.textContent = texto;
    if (classe) td.className = classe;
    return td;
}

function mostrarTokens(tokens) {
    corpoTokens.replaceChildren();
    for (const token of tokens) {
        const tr = document.createElement("tr");
        tr.append(
            celula(String(token.linha), "num"),
            celula(token.tipo, "tipo"),
            celula('"' + token.lexema + '"', "lexema"));
        corpoTokens.append(tr);
    }
    if (tokens.length === 0) {
        const tr = document.createElement("tr");
        const td = celula("nenhum token reconhecido", "vazio");
        td.colSpan = 3;
        tr.append(td);
        corpoTokens.append(tr);
    }
    contagem.textContent = tokens.length + (tokens.length === 1 ? " token" : " tokens");
}

function linhaDeErro(rotulo, valor) {
    const div = document.createElement("div");
    div.className = "detalhe";
    const dt = document.createElement("span");
    dt.className = "rotulo";
    dt.textContent = rotulo;
    const dd = document.createElement("code");
    dd.textContent = valor;
    div.append(dt, dd);
    return div;
}

function mostrarVeredito(resultado) {
    veredito.replaceChildren();
    const titulo = document.createElement("p");
    titulo.className = "titulo-veredito";

    if (resultado.ast) {
        veredito.dataset.estado = "ok";
        titulo.textContent = "Programa válido";
        const resumo = document.createElement("p");
        resumo.className = "resumo";
        resumo.textContent = "Tela " + resultado.ast.tela.largura + " × " + resultado.ast.tela.altura +
            " com " + contarNos(resultado.ast.itens) + ". A AST está abaixo.";
        veredito.append(titulo, resumo);
    } else if (resultado.errosLexicos) {
        veredito.dataset.estado = "erro";
        const n = resultado.errosLexicos.length;
        titulo.textContent = n === 1 ? "Erro léxico" : n + " erros léxicos";
        veredito.append(titulo);
        const lista = document.createElement("ul");
        for (const erro of resultado.errosLexicos) {
            const li = document.createElement("li");
            li.textContent = "Erro léxico na linha " + erro.linha + ': "' + erro.lexema +
                '" não forma nenhum token';
            lista.append(li);
        }
        const nota = document.createElement("p");
        nota.className = "resumo";
        nota.textContent = "Com erro léxico, a análise sintática não é executada.";
        veredito.append(lista, nota);
    } else {
        const e = resultado.erroSintatico;
        veredito.dataset.estado = "erro";
        titulo.textContent = "Erro sintático na linha " + e.linha;
        veredito.append(titulo,
            linhaDeErro("esperado", e.esperado),
            linhaDeErro("encontrado", e.encontrado));
    }
}

// conta formas e grupos em todos os níveis
function contarNos(itens) {
    let formas = 0;
    let grupos = 0;
    function visitar(lista) {
        for (const item of lista) {
            if (item.tipo === "grupo") {
                grupos = grupos + 1;
                visitar(item.itens);
            } else {
                formas = formas + 1;
            }
        }
    }
    visitar(itens);
    return formas + (formas === 1 ? " forma" : " formas") + " e " +
        grupos + (grupos === 1 ? " grupo" : " grupos");
}

// ---------- AST: JSON e diagrama ----------

let mermaid = null;
let tentouMermaid = false;
let desenhos = 0;

async function carregarMermaid() {
    if (!tentouMermaid) {
        tentouMermaid = true;
        try {
            const modulo = await import("https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.esm.min.mjs");
            mermaid = modulo.default;
            const tema = document.documentElement.dataset.theme;
            const escuro = tema === "dark" ||
                (tema !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
            mermaid.initialize({ startOnLoad: false, theme: escuro ? "dark" : "neutral", securityLevel: "strict" });
        } catch {
            mermaid = null;
            // sem internet: o diagrama aparece como texto Mermaid
        }
    }
    return mermaid;
}

async function mostrarAst(ast) {
    blocoAst.hidden = ast === undefined;
    if (ast === undefined) return;
    astJson.textContent = JSON.stringify(ast, null, 2);

    const codigo = paraMermaid(ast);
    const lib = await carregarMermaid();
    if (lib === null) {
        astArvore.innerHTML = "";
        const pre = document.createElement("pre");
        pre.textContent = codigo;
        astArvore.append(pre);
        return;
    }
    try {
        desenhos = desenhos + 1;
        const { svg } = await lib.render("arvore" + desenhos, codigo);
        astArvore.innerHTML = svg;
    } catch {
        astArvore.textContent = codigo;
    }
}

// ---------- conferência com o resultado esperado ----------

function mostrarConferencia(resultado) {
    if (casoAtual === null) {
        conferencia.hidden = true;
        return;
    }
    conferencia.hidden = false;
    const confere = JSON.stringify(resultado) === JSON.stringify(casoAtual.esperado);
    conferencia.dataset.estado = confere ? "ok" : "erro";
    conferencia.replaceChildren();
    const titulo = document.createElement("strong");
    titulo.textContent = confere ? "Confere com o resultado esperado" : "Diferente do resultado esperado";
    const descricao = document.createElement("span");
    descricao.textContent = casoAtual.descricao;
    conferencia.append(titulo, descricao);
}

// ---------- abas da AST ----------

for (const aba of document.querySelectorAll("[data-aba]")) {
    aba.addEventListener("click", () => {
        for (const outra of document.querySelectorAll("[data-aba]")) {
            const ativa = outra === aba;
            outra.setAttribute("aria-selected", String(ativa));
            document.getElementById(outra.dataset.aba).hidden = !ativa;
        }
    });
}

document.getElementById("botao").addEventListener("click", analisar);
entrada.addEventListener("keydown", (evento) => {
    if (evento.key === "Enter" && (evento.ctrlKey || evento.metaKey)) {
        evento.preventDefault();
        analisar();
    }
});

carregarCaso(0);
