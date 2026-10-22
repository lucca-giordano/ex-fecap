// Converte a AST em um diagrama Mermaid (graph TD), só para visualização.

function rotuloEstilo(estilo) {
    const partes = [];
    for (const campo in estilo) {
        partes.push(campo + " " + estilo[campo]);
    }
    return partes.length > 0 ? "<br>" + partes.join(", ") : "";
}

function rotuloDe(no) {
    if (no.tipo === "programa") return "programa";
    if (no.tipo === "tela") return "tela " + no.largura + " × " + no.altura;
    if (no.tipo === "reta") return "reta (" + no.x1 + ", " + no.y1 + ") → (" + no.x2 + ", " + no.y2 + ")" + rotuloEstilo(no.estilo);
    if (no.tipo === "circulo") return "circulo (" + no.cx + ", " + no.cy + ") raio " + no.raio + rotuloEstilo(no.estilo);
    if (no.tipo === "retangulo") return "retangulo (" + no.x + ", " + no.y + ") " + no.largura + " × " + no.altura + rotuloEstilo(no.estilo);
    if (no.tipo === "grupo") {
        const mods = no.modificadores.map(m =>
            m.tipo === "rotacao" ? "rotacao " + m.angulo : "deslocamento " + m.dx + ", " + m.dy);
        return "grupo" + (mods.length > 0 ? "<br>" + mods.join(" → ") : "");
    }
    return no.tipo;
}

export function paraMermaid(ast) {
    const linhas = ["graph TD"];
    let contador = 0;

    function visitar(no) {
        const id = "n" + contador;
        contador = contador + 1;
        linhas.push(id + '["' + rotuloDe(no) + '"]');
        let filhos = [];
        if (no.tipo === "programa") filhos = [no.tela, ...no.itens];
        if (no.tipo === "grupo") filhos = no.itens;
        for (const filho of filhos) {
            const idFilho = visitar(filho);
            linhas.push(id + " --> " + idFilho);
        }
        return id;
    }

    visitar(ast);
    return linhas.join("\n");
}
