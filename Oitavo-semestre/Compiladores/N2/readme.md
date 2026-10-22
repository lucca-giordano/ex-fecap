# Analisador léxico e sintático do Robô

*Tutorial passo a passo em JavaScript, sem bibliotecas*

## O que vamos construir

Neste tutorial você vai construir, em JavaScript puro e sem bibliotecas, o **analisador léxico** e o **analisador sintático** de uma pequena linguagem: os comandos de um robô de armazém. Você digita um programa do robô em uma página web, clica em **Analisar**, e a página mostra os tokens encontrados e diz se o programa é válido ou aponta o erro.

Ao final, a página funcionará assim:

**Programa válido (a página mostra os tokens e o veredito)**

```
linha 1  REPETIR  "repetir"
linha 1  NUM      "3"
linha 1  ABRE     "["
linha 2  AVANCAR  "avancar"
linha 2  NUM      "10"
linha 3  REPETIR  "repetir"
linha 3  NUM      "2"
linha 3  ABRE     "["
linha 4  GIRAR    "girar"
linha 4  NUM      "90"
linha 5  FECHA    "]"
linha 6  PINTAR   "pintar"
linha 6  COR      "verde"
linha 7  FECHA    "]"

Análise sintática: programa válido
```

**Programa com erro sintático**

```
linha 1  REPETIR  "repetir"
linha 1  NUM      "3"
linha 1  ABRE     "["
linha 2  AVANCAR  "avancar"
linha 2  NUM      "10"
linha 3  GIRAR    "girar"
linha 4  FECHA    "]"

Erro sintático na linha 4: esperado NUM, encontrado FECHA
```

Cada passo tem um **Teste agora**, com a saída que você deve ver. Só avance quando o teste estiver certo.

## A linguagem do robô

Um robô de armazém é programado por um texto com comandos:

- `avancar N` move o robô N passos;
- `girar N` gira o robô N graus;
- `pintar COR` muda a cor da luz do robô (vermelho, azul ou verde);
- `repetir N [ ... ]` repete N vezes os comandos escritos entre colchetes. O bloco pode conter outros `repetir`.

Um programa tem um ou mais comandos, e um bloco entre colchetes também precisa ter pelo menos um comando. N é um inteiro positivo, sem zeros à esquerda. Espaços e quebras de linha podem ser usados livremente entre os símbolos.

### Definição léxica

| Token | Padrão | Descrição |
|---|---|---|
| AVANCAR | avancar | palavra reservada |
| GIRAR | girar | palavra reservada |
| PINTAR | pintar | palavra reservada |
| REPETIR | repetir | palavra reservada |
| COR | vermelho\|azul\|verde | cor aceita pelo robô |
| NUM | [1-9][0-9]* | inteiro positivo |
| ABRE | \[ | abre bloco |
| FECHA | \] | fecha bloco |
| ESPACO | [ \n\t]+ | espaços e quebras de linha (descartados) |

A barra invertida `\` escapa um metacaractere: `\[` é o caractere `[`. Um trecho que não formar nenhum token é um **erro léxico**.

### Definição sintática (gramática livre de contexto)

**Gramática**

```
programa → lista
lista    → comando lista | comando
comando  → AVANCAR NUM
         | GIRAR NUM
         | PINTAR COR
         | REPETIR NUM ABRE lista FECHA
```

Palavras em **MAIÚSCULAS** são tokens, e em minúsculas são variáveis. O símbolo `|` separa alternativas. Um trecho cuja sequência de tokens não obedece à gramática é um **erro sintático**.

## Antes de começar

Você vai precisar de um **editor de texto** (VS Code, por exemplo) e de um **navegador** (Chrome, Edge ou Firefox). Salve todos os arquivos em **UTF-8**, senão os acentos aparecem quebrados.

O tutorial usa módulos de JavaScript (`type="module"`), e os navegadores não carregam módulos de arquivos abertos com duplo clique. Por isso você abrirá a página por um **servidor local**, que é simples:

- **VS Code:** instale a extensão **Live Server**, clique com o botão direito no `index.html` e escolha **Open with Live Server**.
- **Terminal:** dentro da pasta do projeto, rode `python3 -m http.server 8000` (no Windows, `python -m http.server 8000`) e abra `http://localhost:8000`.

No fim, a pasta `robo` terá cinco arquivos:

| Arquivo | Para que serve | Criado no |
|---|---|---|
| index.html | a página: caixa de texto, botão e área de resultado | Passo 1 |
| main.js | liga a página aos analisadores e mostra o resultado | Passo 1 |
| tokens.js | a lista de tokens (as expressões regulares) | Passo 2 |
| lexer.js | o analisador léxico | Passo 3 |
| parser.js | o analisador sintático | Passo 4 |

O roteiro tem cinco passos:

| Passo | O que você faz |
|---|---|
| 1 | A página e o `main.js` |
| 2 | Os tokens e o ponteiro `lastIndex` |
| 3 | O analisador léxico, em três partes: tokens (3a), erro léxico (3b) e linhas (3c) |
| 4 | O analisador sintático: `esperar()` e os comandos simples |
| 5 | `lista()`, `comando()` e o `repetir` |

---

## Passo 1 — A página e o main.js

Crie uma pasta `robo` e, dentro dela, dois arquivos. O primeiro monta a tela, e o segundo, por enquanto, só devolve o texto digitado.

**index.html**

```html
<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <title>Analisador do Robô</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 700px; margin: 30px auto; }
    textarea { width: 100%; height: 160px; font-family: monospace; font-size: 16px; }
    button { margin: 10px 0; padding: 8px 16px; font-size: 16px; }
    #saida { border: 1px solid #ccc; padding: 10px; min-height: 60px;
             white-space: pre-wrap; font-family: monospace; }
  </style>
</head>
<body>
  <h1>Analisador do Robô</h1>

  <textarea id="entrada"></textarea>
  <br>
  <button id="botao">Analisar</button>

  <h3>Resultado</h3>
  <div id="saida"></div>

  <script type="module" src="main.js"></script>
</body>
</html>
```

**main.js**

```js
const exemplo = `repetir 3 [
    avançar 10
    pintar verde 
]`;
document.getElementById("entrada").value = exemplo;

function analisar() {
    const texto = document.getElementById("entrada").value;
    document.getElementById("saida").textContent = texto;
}

document.getElementById("botao").addEventListener("click", analisar);
```

- `document.getElementById("entrada")` encontra na página o elemento com `id="entrada"` (a caixa de texto), e `.value` lê ou escreve o que está nela.
- `.textContent = texto` escreve texto puro dentro de um elemento.
- `addEventListener("click", analisar)` diz: quando o botão for clicado, execute a função `analisar`.
- O texto de exemplo fica entre crases, que permitem escrever várias linhas. Ele já traz um erro de propósito: `avançar` com cedilha.

### Por que type="module"?

- O navegador só executa o módulo **depois** de montar a página, então o `getElementById` sempre encontra os elementos.
- As funções de um módulo não ficam globais. Aqui isso não atrapalha, porque ligamos o botão com `addEventListener`.
- Nos próximos passos, a vantagem aparece: dividiremos o código em arquivos e os ligaremos com `import` e `export`.

> **TESTE AGORA:** Abra a página **pelo servidor local**. A caixa de texto já deve abrir com o programa de exemplo, e ao clicar em **Analisar** o mesmo texto deve aparecer em **Resultado**. Se nada acontecer, aperte **F12**, abra a aba **Console** e veja se há erro em vermelho.

---

## Passo 2 — Os tokens

Neste passo, a tabela de tokens da especificação vira uma lista em JavaScript, em um arquivo próprio. Ainda não analisamos texto nenhum: só definimos o vocabulário do robô.

### 2.1 O arquivo tokens.js

**tokens.js**

```js
export const regras = [
  { tipo: "ESPACO",  padrao: /\s+/y, ignorar: true },
  { tipo: "AVANCAR", padrao: /avancar/y },
  { tipo: "GIRAR",   padrao: /girar/y },
  { tipo: "PINTAR",  padrao: /pintar/y },
  { tipo: "REPETIR", padrao: /repetir/y },
  { tipo: "COR",     padrao: /vermelho|azul|verde/y },
  { tipo: "NUM",     padrao: /[1-9][0-9]*/y },
  { tipo: "ABRE",    padrao: /\[/y },
  { tipo: "FECHA",   padrao: /\]/y },
];
```

- Cada linha corresponde a uma linha da tabela de tokens: `tipo` é o nome do token, e `padrao` é a expressão regular dele.
- `ignorar: true` marca o `ESPACO`: ele é reconhecido, mas não vai para a lista de tokens.
- `\[` e `\]` levam a barra invertida porque `[` e `]` têm significado especial em regex. Com a barra, são os caracteres literais.
- `export` deixa a lista disponível para outros arquivos.

### 2.2 O ponteiro lastIndex e a flag y

Cada regex termina com a flag `y`, de *sticky* (grudenta). Para entender o que ela faz, precisamos de uma propriedade das regex chamada `lastIndex`.

`lastIndex` é um **ponteiro para a posição atual** no texto de entrada. Com a flag `y`, a regex tenta casar **exatamente ali** e não procura mais adiante. Se casar, o ponteiro avança para depois do token. Se não casar, o ponteiro volta a 0.

Para o texto `"avancar girar"`, as posições são estas:

**Posições do texto**

```
posição:  0 1 2 3 4 5 6  7  8 9 10 11 12
letra:    a v a n c a r  ␣  g i r  a  r
```

Abra o navegador, aperte **F12**, vá à aba **Console** e experimente:

**Experimento 1: o ponteiro anda sozinho**

```js
const re = /avancar/y;                 // lastIndex começa em 0
re.test("avancar girar");              // true  → lastIndex agora é 7
re.test("avancar girar");              // false → tentou na posição 7 (o espaço); lastIndex volta a 0
re.test("avancar girar");              // true  → recomeçou de 0
```

Nada mudou entre a segunda e a terceira chamada, mas o resultado mudou, porque o ponteiro estava em outro lugar. Agora, um analisador léxico em miniatura, andando pelo texto token por token:

**Experimento 2: andando pelo texto**

```js
const texto = "avancar girar";
let pos = 0;

const a = /avancar/y;  a.lastIndex = pos;  a.test(texto);  pos = a.lastIndex;   // pos = 7
const e = /\s+/y;      e.lastIndex = pos;  e.test(texto);  pos = e.lastIndex;   // pos = 8
const g = /girar/y;    g.lastIndex = pos;  g.test(texto);  pos = g.lastIndex;   // pos = 13
```

- `x.lastIndex = pos` diz à regex: "comece a ler aqui".
- `x.test(texto)` pergunta: "casa exatamente nessa posição?"
- `pos = x.lastIndex` lê onde o casamento terminou, que é onde a próxima leitura começa.

No fim, `pos` vale 13, o tamanho do texto: chegamos ao final. É isso que o analisador do Passo 3 vai fazer, em um laço.

### A flag y contra a flag g

Com `g` (global), a regex procura **dali em diante** e pode achar o token mais adiante. Com `y`, ela olha **só dali**. Isso muda o analisador:

**Experimento 3**

```js
const g = /girar/g;  g.lastIndex = 0;  g.test("# girar");   // true  → pulou o "#" e achou adiante
const y = /girar/y;  y.lastIndex = 0;  y.test("# girar");   // false → na posição 0 há "#", não "girar"
```

Com `g`, o `#` seria ignorado em silêncio, e o analisador nunca perceberia o caractere inválido. Com `y`, nenhuma regra casa na posição do `#`, e é essa falha que o analisador usa para apontar o erro léxico.

> **DICA:** Antes de cada teste, o analisador sempre atribui `lastIndex = pos`. Como a mesma regex é reutilizada em posições diferentes, sem isso o resultado dependeria do histórico do último uso.

### 2.3 Listando as regras no main.js

Para ver o arquivo funcionando, troque o `main.js` por esta versão, que lista as regras na tela:

**main.js**

```js
import { regras } from "./tokens.js";

const exemplo = `repetir 3 [
    avançar 10
    pintar verde 
]`;
document.getElementById("entrada").value = exemplo;

function analisar() {
    const linhas = [];                                   // lista vazia para as linhas de texto

    for (const regra of regras) {                        // percorre cada regra de tokens.js
        const nome = regra.tipo.padEnd(9);               // completa com espaços para alinhar
        const padrao = regra.padrao.toString();          // converte a regex em texto
        linhas.push(nome + padrao);                      // monta a linha e guarda na lista
    }

    document.getElementById("saida").textContent = linhas.join("\n");   // junta as linhas
}

document.getElementById("botao").addEventListener("click", analisar);
```

- O `for (const regra of regras)` percorre a lista que veio do `tokens.js`.
- `padEnd(9)` completa o nome com espaços até 9 caracteres, para alinhar as colunas.
- `toString()` converte a regex em texto, algo como `/girar/y`.
- `join("\n")` junta as linhas, separando-as por quebra de linha.

> **TESTE AGORA:** Recarregue e clique em **Analisar**. O **Resultado** deve mostrar exatamente isto:

**Resultado esperado**

```
ESPACO   /\s+/y
AVANCAR  /avancar/y
GIRAR    /girar/y
PINTAR   /pintar/y
REPETIR  /repetir/y
COR      /vermelho|azul|verde/y
NUM      /[1-9][0-9]*/y
ABRE     /\[/y
FECHA    /\]/y
```

**Se der erro:** um erro de CORS no Console significa que você abriu com duplo clique em vez do servidor local. `Failed to resolve module specifier` ou `404` significam que o `tokens.js` não está na mesma pasta ou que o `import` está sem o `./` ou sem o `.js`.

**Para pensar:** `COR` e `NUM` têm padrões bem diferentes. Por que a ordem das regras na lista não importa nesta linguagem? (A resposta está no fim do documento.)

---

## Passo 3 — O analisador léxico

Agora as regras passam a rodar de verdade. O analisador lê o texto da esquerda para a direita e vai produzindo tokens. Faremos isso em três partes: reconhecer os tokens (3a), tratar o erro léxico (3b) e contar as linhas (3c).

### 3a. Reconhecendo os tokens

O laço fica em um arquivo próprio, o `lexer.js`, que usa o `import` e o `export` do módulo.

**lexer.js**

```js
import { regras } from "./tokens.js";

export function analisarLexico(texto) {
    const tokens = [];      // lista de tokens encontrados
    let pos = 0;            // ponteiro: posição atual no texto
    const linha = 1;        // ainda não contamos linhas (Passo 3c)

    while (pos < texto.length) {
        for (const regra of regras) {
            regra.padrao.lastIndex = pos;                    // posiciona o ponteiro
            const m = regra.padrao.exec(texto);              // tenta casar exatamente ali
            if (m) {
                if (!regra.ignorar) {                        // só guarda se não for ignorável
                    tokens.push({ tipo: regra.tipo, lexema: m[0], linha });
                }
                pos = regra.padrao.lastIndex;                // o ponteiro avança em qualquer caso
                break;
            }
        }
    }

    return tokens;
}
```

- **`m[0]` é o valor casado.** `exec` devolve uma lista, e a posição `0` guarda o trecho inteiro que a regex reconheceu. Esse trecho se chama **lexema**: o texto (`"avancar"`) enquanto o `tipo` (`AVANCAR`) é a categoria.
- Cada token vira um objeto com `tipo`, `lexema` e `linha`. A `linha` fica fixa em 1 por enquanto.
- `return tokens` devolve a lista para quem chamou a função.

### Quem executa as expressões regulares?

O **motor de regex do próprio JavaScript**, que já vem no navegador. Nós não o implementamos: só o chamamos, na linha `regra.padrao.exec(texto)`. No Passo 2 nenhuma regex rodou, pois elas eram só dados em uma lista. A execução começa aqui. Em termos da disciplina, é o que o Lex faz de outro jeito: ele converte as expressões regulares em um autômato (ER → AFN → AFD) e gera código, enquanto aqui entregamos as expressões ao motor.

### Como o espaço é descartado

O analisador **reconhece** o espaço normalmente e **avança o ponteiro**, mas **não guarda** o token na lista. A linha que faz a diferença é `if (!regra.ignorar)`. O ponteiro `pos` avança nos dois casos, e é isso que "descarta" o espaço: o analisador passa por ele e segue. Por que descartar na fase léxica? Se os espaços chegassem ao sintático, a gramática teria de aceitar um `ESPACO` entre quaisquer dois tokens, e ficaria poluída.

Agora o `main.js`, que mostra cada token com o seu valor. Repare que o `exemplo` está com `avancar` (sem cedilha), por um motivo que vem logo abaixo:

**main.js**

```js
import { analisarLexico } from "./lexer.js";

const exemplo = `repetir 3 [
    avancar 10
    pintar verde 
]`;
document.getElementById("entrada").value = exemplo;

function analisar() {
    const texto = document.getElementById("entrada").value;
    const tokens = analisarLexico(texto);

    const linhas = [];
    for (const token of tokens) {
        const nome = token.tipo.padEnd(9);
        const lexema = '"' + token.lexema + '"';
        linhas.push(nome + lexema);
    }

    document.getElementById("saida").textContent = linhas.join("\n");
}

document.getElementById("botao").addEventListener("click", analisar);
```

> **TESTE AGORA:** Recarregue e clique em **Analisar**. O **Resultado** deve ser:

**Resultado esperado**

```
REPETIR  "repetir"
NUM      "3"
ABRE     "["
AVANCAR  "avancar"
NUM      "10"
PINTAR   "pintar"
COR      "verde"
FECHA    "]"
```

Os espaços e as quebras de linha **não aparecem**: foram reconhecidos e descartados.

> **ATENÇÃO:** **Não troque por `avançar` ainda.** Se o texto tiver um caractere que nenhuma regra reconhece, como o `ç` ou um `#`, a aba **trava**: o `for` termina sem achar nada, o `pos` não avança e o `while` repete a mesma posição para sempre. Antes de seguir, **preveja**: em que ponto exato do texto `avançar` o laço fica preso? (Resposta no começo do 3b.)

### 3b. O erro léxico

**Resposta da previsão:** o laço fica preso no **início da palavra `avançar`**, e não no `ç`. A regex `/avancar/y` falha ali, porque só descobre o problema ao chegar no `ç`, e nenhuma outra regra casa nessa posição. O `pos` não avança e o laço repete a mesma tentativa.

A solução é reconhecer o caso em que **nenhuma regra casa**, registrar o erro e **pular o trecho inválido**. Substitua o `lexer.js` por esta versão:

**lexer.js**

```js
import { regras } from "./tokens.js";

export function analisarLexico(texto) {
    const tokens = [];      // lista de tokens encontrados
    const erros = [];       // lista de erros léxicos encontrados
    let pos = 0;            // ponteiro: posição atual no texto
    const linha = 1;        // ainda não contamos linhas (Passo 3c)

    while (pos < texto.length) {
        let achou = false;                                   // ainda nenhuma regra casou nesta posição

        for (const regra of regras) {
            regra.padrao.lastIndex = pos;                    // posiciona o ponteiro
            const m = regra.padrao.exec(texto);              // tenta casar exatamente ali
            if (m) {
                if (!regra.ignorar) {                        // só guarda se não for ignorável
                    tokens.push({ tipo: regra.tipo, lexema: m[0], linha });
                }
                pos = regra.padrao.lastIndex;                // o ponteiro avança em qualquer caso
                achou = true;                                // casou: avisa o while
                break;
            }
        }

        if (!achou) {                                        // nenhuma regra casou: erro léxico
            let fim = pos;
            while (fim < texto.length && !/\s/.test(texto[fim])) {
                fim = fim + 1;                               // anda até o próximo espaço
            }
            erros.push({ linha, lexema: texto.slice(pos, fim) });
            pos = fim;                                       // pula o trecho inválido
        }
    }

    return { tokens, erros };
}
```

- **`achou`** é uma variável de controle. Começa como `false` a cada volta do `while`, e vira `true` quando alguma regra casa. Se o `for` terminar com `achou` ainda `false`, nenhuma regra serviu.
- **O trecho inválido** vai da posição atual até o próximo espaço, tab ou quebra de linha. Por isso `avançar` vira **um** erro, e não sete.
- `/\s/.test(...)` pergunta se um caractere é espaço em branco. Essa regex não tem a flag `y` nem `g`, então não usa `lastIndex`.
- `texto.slice(pos, fim)` extrai o pedaço do texto entre as posições `pos` e `fim`.
- `pos = fim` é o que evita o travamento: o ponteiro sempre avança. O caractere em `pos` nunca é um espaço, porque a regra `ESPACO` já teria casado, então `fim` fica pelo menos uma posição à frente.
- `return { tokens, erros }` devolve as duas listas juntas.

E o `main.js`, que agora também mostra os erros. O `exemplo` volta a ter `avançar`:

**main.js**

```js
import { analisarLexico } from "./lexer.js";

const exemplo = `repetir 3 [
    avançar 10
    pintar verde 
]`;
document.getElementById("entrada").value = exemplo;

function analisar() {
    const texto = document.getElementById("entrada").value;
    const resultado = analisarLexico(texto);
    const tokens = resultado.tokens;
    const erros = resultado.erros;

    const linhas = [];

    for (const token of tokens) {
        const nome = token.tipo.padEnd(9);
        const lexema = '"' + token.lexema + '"';
        linhas.push(nome + lexema);
    }

    if (erros.length > 0) {
        linhas.push("");
    }

    for (const erro of erros) {
        linhas.push('Erro léxico: "' + erro.lexema + '" não forma nenhum token');
    }

    document.getElementById("saida").textContent = linhas.join("\n");
}

document.getElementById("botao").addEventListener("click", analisar);
```

> **TESTE AGORA:** Recarregue e clique em **Analisar**. O **Resultado** deve ser:

**Resultado esperado**

```
REPETIR  "repetir"
NUM      "3"
ABRE     "["
NUM      "10"
PINTAR   "pintar"
COR      "verde"
FECHA    "]"

Erro léxico: "avançar" não forma nenhum token
```

Depois, teste estes casos e **preveja o resultado antes de clicar**:

| Texto digitado | Resultado esperado |
|---|---|
| avancar 10# girar # 5 | 4 tokens (`AVANCAR`, `NUM`, `GIRAR`, `NUM`) e dois erros: `"#"`, `"#"` |
| Pintar Verde | nenhum token e dois erros: `"Pintar"` e `"Verde"` (as maiúsculas não casam) |
| (texto vazio) | resultado vazio |

No primeiro caso, o `#` colado em `10#` vira erro à parte porque o `10` é reconhecido primeiro, como token, e só depois o `#` não casa com nada.

### 3c. A contagem de linhas

Falta dizer **onde** está cada token e cada erro. Vamos contar as linhas conforme o ponteiro avança. Duas mudanças no `lexer.js`: a variável `linha` passa de `const` para `let`, e entra um pequeno laço que conta as quebras de linha.

**lexer.js**

```js
import { regras } from "./tokens.js";

export function analisarLexico(texto) {
    const tokens = [];      // lista de tokens encontrados
    const erros = [];       // lista de erros léxicos encontrados
    let pos = 0;            // ponteiro: posição atual no texto
    let linha = 1;          // linha atual (começa na linha 1)

    while (pos < texto.length) {
        let achou = false;                                   // ainda nenhuma regra casou nesta posição

        for (const regra of regras) {
            regra.padrao.lastIndex = pos;                    // posiciona o ponteiro
            const m = regra.padrao.exec(texto);              // tenta casar exatamente ali
            if (m) {
                if (!regra.ignorar) {                        // só guarda se não for ignorável
                    tokens.push({ tipo: regra.tipo, lexema: m[0], linha });
                }

                for (const caractere of m[0]) {              // conta as quebras de linha do trecho casado
                    if (caractere === "\n") {
                        linha = linha + 1;
                    }
                }

                pos = regra.padrao.lastIndex;                // o ponteiro avança em qualquer caso
                achou = true;                                // casou: avisa o while
                break;
            }
        }

        if (!achou) {                                        // nenhuma regra casou: erro léxico
            let fim = pos;
            while (fim < texto.length && !/\s/.test(texto[fim])) {
                fim = fim + 1;                               // anda até o próximo espaço
            }
            erros.push({ linha, lexema: texto.slice(pos, fim) });
            pos = fim;                                       // pula o trecho inválido
        }
    }

    return { tokens, erros };
}
```

- A contagem fica **depois** do `tokens.push`, para que cada token guarde a linha em que ele **começa**.
- Ela fica **fora** do `if (!regra.ignorar)`. As quebras de linha estão dentro do `ESPACO`, que é descartado, mas precisam ser contadas mesmo assim. Se a contagem ficasse dentro do `if`, tudo apareceria na linha 1.
- `for (const caractere of m[0])` percorre o trecho casado caractere por caractere, e cada `"\n"` soma uma linha.
- O trecho **inválido** não precisa de contagem, porque ele termina no primeiro espaço e, portanto, nunca contém uma quebra de linha.

O `main.js` agora mostra a linha de cada token e de cada erro:

**main.js**

```js
import { analisarLexico } from "./lexer.js";

const exemplo = `repetir 3 [
    avançar 10
    pintar verde 
]`;
document.getElementById("entrada").value = exemplo;

function analisar() {
    const texto = document.getElementById("entrada").value;
    const resultado = analisarLexico(texto);
    const tokens = resultado.tokens;
    const erros = resultado.erros;

    const linhas = [];

    for (const token of tokens) {
        const onde = "linha " + token.linha + "  ";
        const nome = token.tipo.padEnd(9);
        const lexema = '"' + token.lexema + '"';
        linhas.push(onde + nome + lexema);
    }

    if (erros.length > 0) {
        linhas.push("");
    }

    for (const erro of erros) {
        linhas.push('Erro léxico na linha ' + erro.linha + ': "' + erro.lexema + '" não forma nenhum token');
    }

    document.getElementById("saida").textContent = linhas.join("\n");
}

document.getElementById("botao").addEventListener("click", analisar);
```

> **TESTE AGORA:** Recarregue e clique em **Analisar**. O **Resultado** deve ser:

**Resultado esperado**

```
linha 1  REPETIR  "repetir"
linha 1  NUM      "3"
linha 1  ABRE     "["
linha 2  NUM      "10"
linha 3  PINTAR   "pintar"
linha 3  COR      "verde"
linha 4  FECHA    "]"

Erro léxico na linha 2: "avançar" não forma nenhum token
```

Para treinar, **preveja** o resultado antes de testar:

| Alteração no texto de exemplo | Resultado esperado |
|---|---|
| Linha em branco entre `avançar 10` e `pintar verde` | o `PINTAR` passa para a linha 4, e o erro continua na linha 2 |
| `repetir 3 [ avançar 10` na mesma linha | o erro passa para a linha 1 |

A **fase 1 está completa**: o analisador léxico lê o texto, produz os tokens com valor e linha, e relata os erros léxicos. O que vem agora é a **fase 2**, que recebe a lista `tokens`.

---

## Passo 4 — O analisador sintático: esperar() e os comandos simples

Agora o sintático confere se a **ordem** dos tokens obedece à gramática. Neste passo tratamos só os três comandos simples:

**Parte da gramática**

```
comando → AVANCAR NUM
        | GIRAR NUM
        | PINTAR COR
```

Crie o arquivo `parser.js`:

**parser.js**

```js
export function analisarSintatico(tokens) {
    let i = 0;      // ponteiro: posição do token atual na lista de tokens

    function esperar(tipo) {
        const token = tokens[i];                             // o token da vez

        if (token === undefined) {                           // acabaram os tokens
            throw new Error("Erro sintático: esperado " + tipo + ", mas o programa terminou");
        }

        if (token.tipo !== tipo) {                           // não é o tipo que a gramática pede
            throw new Error("Erro sintático na linha " + token.linha +
                            ": esperado " + tipo + ", encontrado " + token.tipo);
        }

        i = i + 1;                                           // era o certo: consome e avança
    }

    function comando() {
        const token = tokens[i];

        if (token === undefined) {
            throw new Error("Erro sintático: esperado um comando, mas o programa terminou");
        }

        if (token.tipo === "AVANCAR") {                      // comando → AVANCAR NUM
            esperar("AVANCAR");
            esperar("NUM");
        } else if (token.tipo === "GIRAR") {                 // comando → GIRAR NUM
            esperar("GIRAR");
            esperar("NUM");
        } else if (token.tipo === "PINTAR") {                // comando → PINTAR COR
            esperar("PINTAR");
            esperar("COR");
        } else {
            throw new Error("Erro sintático na linha " + token.linha +
                            ": esperado um comando, encontrado " + token.tipo);
        }
    }

    comando();                                               // por enquanto, só UM comando

    if (i < tokens.length) {                                 // sobrou algum token?
        const token = tokens[i];
        throw new Error("Erro sintático na linha " + token.linha +
                        ": esperado o fim do programa, encontrado " + token.tipo);
    }
}
```

- **`i` é o ponteiro do sintático**, o irmão do `pos` do léxico. O `pos` andava pelos caracteres do texto, e o `i` anda pelos **tokens** da lista.
- **`esperar(tipo)`** confere se o token na posição `i` é do tipo que a gramática pede. Se for, o ponteiro avança. Se não for, o programa **para com um erro**.
- **`tokens[i]` pode ser `undefined`.** Quando `i` passa do fim da lista, não há mais token, e o primeiro `if` trata esse caso com uma mensagem clara.
- **`throw new Error(...)`** interrompe a análise e lança uma mensagem. Quem chamou a função recebe esse erro (veja o `try/catch` abaixo).
- **`comando()` é a regra da gramática em forma de função.** O `if` olha o primeiro token para decidir qual alternativa seguir, e dentro de cada uma há um `esperar` por símbolo da regra, na ordem em que aparecem.
- As funções `esperar` e `comando` ficam **dentro** de `analisarSintatico` e por isso enxergam as variáveis `tokens` e `i` de fora.
- O teste final `if (i < tokens.length)` pega o caso de sobrar token depois do comando. Como só aceitamos um comando, `avancar 10 girar 90` vai dar erro. Isso muda no próximo passo.

Agora o `main.js`:

**main.js**

```js
import { analisarLexico } from "./lexer.js";
import { analisarSintatico } from "./parser.js";

const exemplo = `avancar 10`;
document.getElementById("entrada").value = exemplo;

function analisar() {
    const texto = document.getElementById("entrada").value;
    const resultado = analisarLexico(texto);
    const tokens = resultado.tokens;
    const erros = resultado.erros;

    const linhas = [];

    for (const token of tokens) {
        const onde = "linha " + token.linha + "  ";
        const nome = token.tipo.padEnd(9);
        const lexema = '"' + token.lexema + '"';
        linhas.push(onde + nome + lexema);
    }

    linhas.push("");

    if (erros.length > 0) {
        for (const erro of erros) {
            linhas.push('Erro léxico na linha ' + erro.linha + ': "' + erro.lexema + '" não forma nenhum token');
        }
    } else {
        try {
            analisarSintatico(tokens);
            linhas.push("Análise sintática: programa válido");
        } catch (falha) {
            linhas.push(falha.message);
        }
    }

    document.getElementById("saida").textContent = linhas.join("\n");
}

document.getElementById("botao").addEventListener("click", analisar);
```

- O sintático **só roda se não houver erro léxico**, que é a ordem das duas etapas da atividade: primeiro o léxico, depois o sintático.
- `try { ... } catch (falha) { ... }` tenta rodar o bloco. Se algum `throw` acontecer lá dentro, o programa pula para o `catch`, e `falha.message` é o texto que escrevemos no `throw`.

> **TESTE AGORA:** Recarregue e clique em **Analisar**. Com `avancar 10`, a última linha do **Resultado** deve ser `Análise sintática: programa válido`. Depois, teste os casos abaixo e **preveja** a mensagem antes de clicar (o símbolo ↵ marca uma quebra de linha):

| Texto digitado | Última linha do resultado |
|---|---|
| girar 90 | Análise sintática: programa válido |
| pintar verde | Análise sintática: programa válido |
| pintar 10 | Erro sintático na linha 1: esperado COR, encontrado NUM |
| avancar | Erro sintático: esperado NUM, mas o programa terminou |
| avancar ↵ girar 90 | Erro sintático na linha 2: esperado NUM, encontrado GIRAR |
| avancar 10 girar 90 | Erro sintático na linha 1: esperado o fim do programa, encontrado GIRAR |
| repetir 3 [ avancar 10 ] | Erro sintático na linha 1: esperado um comando, encontrado REPETIR |

No caso `avancar ↵ girar 90`, o erro aparece na **linha 2**, e não na 1, onde falta o número. O analisador só percebe o problema ao ler o `girar`, que é o primeiro token que não cabia. A linha apontada é a da **detecção**. Os dois últimos casos mostram o que falta: uma **lista** de comandos e o `repetir`. É o Passo 5.

---

## Passo 5 — lista(), comando() e o repetir

Faltam duas coisas: aceitar **vários** comandos em sequência (`lista`) e o comando `repetir`, que contém uma lista dentro dele.

**A gramática completa**

```
programa → lista
lista    → comando lista | comando
comando  → AVANCAR NUM | GIRAR NUM | PINTAR COR
         | REPETIR NUM ABRE lista FECHA
```

Substitua o `parser.js` por esta versão:

**parser.js**

```js
export function analisarSintatico(tokens) {
    let i = 0;      // ponteiro: posição do token atual na lista de tokens

    function esperar(tipo) {
        const token = tokens[i];                             // o token da vez

        if (token === undefined) {                           // acabaram os tokens
            throw new Error("Erro sintático: esperado " + tipo + ", mas o programa terminou");
        }

        if (token.tipo !== tipo) {                           // não é o tipo que a gramática pede
            throw new Error("Erro sintático na linha " + token.linha +
                            ": esperado " + tipo + ", encontrado " + token.tipo);
        }

        i = i + 1;                                           // era o certo: consome e avança
    }

    function comecaComando() {
        const token = tokens[i];

        if (token === undefined) {                           // sem token, não começa comando
            return false;
        }

        if (token.tipo === "AVANCAR" || token.tipo === "GIRAR" ||
            token.tipo === "PINTAR" || token.tipo === "REPETIR") {
            return true;
        }

        return false;
    }

    function lista() {                                       // lista → comando lista | comando
        comando();                                           // sempre há pelo menos um comando
        while (comecaComando()) {                            // enquanto vier outro comando...
            comando();                                       // ...analisa-o também
        }
    }

    function comando() {
        const token = tokens[i];

        if (token === undefined) {
            throw new Error("Erro sintático: esperado um comando, mas o programa terminou");
        }

        if (token.tipo === "AVANCAR") {                      // comando → AVANCAR NUM
            esperar("AVANCAR");
            esperar("NUM");
        } else if (token.tipo === "GIRAR") {                 // comando → GIRAR NUM
            esperar("GIRAR");
            esperar("NUM");
        } else if (token.tipo === "PINTAR") {                // comando → PINTAR COR
            esperar("PINTAR");
            esperar("COR");
        } else if (token.tipo === "REPETIR") {               // comando → REPETIR NUM ABRE lista FECHA
            esperar("REPETIR");
            esperar("NUM");
            esperar("ABRE");
            lista();                                         // variável: chama a função dela
            esperar("FECHA");
        } else {
            throw new Error("Erro sintático na linha " + token.linha +
                            ": esperado um comando, encontrado " + token.tipo);
        }
    }

    lista();                                                 // programa → lista

    if (i < tokens.length) {                                 // sobrou algum token?
        const token = tokens[i];
        throw new Error("Erro sintático na linha " + token.linha +
                        ": esperado o fim do programa, encontrado " + token.tipo);
    }
}
```

- **`comecaComando()`** responde "o próximo token começa um comando?". Isso permite à `lista` decidir se continua ou termina.
- **`lista()`** chama `comando()` uma vez e depois repete enquanto o próximo token começar outro comando.
- **O ramo do `REPETIR`** é a regra `REPETIR NUM ABRE lista FECHA` traduzida símbolo por símbolo: três `esperar`, uma chamada `lista()` para a variável, e o último `esperar`.
- No fim, **`lista()` substitui o `comando()`** do Passo 4: o programa é uma lista, e não um comando só.

No `main.js`, só a constante `exemplo` muda. O resto do arquivo continua igual:

**main.js (só o exemplo)**

```js
const exemplo = `repetir 3 [
    avancar 10
    repetir 2 [
        girar 90
    ]
    pintar verde
]`;
```

### O ponto principal: as duas funções se chamam

`comando()` chama `lista()`, e `lista()` chama `comando()`. É isso que dá o **aninhamento**: dentro de um `repetir` cabe uma lista, que pode ter outro `repetir`, que tem outra lista, e assim por diante. A ordem das funções no arquivo não importa, porque o JavaScript conhece todas as funções declaradas antes de executar a primeira.

Cada vez que `comando()` chama `lista()`, o computador guarda **onde ele parou** para poder voltar. Essa memória das chamadas pendentes é a **pilha de chamadas**. É ela que "conta" os níveis de aninhamento, e é por isso que a gramática do robô precisa de pilha (o autômato com pilha da teoria) e não cabe em um AFD.

Veja a execução de `repetir 2 [ avancar 10 ]`, em que a indentação mostra quem chamou quem:

**Sequência de chamadas**

```
lista()
  comando()  vê REPETIR
    esperar(REPETIR)  -> consome "repetir"
    esperar(NUM)  -> consome "2"
    esperar(ABRE)  -> consome "["
    lista()
      comando()  vê AVANCAR
        esperar(AVANCAR)  -> consome "avancar"
        esperar(NUM)  -> consome "10"
    esperar(FECHA)  -> consome "]"
```

> **TESTE AGORA:** Recarregue e clique em **Analisar**. A última linha deve ser `Análise sintática: programa válido`. Depois, teste os casos abaixo e **preveja** a mensagem antes de clicar:

| Texto digitado | Última linha do resultado |
|---|---|
| avancar 10 girar 90 | Análise sintática: programa válido |
| repetir 2 [ ] | Erro sintático na linha 1: esperado um comando, encontrado FECHA |
| repetir [ avancar 5 ] | Erro sintático na linha 1: esperado NUM, encontrado ABRE |
| repetir 3 [ avancar 10 | Erro sintático: esperado FECHA, mas o programa terminou |
| avancar 10 ] | Erro sintático na linha 1: esperado o fim do programa, encontrado FECHA |
| repetir 3 [ ↵   avancar 10 ↵   girar ↵ ] | Erro sintático na linha 4: esperado NUM, encontrado FECHA |
| repetir 2 [ repetir 2 [ repetir 2 [ girar 1 ] ] ] | Análise sintática: programa válido |

No caso do `girar` sem número, o erro aparece na linha 4 (o `]`) e não na 3, pela mesma regra de detecção do Passo 4. Outra observação: a gramática diz `lista → comando lista`, e o código usa um `while`. Ele reconhece exatamente a mesma linguagem; a diferença é que o `while` repete no mesmo lugar, enquanto a recursão da gramática seria uma chamada a `lista()` dentro dela mesma. O aninhamento do `repetir` é o único ponto em que a recursão é indispensável.

O analisador está **completo**: o léxico e o sintático já estão ligados desde o Passo 4.

## Testando com os trechos da atividade

Use os trechos do Exercício 2 da atividade "Onde estão os erros?" para conferir o analisador:

| Trecho | O que o analisador mostra |
|---|---|
| T1 (misto): `repetir 3 [` ↵ `avançar 10` ↵ `girar` ↵ `]` | Erro léxico na linha 2: "avançar" não forma nenhum token |
| T1 depois de corrigir o `avançar` | Erro sintático na linha 4: esperado NUM, encontrado FECHA |
| T2 (válido, aninhado) | Análise sintática: programa válido |
| T3 (sintático): `repetir 2 [ ]` ↵ `pintar 10` ↵ `repetir [` ↵ `avancar 5` ↵ `]` ↵ `girar 90 ]` | Erro sintático na linha 1: esperado um comando, encontrado FECHA |

Duas diferenças em relação ao gabarito da atividade, que valem uma conversa: o T1 mostra só o erro léxico, porque o sintático **não roda enquanto houver erro léxico** (corrija o `avançar` e o erro sintático aparece em seguida); e o T3 mostra só o **primeiro** dos quatro erros, porque este analisador para no primeiro erro sintático.

## Para pensar

- **Gramática em código.** Compare o `parser.js` com a gramática. Cada variável virou uma função, cada token virou um `esperar`, cada `|` virou um `if`. O que aconteceria se você esquecesse um `esperar` dentro do `REPETIR`? Nada compara o código com a gramática: o analisador passaria a aceitar programas inválidos.
- **O ponteiro.** O `lastIndex` com a flag `y` faz o papel do ponteiro de leitura de um autômato finito. Cada regra de `tokens.js` é uma expressão regular, que corresponde a um AFD.
- **A pilha.** O léxico cabe em autômatos finitos, mas o sintático do `repetir` não: ele precisa contar os níveis de aninhamento. No código, quem conta é a pilha de chamadas das funções.

## Desafios opcionais

1. **Um comando novo.** Acrescente `pausar N` à linguagem. Que arquivos você precisa mudar? (Dica: `tokens.js` e `parser.js`.)
2. **Todos os erros.** Hoje o sintático para no primeiro erro. Faça-o continuar e listar todos. Dica: em vez de lançar o erro com `throw`, guarde a mensagem em uma lista e siga adiante.
3. **A árvore (AST).** Em vez de só aceitar ou rejeitar, faça `comando()` devolver um objeto, como `{ tipo: "repetir", vezes: 3, corpo: [...] }`, e `lista()` devolver a lista desses objetos. Os colchetes já cumpriram o papel de delimitar o bloco e não aparecem na árvore.

## Respostas

- **Passo 2, ordem das regras.** Nenhum padrão casa o início de outro, então no máximo uma regra casa em cada posição. Numa linguagem com identificadores e palavras reservadas isso muda: `repetir` casaria também como identificador, e a ordem passaria a decidir.
- **Passo 3a, onde o laço trava.** No início da palavra `avançar`, e não no `ç`.
- **Passos 3b e 3c e 4 e 5.** As respostas esperadas estão nas tabelas de cada passo; compare com o que a sua página mostra.
