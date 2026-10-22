// Casos de teste: 5 programas válidos e 3 inválidos, com o resultado esperado.
// Usado pela página (menu de exemplos) e pelo testes.mjs (node testes.mjs).
// esperado é um destes: { ast }, { errosLexicos: [{ linha, lexema }] }
// ou { erroSintatico: { linha, esperado, encontrado } }.

export const casos = [
    {
        nome: "V1 · Carro",
        valido: true,
        descricao: "Exemplo do enunciado: grupos deslocados, um grupo dentro de outro com rotação, comentário de linha inteira.",
        programa: `tela 400 por 300
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
}`,
        esperado: {
            "ast": {
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
        },
    },
    {
        nome: "V2 · Casa",
        valido: true,
        descricao: "Cores hexadecimais (maiúsculas e minúsculas), os três atributos em ordens diferentes, palavras com acento, comentário no fim da linha e pontuação sem espaços.",
        programa: `tela 300 por 300 // tela quadrada
retângulo (50, 120) 200 por 150 com espessura 3 traco #4A2C0F preenchimento #F5DEB3
reta (50, 120) (150, 40) com traco vermelho espessura 4
reta(150,40)(250,120)com traco vermelho espessura 4
retangulo (130, 200) 40 por 70 com preenchimento #8b4513
círculo (250, 50) 20 com preenchimento amarelo traço laranja`,
        esperado: {
            "ast": {
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
        },
    },
    {
        nome: "V3 · Mínimo",
        valido: true,
        descricao: "Zero como número, forma sem estilo e grupo vazio sem modificadores.",
        programa: `// só a tela é obrigatória
tela 0 por 0
reta (0, 0) (0, 0)
grupo { }`,
        esperado: {
            "ast": {
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
        },
    },
    {
        nome: "V4 · Modificadores",
        valido: true,
        descricao: "Modificadores repetidos e em qualquer ordem (a AST preserva a ordem) e três níveis de grupos aninhados.",
        programa: `tela 500 por 500
grupo desloca (250, 250) rotaciona 30 desloca (10, 0) {
    grupo rotaciona 90 {
        grupo {
            retangulo (0, 0) 50 por 50 com traco verde espessura 1
        }
    }
    circulo (0, 0) 5 com preenchimento roxo
}`,
        esperado: {
            "ast": {
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
        },
    },
    {
        nome: "V5 · Alvo",
        valido: true,
        descricao: "Vários círculos, espessura 0, grupo com dois modificadores e comentários.",
        programa: `// alvo
tela 200 por 200
circulo (100, 100) 80 com preenchimento vermelho traco preto espessura 1
circulo (100, 100) 60 com preenchimento branco
circulo (100, 100) 40 com preenchimento rosa
circulo (100, 100) 20 com preenchimento branco // centro
grupo rotaciona 0 desloca (0, 0) {
    reta (0, 100) (200, 100) com traco cinza espessura 0
    reta (100, 0) (100, 200) com traco cinza espessura 0
}`,
        esperado: {
            "ast": {
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
        },
    },
    {
        nome: "I1 · Erro léxico",
        valido: false,
        descricao: "Zero à esquerda, cor fora da lista, palavra-chave com sufixo e hexadecimal inválido. O parser não roda.",
        programa: `tela 400 por 300
circulo (100, 100) 05 com preenchimento azulado
retangulos (0, 0) 10 por 10
reta (0, 0) (10, 10) com traco #12345G`,
        esperado: {
            "errosLexicos": [
                {
                    "linha": 2,
                    "lexema": "05"
                },
                {
                    "linha": 2,
                    "lexema": "azulado"
                },
                {
                    "linha": 3,
                    "lexema": "retangulos"
                },
                {
                    "linha": 4,
                    "lexema": "#12345G"
                }
            ]
        },
    },
    {
        nome: "I2 · Modificador em forma",
        valido: false,
        descricao: "Rotação só é permitida em grupos: depois do círculo, ROTACIONA não pode começar um item.",
        programa: `tela 200 por 200
circulo (50, 50) 10 rotaciona 45`,
        esperado: {
            "erroSintatico": {
                "linha": 2,
                "esperado": "RETA, CIRCULO, RETANGULO, GRUPO ou o fim do programa",
                "encontrado": "ROTACIONA \"rotaciona\""
            }
        },
    },
    {
        nome: "I3 · Grupo sem fechar",
        valido: false,
        descricao: "Falta a chave que fecha o grupo; o programa termina antes.",
        programa: `tela 200 por 200
grupo desloca (10, 10) {
    circulo (0, 0) 5 com traco azul`,
        esperado: {
            "erroSintatico": {
                "linha": 3,
                "esperado": "RETA, CIRCULO, RETANGULO, GRUPO ou FECHA_CHAVE",
                "encontrado": "o fim do programa"
            }
        },
    },
];
