// Analisador sintático descendente recursivo.
// Cada variável da gramática vira uma função; a escolha da alternativa
// olha só o próximo token (LL(1)). Para no primeiro erro, lançando um
// ErroSintatico com a linha, o que era esperado e o que foi encontrado.

export class ErroSintatico extends Error {
    constructor(linha, esperado, encontrado) {
        super("Erro sintático na linha " + linha + ": esperado " + esperado +
            ", encontrado " + encontrado);
        this.linha = linha;
        this.esperado = esperado;
        this.encontrado = encontrado;
    }
}

// ["A", "B", "C"] → "A, B ou C"
function ou(lista) {
    if (lista.length <= 1) return lista.join("");
    return lista.slice(0, -1).join(", ") + " ou " + lista[lista.length - 1];
}

const INICIO_DE_ITEM = ["RETA", "CIRCULO", "RETANGULO", "GRUPO"];

// token do atributo de estilo → nome do campo na AST
const ATRIBUTOS = {
    TRACO: "traco",
    PREENCHIMENTO: "preenchimento",
    ESPESSURA: "espessura",
};

export function analisarSintatico(tokens) {
    let i = 0;
    // ponteiro: posição do token atual na lista de tokens

    function atual() {
        return tokens[i];
    }

    function tipoAtual() {
        return i < tokens.length ? tokens[i].tipo : "FIM";
    }

    function erro(esperado) {
        const token = tokens[i];
        if (token === undefined) {
            // acabaram os tokens: o erro é na linha do último token
            const linha = tokens.length > 0 ? tokens[tokens.length - 1].linha : 1;
            throw new ErroSintatico(linha, esperado, "o fim do programa");
        }
        throw new ErroSintatico(token.linha, esperado,
            token.tipo + ' "' + token.lexema + '"');
    }

    function esperar(tipo) {
        if (tipoAtual() !== tipo) {
            // não é o tipo que a gramática pede
            erro(tipo);
        }
        const token = tokens[i];
        i = i + 1;
        // era o certo: consome e avança
        return token;
    }

    function numero() {
        return Number(esperar("NUM").lexema);
    }

    // programa → tela itens FIM
    function programa() {
        const t = tela();
        const lista = itens();
        if (i < tokens.length) {
            // sobrou algum token que não começa item
            erro("RETA, CIRCULO, RETANGULO, GRUPO ou o fim do programa");
        }
        return { tipo: "programa", tela: t, itens: lista };
    }

    // tela → TELA NUM POR NUM
    function tela() {
        esperar("TELA");
        const largura = numero();
        esperar("POR");
        const altura = numero();
        return { tipo: "tela", largura: largura, altura: altura };
    }

    // itens → item itens | ε
    function itens() {
        const lista = [];
        while (INICIO_DE_ITEM.includes(tipoAtual())) {
            lista.push(item());
        }
        return lista;
    }

    // item → forma | grupo
    // forma → RETA ponto ponto estilo
    //       | CIRCULO ponto NUM estilo
    //       | RETANGULO ponto NUM POR NUM estilo
    function item() {
        const tipo = tipoAtual();
        if (tipo === "RETA") {
            esperar("RETA");
            const p1 = ponto();
            const p2 = ponto();
            return { tipo: "reta", x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, estilo: estilo() };
        } else if (tipo === "CIRCULO") {
            esperar("CIRCULO");
            const centro = ponto();
            const raio = numero();
            return { tipo: "circulo", cx: centro.x, cy: centro.y, raio: raio, estilo: estilo() };
        } else if (tipo === "RETANGULO") {
            esperar("RETANGULO");
            const canto = ponto();
            const largura = numero();
            esperar("POR");
            const altura = numero();
            return {
                tipo: "retangulo", x: canto.x, y: canto.y,
                largura: largura, altura: altura, estilo: estilo()
            };
        } else if (tipo === "GRUPO") {
            return grupo();
        }
        erro("RETA, CIRCULO, RETANGULO ou GRUPO");
    }

    // ponto → ABRE_PAR NUM VIRGULA NUM FECHA_PAR
    function ponto() {
        esperar("ABRE_PAR");
        const x = numero();
        esperar("VIRGULA");
        const y = numero();
        esperar("FECHA_PAR");
        return { x: x, y: y };
    }

    // grupo → GRUPO modificadores ABRE_CHAVE itens FECHA_CHAVE
    function grupo() {
        esperar("GRUPO");
        const mods = modificadores();
        if (tipoAtual() !== "ABRE_CHAVE") {
            erro("ROTACIONA, DESLOCA ou ABRE_CHAVE");
        }
        esperar("ABRE_CHAVE");
        const corpo = itens();
        if (tipoAtual() !== "FECHA_CHAVE") {
            erro("RETA, CIRCULO, RETANGULO, GRUPO ou FECHA_CHAVE");
        }
        esperar("FECHA_CHAVE");
        return { tipo: "grupo", modificadores: mods, itens: corpo };
    }

    // modificadores → modificador modificadores | ε
    // modificador   → ROTACIONA NUM | DESLOCA ponto
    function modificadores() {
        const lista = [];
        while (true) {
            if (tipoAtual() === "ROTACIONA") {
                esperar("ROTACIONA");
                lista.push({ tipo: "rotacao", angulo: numero() });
            } else if (tipoAtual() === "DESLOCA") {
                esperar("DESLOCA");
                const p = ponto();
                lista.push({ tipo: "deslocamento", dx: p.x, dy: p.y });
            } else {
                return lista;
            }
        }
    }

    // estilo → COM atributos{TRACO,PREENCHIMENTO,ESPESSURA} | ε
    function estilo() {
        const resultado = {};
        if (tipoAtual() !== "COM") {
            return resultado;
        }
        esperar("COM");
        atributos(Object.keys(ATRIBUTOS), resultado, true);
        return resultado;
    }

    // atributos{S}: um atributo cujo token está em S, seguido de atributos{S
    // sem ele}. Logo do COM pelo menos um é obrigatório; depois, cada um é
    // opcional (ε). Um atributo repetido não está mais em S: é erro sintático.
    function atributos(disponiveis, resultado, obrigatorio) {
        const tipo = tipoAtual();
        if (!disponiveis.includes(tipo)) {
            if (obrigatorio) {
                erro(ou(disponiveis));
            }
            if (tipo in ATRIBUTOS) {
                erro(ou([...disponiveis, "o fim da forma (" + tipo + " repetido)"]));
            }
            return;
            // ε: o estilo acabou
        }
        esperar(tipo);
        resultado[ATRIBUTOS[tipo]] = tipo === "ESPESSURA" ? numero() : cor();
        atributos(disponiveis.filter(t => t !== tipo), resultado, false);
    }

    // cor → COR_NOME | COR_HEX
    function cor() {
        const tipo = tipoAtual();
        if (tipo === "COR_NOME" || tipo === "COR_HEX") {
            return esperar(tipo).lexema;
        }
        erro("COR_NOME ou COR_HEX");
    }

    return programa();
}
