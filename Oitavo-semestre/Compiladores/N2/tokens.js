// Fim de palavra: o lexema não pode continuar com letra, dígito ou "_".
// Sem isso, "reta" casaria com o começo de "retangulo" (ou de "retas"),
// "azul" com o começo de "azulado" e "0" com o começo de "05".
const FIM = "(?![\\p{L}\\p{N}_])";

function palavra(alternativas) {
    return new RegExp("(?:" + alternativas + ")" + FIM, "yu");
}

export const CORES = ["preto", "branco", "vermelho", "verde", "azul",
    "amarelo", "laranja", "roxo", "rosa", "cinza"];

export const regras = [
    { tipo: "ESPACO", padrao: /\s+/y, ignorar: true },
    { tipo: "COMENTARIO", padrao: /\/\/[^\n]*/y, ignorar: true },

    // palavras reservadas (com e sem acento)
    { tipo: "TELA", padrao: palavra("tela") },
    { tipo: "POR", padrao: palavra("por") },
    { tipo: "RETANGULO", padrao: palavra("retangulo|retângulo") },
    { tipo: "RETA", padrao: palavra("reta") },
    { tipo: "CIRCULO", padrao: palavra("circulo|círculo") },
    { tipo: "GRUPO", padrao: palavra("grupo") },
    { tipo: "ROTACIONA", padrao: palavra("rotaciona") },
    { tipo: "DESLOCA", padrao: palavra("desloca") },
    { tipo: "COM", padrao: palavra("com") },
    { tipo: "TRACO", padrao: palavra("traco|traço") },
    { tipo: "PREENCHIMENTO", padrao: palavra("preenchimento") },
    { tipo: "ESPESSURA", padrao: palavra("espessura") },

    // valores
    { tipo: "COR_NOME", padrao: palavra(CORES.join("|")) },
    { tipo: "COR_HEX", padrao: /#[0-9A-Fa-f]{6}(?![\p{L}\p{N}_])/yu },
    { tipo: "NUM", padrao: palavra("0|[1-9][0-9]*") },

    // pontuação
    { tipo: "ABRE_PAR", padrao: /\(/y },
    { tipo: "FECHA_PAR", padrao: /\)/y },
    { tipo: "VIRGULA", padrao: /,/y },
    { tipo: "ABRE_CHAVE", padrao: /\{/y },
    { tipo: "FECHA_CHAVE", padrao: /\}/y },
];
