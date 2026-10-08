<img src="./assets/Banner.png" width="100%">

# Tradutor de #hashtags e @menções — Desafios extras

**Disciplina:** Laboratório de Programação Avançada II – Compiladores (FECAP)
**Professor:** Dr. Marcelo Amorim

**Integrantes do grupo:**
- Lucca Giordano - 23024522
- Beatriz Ferreira - 23024947

Para executar, basta abrir o `index.html` no navegador.

---

## Desafio 1 — Contador

Um objeto `contagem = { mencoes, hashtags, negritos }` é criado a cada clique em **Traduzir** e passado para as funções de troca. O contador só é incrementado no `return` que deu certo (quando a chave existe no dicionário). O resultado aparece na `<div id="contador">`, abaixo do resultado.

## Desafio 2 — Ignorar e-mails

```js
/(?<![\wÀ-ÿ.])@([\wÀ-ÿ]+(?:\.[\wÀ-ÿ]+)*)/g
```

O *lookbehind negativo* `(?<![\wÀ-ÿ.])` exige que o caractere **antes** do `@` não seja letra, dígito, `_` ou ponto. Assim, em `ana@site.com` o `@` está colado no `a` e não é tratado como menção. O lookbehind não consome caracteres, só verifica.

## Desafio 3 — Nomes com ponto

O nome passou a ser `[\wÀ-ÿ]+(?:\.[\wÀ-ÿ]+)*`: um bloco de letras seguido de zero ou mais grupos "ponto + letras". Como o ponto só entra se vier pelo menos uma letra depois dele:

| Entrada | Nome capturado | Resultado |
|---|---|---|
| `@maria.silva` | `maria.silva` | Maria Silva |
| `Vou com @maria.` | `maria` | Vou com Maria Oliveira. |

## Desafio 4 — Nova marcação: `$texto$` vira negrito

```js
/\$(?!\s)([^$\n]+?)(?<!\s)\$/g
```

| Parte | Significado |
|---|---|
| `\$` | o `$` de abertura (escapado, pois `$` é especial em regex) |
| `(?!\s)` | lookahead: logo depois do `$` não pode vir espaço |
| `([^$\n]+?)` | grupo 1: o conteúdo, sem `$` nem quebra de linha (`+?` = o menor possível) |
| `(?<!\s)` | lookbehind: antes do `$` de fechamento não pode ter espaço |
| `\$` | o `$` de fechamento |

As regras de espaço evitam falso positivo em valores em reais: `R$ 10 e R$ 20` continua igual. A troca de negrito roda **depois** das menções e hashtags, então `$@pedro$` vira **Pedro Santos**.

## Testes

| Entrada | Resultado |
|---|---|
| `Mande para ana@site.com ou fale com @ana` | Mande para ana@site.com ou fale com Ana Souza |
| `Falei com @maria.silva hoje` | Falei com Maria Silva hoje |
| `Vou com @maria.` | Vou com Maria Oliveira. |
| `Isso é $muito importante$ @joao` | Isso é **muito importante** João da Silva |
| `Custa R$ 10 e R$ 20` | Custa R$ 10 e R$ 20 (sem negrito) |
| `$@pedro$ trouxe #frutas:uva` | **Pedro Santos** trouxe 🍇 |

Os 6 casos do Passo 8 do tutorial continuam funcionando.

---

## Discussão: relação com compiladores

**A regex `#([\wÀ-ÿ]+)(?::([\wÀ-ÿ]+))?` é uma expressão regular no sentido formal?**
Sim. Todos os elementos podem ser reescritos com as três operações formais:
- a classe `[\wÀ-ÿ]` é uma união finita de símbolos (`a | b | ... | ç | ...`);
- `X+` equivale a `X X*` (concatenação + fecho de Kleene);
- `X?` equivale a `(X | ε)`;
- os grupos `( )` e `(?: )` só servem para capturar/agrupar, não aumentam o poder da linguagem.

**Dá para escrever um AFD equivalente?**
Sim. Toda linguagem descrita por expressão regular formal é regular, e pelo Teorema de Kleene existe um AFD que a reconhece. Um AFD possível:
- q0 →`#`→ q1
- q1 →letra→ q2 (aceitação: hashtag sem valor, que o programa trata como erro)
- q2 →letra→ q2; q2 →`:`→ q3
- q3 →letra→ q4 (aceitação)
- q4 →letra→ q4

**E exigir a categoria repetida no final (`#frutas:banana#frutas`)?**
Não é possível com ER formal. A linguagem `{ #w:v#w }` exige "lembrar" uma cadeia `w` de tamanho arbitrário para comparar depois, o que um autômato com número finito de estados não consegue. Pelo Lema do Bombeamento, essa linguagem não é regular (é parecida com o exemplo clássico `{ ww }`).
Em JavaScript daria para fazer com **retrorreferência**: `/#([\wÀ-ÿ]+):([\wÀ-ÿ]+)#\1/`. O `\1` reaproveita o texto capturado no grupo 1, mas isso é uma extensão das regex das linguagens de programação que vai **além** das expressões regulares formais.
