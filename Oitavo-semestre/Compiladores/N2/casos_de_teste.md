# Casos de teste da linguagem Traço

Cinco programas válidos e três inválidos, com o resultado esperado de cada um.
Os mesmos casos estão em `casos.js`: a página de teste carrega cada um no menu **Casos de teste** e mostra se o resultado confere,
e `node testes.mjs` confere todos no terminal (junto com casos extras das decisões de projeto).

| Caso | Resultado esperado | O que exercita |
|---|---|---|
| V1 · Carro | válido (AST) | Exemplo do enunciado: grupos deslocados, um grupo dentro de outro com rotação, comentário de linha inteira. |
| V2 · Casa | válido (AST) | Cores hexadecimais (maiúsculas e minúsculas), os três atributos em ordens diferentes, palavras com acento, comentário no fim da linha e pontuação sem espaços. |
| V3 · Mínimo | válido (AST) | Zero como número, forma sem estilo e grupo vazio sem modificadores. |
| V4 · Modificadores | válido (AST) | Modificadores repetidos e em qualquer ordem (a AST preserva a ordem) e três níveis de grupos aninhados. |
| V5 · Alvo | válido (AST) | Vários círculos, espessura 0, grupo com dois modificadores e comentários. |
| I1 · Erro léxico | erro léxico | Zero à esquerda, cor fora da lista, palavra-chave com sufixo e hexadecimal inválido. O parser não roda. |
| I2 · Modificador em forma | erro sintático | Rotação só é permitida em grupos: depois do círculo, ROTACIONA não pode começar um item. |
| I3 · Grupo sem fechar | erro sintático | Falta a chave que fecha o grupo; o programa termina antes. |

Cobertura dos elementos da linguagem pelos válidos: tela (todos), reta (V1, V2, V3, V5), círculo (V1, V2, V4, V5), retângulo (V1, V2, V4), traço / preenchimento / espessura (V1, V2, V4, V5), cores por nome e hexadecimais (V2), grupo (V1, V3, V4, V5), grupo dentro de grupo (V1, V4), rotação (V1, V4, V5), deslocamento (V1, V4, V5), comentários (V1, V2, V3, V5), zero (V1, V3, V4, V5).

## V1 · Carro

Exemplo do enunciado: grupos deslocados, um grupo dentro de outro com rotação, comentário de linha inteira.

```
tela 400 por 300
// um carro simples
retangulo (50, 150) 200 por 60 com preenchimento azul
grupo desloca (70, 190) {
    circulo (0, 0) 25 com preenchimento preto
    grupo rotaciona 45 {
        reta (0, 0) (20, 0) com traco branco espessura 2
    }
}
grupo desloca (200, 190) {
    circulo (0, 0) 25 com preenchimento preto
}
```

**Resultado esperado:**

Programa válido. AST:

```json
{
  "tipo": "programa",
  "tela": {
    "tipo": "tela",
    "largura": 400,
    "altura": 300
  },
  "itens": [
    {
      "tipo": "retangulo",
      "x": 50,
      "y": 150,
      "largura": 200,
      "altura": 60,
      "estilo": {
        "preenchimento": "azul"
      }
    },
    {
      "tipo": "grupo",
      "modificadores": [
        {
          "tipo": "deslocamento",
          "dx": 70,
          "dy": 190
        }
      ],
      "itens": [
        {
          "tipo": "circulo",
          "cx": 0,
          "cy": 0,
          "raio": 25,
          "estilo": {
            "preenchimento": "preto"
          }
        },
        {
          "tipo": "grupo",
          "modificadores": [
            {
              "tipo": "rotacao",
              "angulo": 45
            }
          ],
          "itens": [
            {
              "tipo": "reta",
              "x1": 0,
              "y1": 0,
              "x2": 20,
              "y2": 0,
              "estilo": {
                "traco": "branco",
                "espessura": 2
              }
            }
          ]
        }
      ]
    },
    {
      "tipo": "grupo",
      "modificadores": [
        {
          "tipo": "deslocamento",
          "dx": 200,
          "dy": 190
        }
      ],
      "itens": [
        {
          "tipo": "circulo",
          "cx": 0,
          "cy": 0,
          "raio": 25,
          "estilo": {
            "preenchimento": "preto"
          }
        }
      ]
    }
  ]
}
```

## V2 · Casa

Cores hexadecimais (maiúsculas e minúsculas), os três atributos em ordens diferentes, palavras com acento, comentário no fim da linha e pontuação sem espaços.

```
tela 300 por 300 // tela quadrada
retângulo (50, 120) 200 por 150 com espessura 3 traco #4A2C0F preenchimento #F5DEB3
reta (50, 120) (150, 40) com traco vermelho espessura 4
reta(150,40)(250,120)com traco vermelho espessura 4
retangulo (130, 200) 40 por 70 com preenchimento #8b4513
círculo (250, 50) 20 com preenchimento amarelo traço laranja
```

**Resultado esperado:**

Programa válido. AST:

```json
{
  "tipo": "programa",
  "tela": {
    "tipo": "tela",
    "largura": 300,
    "altura": 300
  },
  "itens": [
    {
      "tipo": "retangulo",
      "x": 50,
      "y": 120,
      "largura": 200,
      "altura": 150,
      "estilo": {
        "espessura": 3,
        "traco": "#4A2C0F",
        "preenchimento": "#F5DEB3"
      }
    },
    {
      "tipo": "reta",
      "x1": 50,
      "y1": 120,
      "x2": 150,
      "y2": 40,
      "estilo": {
        "traco": "vermelho",
        "espessura": 4
      }
    },
    {
      "tipo": "reta",
      "x1": 150,
      "y1": 40,
      "x2": 250,
      "y2": 120,
      "estilo": {
        "traco": "vermelho",
        "espessura": 4
      }
    },
    {
      "tipo": "retangulo",
      "x": 130,
      "y": 200,
      "largura": 40,
      "altura": 70,
      "estilo": {
        "preenchimento": "#8b4513"
      }
    },
    {
      "tipo": "circulo",
      "cx": 250,
      "cy": 50,
      "raio": 20,
      "estilo": {
        "preenchimento": "amarelo",
        "traco": "laranja"
      }
    }
  ]
}
```

## V3 · Mínimo

Zero como número, forma sem estilo e grupo vazio sem modificadores.

```
// só a tela é obrigatória
tela 0 por 0
reta (0, 0) (0, 0)
grupo { }
```

**Resultado esperado:**

Programa válido. AST:

```json
{
  "tipo": "programa",
  "tela": {
    "tipo": "tela",
    "largura": 0,
    "altura": 0
  },
  "itens": [
    {
      "tipo": "reta",
      "x1": 0,
      "y1": 0,
      "x2": 0,
      "y2": 0,
      "estilo": {}
    },
    {
      "tipo": "grupo",
      "modificadores": [],
      "itens": []
    }
  ]
}
```

## V4 · Modificadores

Modificadores repetidos e em qualquer ordem (a AST preserva a ordem) e três níveis de grupos aninhados.

```
tela 500 por 500
grupo desloca (250, 250) rotaciona 30 desloca (10, 0) {
    grupo rotaciona 90 {
        grupo {
            retangulo (0, 0) 50 por 50 com traco verde espessura 1
        }
    }
    circulo (0, 0) 5 com preenchimento roxo
}
```

**Resultado esperado:**

Programa válido. AST:

```json
{
  "tipo": "programa",
  "tela": {
    "tipo": "tela",
    "largura": 500,
    "altura": 500
  },
  "itens": [
    {
      "tipo": "grupo",
      "modificadores": [
        {
          "tipo": "deslocamento",
          "dx": 250,
          "dy": 250
        },
        {
          "tipo": "rotacao",
          "angulo": 30
        },
        {
          "tipo": "deslocamento",
          "dx": 10,
          "dy": 0
        }
      ],
      "itens": [
        {
          "tipo": "grupo",
          "modificadores": [
            {
              "tipo": "rotacao",
              "angulo": 90
            }
          ],
          "itens": [
            {
              "tipo": "grupo",
              "modificadores": [],
              "itens": [
                {
                  "tipo": "retangulo",
                  "x": 0,
                  "y": 0,
                  "largura": 50,
                  "altura": 50,
                  "estilo": {
                    "traco": "verde",
                    "espessura": 1
                  }
                }
              ]
            }
          ]
        },
        {
          "tipo": "circulo",
          "cx": 0,
          "cy": 0,
          "raio": 5,
          "estilo": {
            "preenchimento": "roxo"
          }
        }
      ]
    }
  ]
}
```

## V5 · Alvo

Vários círculos, espessura 0, grupo com dois modificadores e comentários.

```
// alvo
tela 200 por 200
circulo (100, 100) 80 com preenchimento vermelho traco preto espessura 1
circulo (100, 100) 60 com preenchimento branco
circulo (100, 100) 40 com preenchimento rosa
circulo (100, 100) 20 com preenchimento branco // centro
grupo rotaciona 0 desloca (0, 0) {
    reta (0, 100) (200, 100) com traco cinza espessura 0
    reta (100, 0) (100, 200) com traco cinza espessura 0
}
```

**Resultado esperado:**

Programa válido. AST:

```json
{
  "tipo": "programa",
  "tela": {
    "tipo": "tela",
    "largura": 200,
    "altura": 200
  },
  "itens": [
    {
      "tipo": "circulo",
      "cx": 100,
      "cy": 100,
      "raio": 80,
      "estilo": {
        "preenchimento": "vermelho",
        "traco": "preto",
        "espessura": 1
      }
    },
    {
      "tipo": "circulo",
      "cx": 100,
      "cy": 100,
      "raio": 60,
      "estilo": {
        "preenchimento": "branco"
      }
    },
    {
      "tipo": "circulo",
      "cx": 100,
      "cy": 100,
      "raio": 40,
      "estilo": {
        "preenchimento": "rosa"
      }
    },
    {
      "tipo": "circulo",
      "cx": 100,
      "cy": 100,
      "raio": 20,
      "estilo": {
        "preenchimento": "branco"
      }
    },
    {
      "tipo": "grupo",
      "modificadores": [
        {
          "tipo": "rotacao",
          "angulo": 0
        },
        {
          "tipo": "deslocamento",
          "dx": 0,
          "dy": 0
        }
      ],
      "itens": [
        {
          "tipo": "reta",
          "x1": 0,
          "y1": 100,
          "x2": 200,
          "y2": 100,
          "estilo": {
            "traco": "cinza",
            "espessura": 0
          }
        },
        {
          "tipo": "reta",
          "x1": 100,
          "y1": 0,
          "x2": 100,
          "y2": 200,
          "estilo": {
            "traco": "cinza",
            "espessura": 0
          }
        }
      ]
    }
  ]
}
```

## I1 · Erro léxico

Zero à esquerda, cor fora da lista, palavra-chave com sufixo e hexadecimal inválido. O parser não roda.

```
tela 400 por 300
circulo (100, 100) 05 com preenchimento azulado
retangulos (0, 0) 10 por 10
reta (0, 0) (10, 10) com traco #12345G
```

**Resultado esperado:**

Erros léxicos (a análise sintática não roda e não há AST):

```
Erro léxico na linha 2: "05" não forma nenhum token
Erro léxico na linha 2: "azulado" não forma nenhum token
Erro léxico na linha 3: "retangulos" não forma nenhum token
Erro léxico na linha 4: "#12345G" não forma nenhum token
```

## I2 · Modificador em forma

Rotação só é permitida em grupos: depois do círculo, ROTACIONA não pode começar um item.

```
tela 200 por 200
circulo (50, 50) 10 rotaciona 45
```

**Resultado esperado:**

Erro sintático (não há AST):

```
Erro sintático na linha 2: esperado RETA, CIRCULO, RETANGULO, GRUPO ou o fim do programa, encontrado ROTACIONA "rotaciona"
```

## I3 · Grupo sem fechar

Falta a chave que fecha o grupo; o programa termina antes.

```
tela 200 por 200
grupo desloca (10, 10) {
    circulo (0, 0) 5 com traco azul
```

**Resultado esperado:**

Erro sintático (não há AST):

```
Erro sintático na linha 3: esperado RETA, CIRCULO, RETANGULO, GRUPO ou FECHA_CHAVE, encontrado o fim do programa
```
