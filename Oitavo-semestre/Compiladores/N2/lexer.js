import { regras } from "./tokens.js";
export function analisarLexico(texto) {
    const tokens = [];
    // lista de tokens encontrados
    const erros = [];
    // lista de erros léxicos encontrados
    let pos = 0;
    // ponteiro: posição atual no texto
    let linha = 1;
    // linha atual (começa na linha 1)
    while (pos < texto.length) {
        let achou = false;
        // ainda nenhuma regra casou nesta posição
        for (const regra of regras) {
            regra.padrao.lastIndex = pos;
            // posiciona o ponteiro
            const m = regra.padrao.exec(texto);
            // tenta casar exatamente ali
            if (m) {
                if (!regra.ignorar) {
                    // só guarda se não for ignorável
                    tokens.push({ tipo: regra.tipo, lexema: m[0], linha });
                }
                for (const caractere of m[0]) {
                    // conta as quebras de linha do trecho casado
                    if (caractere === "\n") {
                        linha = linha + 1;
                    }
                }
                pos = regra.padrao.lastIndex;
                achou = true;
                break;
                // o ponteiro avança em qualquer caso
                // casou: avisa o while
            }
        }
        if (!achou) {
            // nenhuma regra casou: erro léxico
            let fim = pos;
            while (fim < texto.length && !/\s/.test(texto[fim])) {
                fim = fim + 1;
                // anda até o próximo espaço
            }
            erros.push({ linha, lexema: texto.slice(pos, fim) });
            pos = fim;
            // pula o trecho inválido
        }
    }
    return { tokens, erros };
}