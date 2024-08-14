# Analise e estatistica

## Aula 1 - estatistica descritiva

### O que é uma variável

Uma variável é qualquer caracteristica associada a uma população ou amostra que pode ser medida ou contada. Existem duas grandes classificações para as variáveis, as variáveis qualitativas e as variáveis quantitativas:

- As `variáveis qualitativas`, ou os `fatores` são aquelas que representam uma qualidade, ou seja, uma caracteristica que não pode ser medida, como por exemplo, a cor dos olhos, o sexo, a raça, a religião, etc. Pode ser classificada em nominal e ordinal, sendo que a nominal não possui uma ordem e a ordinal possui uma ordem. 

- As `variáveis quantitativas` são aquelas que representam uma quantidade, ou seja, uma caracteristica que pode ser medida, como por exemplo, a altura, o peso, a idade, etc. Pode ser classificada em discreta e contínua, sendo que a discreta possui valores inteiros e a contínua possui valores reais.

---

### Medidas de posição

As `medidas de posição` são aquelas que representam a posição de um valor em relação aos demais valores de um conjunto de dados. Como exemplo de medidas de posição temos a média, a mediana e a moda.

- A `média` é a soma de todos os valores dividido pela quantidade de valores. É a medida de posição mais comum e é muito sensível a valores extremos.

$$\bar{x} = \frac{\sum_{i=1}^{n} x_i}{n}$$

- A `mediana` é o valor que divide o conjunto de dados em duas partes iguais. Para encontrar a mediana, é necessário ordenar os valores e encontrar o valor do meio. Se a quantidade de valores for par, a mediana é a média dos dois valores do meio.

- A `moda` é o valor que mais se repete no conjunto de dados. Um conjunto de dados pode ter uma moda, mais de uma moda ou não ter moda.

- `Percentis` são medidas de posição que dividem um conjunto de dados em 100 partes iguais. O percentil 50 é a mediana, o percentil 25 é o primeiro quartil e o percentil 75 é o terceiro quartil.

$$ p_i = \frac{i}{100} \times (n+1) $$

---

### Medidas de dispersão

As `medidas de dispersão` são aquelas que representam a dispersão dos valores em relação a média. Como exemplo de medidas de dispersão temos o desvio padrão, a variância, o coeficiente de variação, a amplitude e etc.

- A `variância` é a média dos quadrados dos desvios em relação a média.

$$s^2 = \frac{\sum_{i=1}^{n} (x_i - \bar{x})^2}{n-1}$$

- O `desvio padrão` é a raiz quadrada da variância. Ele é a medida de dispersão mais comum.

$$s = \sqrt{s^2}$$

- O `coeficiente de variação` é o desvio padrão dividido pela média. Ele é uma medida de dispersão relativa e é muito útil para comparar a dispersão de conjuntos de dados diferentes.

$$CV = \frac{s}{\bar{x}} \times 100$$

- A `amplitude` é a diferença entre o maior e o menor valor do conjunto de dados.

---

## Aula 2 - Introdução ao R e representação gráfica

### O que é o R

O R é uma linguagem de programação e ambiente de desenvolvimento para computação estatística e gráficos. Ele é um software livre e de código aberto e é muito utilizado por estatísticos, cientistas de dados e pesquisadores em geral.

Nesse semestre, será utilizado  R Comander, que é uma interface gráfica para o R. Ele é muito útil para quem está começando a aprender R, pois possui uma interface gráfica intuitiva e fácil de usar.

A vantagem de utilizar o R ao invés do Excel é que o R é mais poderoso e flexível, além de ser mais eficiente para lidar com grandes conjuntos de dados. Além disso, o R é gratuito e possui uma comunidade muito ativa, o que facilita a obtenção de ajuda e suporte.

A instalação e a usabilidade dessas ferramentas podem ser encontradas em [Aula2/Documentos](Aula2/Documentos/)

---

### Leitura resumo numérico

Ao realizar um resumo numério com o RComander, é possível obter algumas informações, a forma como você deve interpretar essas informações é:

- `Mean`: é a média dos valores do conjunto de dados da variável selecionada

- `sd`: é o desvio padrão dos valores do conjunto de dados da variável selecionada

- `IQR`: é a amplitude interquartil dos valores do conjunto de dados da variável selecionada

- As porcentagens são os percentis do conjunto de dados da variável selecionada, e o valor maximo que se enquadra em cada percentil

#### Exemplo:

Vamos usar a tabela [CEA2015P01-QV-Demograficos.xlsx](Aula2/Documentos/CEA2015P01-QV-Demograficos.xlsx) para tirar essas conclusões.

Essa tabela é um levantamento de algumas informações de pacientes com cancer de mama, como idade, peso, altura, habitos e etc. 

Fazendo um resumo numérico relacionando o habito de fumar com a idade, temos o seguinte resultado:

|                | mean     | sd       | IQR | 0% | 25% | 50% | 75%  | 100% | Idade:n |
|----------------|----------|----------|-----|----|-----|-----|------|------|---------|
| Não fumante    | 48.42105 | 12.230725| 15.0| 24 | 42  | 50  | 57.0 | 69   | 19      |
| Fumante        | 52.36364 | 8.405626 | 6.5 | 45 | 47  | 49  | 53.5 | 68   | 11      |

É contra intuitivo a média de idade dos pacientes de cancer fumantes ser mais alta que a dos não fumantes, porém observando de forma mais aprofundada, percebe-se que até o terceiro quartil, a idade dos não fumantes é maior que a dos fumantes. 

Isso demonstra que é sempre importante analisar todos os dados e não se basear apenas na média, que pode ser vista como uma forma mais simples de interpretar os dados.