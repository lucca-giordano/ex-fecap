# Estudos NI

![Java logo](https://www.stickersdevs.com.br/wp-content/uploads/2022/01/java-adesivo-sticker.png)

## Paradigmas de Programação

Paradigmas de programação são formas de classificar as linguagens de programação de acordo com suas características. Cada paradigma tem suas próprias regras e formas de programar, e cada um deles tem suas vantagens e desvantagens.

- **Imperativo**
- **Funcional**
- **Lógico**
- **Estuturado**
- **Orientado a Objetos**

## Programação Orientada a Objetos

A programação orientada a objetos é um paradigma de programação que utiliza objetos para estruturar um programa. Cada objeto é uma instância de uma classe, e as classes definem os atributos e métodos dos objetos.

Essa metodologia é baseada em "objetos do mundo real", que possuem características e comportamentos. Por exemplo, um carro é um objeto que tem características como cor, modelo e ano, e comportamentos como acelerar, frear e virar.

No caso de um carro, a classe seria a definição do que é um carro, e o objeto seria uma instância dessa classe, ou seja, um carro específico, com suas características e comportamentos, que são seus atributos e métodos.

### Exemplo de Classe em Java

```java
public class Carro {
    // Atributos
    private String cor;
    private String modelo;
    private int ano;

    // Construtor
    public Carro(String cor, String modelo, int ano) {
        this.cor = cor;
        this.modelo = modelo;
        this.ano = ano;
    }

    // Métodos
    public void acelerar() { 
        System.out.println("Acelerando...");
    }

    public void frear() {
        System.out.println("Freando...");
    }

    public void virar() {
        System.out.println("Virando...");
    }
}
```

### O que são atributos, métodos e construtores?

- **Atributos**: São as características do objeto, como cor, modelo e ano no exemplo do carro.
- **Métodos**: São os comportamentos do objeto, como acelerar, frear e virar no exemplo do carro.
- **Construtores**: São métodos especiais que são chamados quando um objeto é criado. Eles são usados para inicializar os atributos do objeto.

### Exemplo de Uso da Classe Carro

```java
// Criando um objeto da classe Carro
Carro carro1 = new Carro("vermelho", "Fusca", 1970);

// Usando os métodos do objeto
meuCarro.acelerar();
meuCarro.frear();
meuCarro.virar();

// Acessando os atributos do objeto
System.out.println("Cor: " + carro1.cor);
System.out.println("Modelo: " + carro1.modelo);
System.out.println("Ano: " + carro1.ano);
```

### Herança em Java

A herança é um conceito importante da programação orientada a objetos que permite que uma classe herde atributos e métodos de outra classe. Isso permite reutilizar código e criar uma hierarquia de classes.

```java
public class Veiculo{
    private String cor;
    private String modelo;
    private int ano;
}

public class Carro extends Veiculo {
    private int portas;
}

public class Moto extends Veiculo {
    private int cilindradas;
}
```

Da mesma forma que um carro é um veículo e uma moto é um veículo, a classe Carro e a classe Moto herdam os atributos e métodos da classe Veiculo, e adicionam seus próprios atributos e métodos.

Dessa forma, instanciando um objeto do tipo Carro, podemos atribuir valores aos atributos cor, modelo e ano, que são herdados da classe Veiculo, e ao atributo portas, que é específico da classe Carro. O mesmo vale para a classe Moto, com o atributo cilindradas.

### Encapsulamento em Java

O encapsulamento é um conceito importante da programação orientada a objetos que consiste em esconder os detalhes de implementação de uma classe e expor apenas a interface pública.

Isso é feito utilizando modificadores de acesso, para controlar o acesso aos atributos e métodos de uma classe. Os principais modificadores de acesso em Java são:

- **public**: Acesso irrestrito, pode ser acessado de qualquer lugar.
- **protected**: Acesso restrito ao pacote e às subclasses.
- **default**: Acesso restrito ao pacote.
- **private**: Acesso restrito à classe.

```java
public class Pessoa{
    public String nome;
    protected int idade;
    private float salario;
}

### Método Get e Set

Para acessar e modificar os atributos de uma classe encapsulada, é comum utilizar métodos chamados de getters e setters.

```java
public class Pessoa{
    private String nome;

    public String getNome(){
        return nome;
    }

    public void setNome(String nome){
        this.nome = nome;
    }
}
```

Dessa forma, é possível acessar e modificar o atributo nome de uma instância da classe Pessoa de forma controlada, garantindo o encapsulamento.

### Static

O modificador static é utilizado em Java para criar membros de classe, ou seja, atributos e métodos que pertencem à classe em si, e não a uma instância específica da classe.

```java
public class Contador{
    private static int count = 0;

    public Contador(){
        count++;
    }

    public static int getCount(){
        return count;
    }
}
```

Nesse exemplo, a variável count é um atributo estático da classe Contador, e o método getCount é um método estático que retorna o valor de count. Dessa forma, podemos acessar o valor de count sem precisar criar uma instância da classe Contador.

### Abstract

O modificador abstract é utilizado em Java para criar classes e métodos abstratos, que não podem ser instanciados diretamente, mas podem ser estendidos e implementados por outras classes.

```java
public abstract class Animal{
    public abstract void emitirSom(
        System.out.println("Au au!");
    );
}

public class Cachorro extends Animal{
}

public class Main{
    public static void main(String[] args){
        Cachorro cachorro = new Cachorro();
        cachorro.emitirSom();
    }
}
```

Nesse exemplo, a classe Animal é uma classe abstrata que possui um método abstrato emitirSom. A classe Cachorro estende a classe Animal e implementa o método emitirSom, que imprime o som "Au au!".

### Interface

Uma interface é um tipo de referência similar a uma classe que pode conter apenas constantes, métodos abstratos, métodos default e métodos estáticos. Não pode conter construtores.

```java
public interface Animal{
    void emitirSom();
}

public class Cachorro implements Animal{

    @Override
    public void emitirSom(){
        System.out.println("Au au!");
    }
}
```

A diferença entre uma interface e uma classe abstrata é que uma classe abstrata pode conter métodos concretos, enquanto uma interface só pode conter métodos abstratos. Uma classe pode implementar várias interfaces, mas só pode herdar de uma classe abstrata.

### Polimorfismo

O polimorfismo é um conceito importante da programação orientada a objetos que permite que um objeto seja tratado de várias formas, dependendo do contexto em que é utilizado.

```java
public class Animal{
    public void emitirSom(){
        System.out.println("Som do animal");
    }
}

public class Cachorro extends Animal{
    @Override
    public void emitirSom(){
        System.out.println("Au au!");
    }
}

public class Gato extends Animal{
    @Override
    public void emitirSom(){
        System.out.println("Miau!");
    }
}

public class Main{
    public static void main(String[] args){
        Animal animal1 = new Cachorro();
        Animal animal2 = new Gato();

        animal1.emitirSom();
        animal2.emitirSom();
    }
}
```

Nesse exemplo, as classes Cachorro e Gato estendem a classe Animal e sobrescrevem o método emitirSom. Na classe Main, criamos objetos do tipo Animal que são instâncias das classes Cachorro e Gato, e chamamos o método emitirSom. O polimorfismo permite que o método emitirSom seja executado de acordo com o tipo do objeto em tempo de execução.

## Estrutura de Dados

Estrutura de Dados refere-se a maneiras organizadas de armazenar, gerenciar e manipular informações para facilitar o acesso e aumentar a eficiência de operações.

### O que são dados

Dados são fatos brutos que descrevem o mundo físico ou virtual. Eles podem ser números, palavras, imagens, sons, etc. Se referem a informações que podem ser armazenadas e processadas por computadores. Dessa forma, para lidar com isso de forma eficiente, existem as estruturas de dados, como por exemplo:

- **Arrays**, que são coleções de elementos do mesmo tipo acessados por um índice.
- **Listas**, que são coleções de elementos acessados por posição.
- **Stacks**, que são coleções de elementos acessados por LIFO (Last In, First Out).
- **Queues**, que são coleções de elementos acessados por FIFO (First In, First Out).
- **Trees**, que são estruturas hierárquicas de elementos.
- **Graphs**, que são estruturas de elementos conectados por arestas.
- **Hash Tables**, que são estruturas de dados que mapeiam chaves a valores.

### Análise de Algoritmos

A análise de algoritmos é o estudo da eficiência dos algoritmos em termos de tempo e espaço. Ela envolve a análise do tempo de execução de um algoritmo em função do tamanho da entrada, bem como a análise do espaço de memória utilizado pelo algoritmo.

### Complexidade de Tempo

A complexidade de tempo de um algoritmo é uma medida do tempo de execução do algoritmo em função do tamanho da entrada. Ela é geralmente expressa em termos de notação assintótica, como O(n), onde n é o tamanho da entrada.

```java

long inicio = System.currentTimeMillis();

int n = 1000;
for (int i = 0; i < n; i++) {
    System.out.println(i);
}

long fim = System.currentTimeMillis();

long tempo = fim - inicio;

System.out.println("Tempo de execução: " + tempo + "ms");
```

Nesse exemplo, medimos o tempo de execução de um loop que imprime os números de 0 a 999. O tempo de execução é medido em milissegundos e pode variar de acordo com o hardware e o ambiente de execução.

### Complexidade de Espaço

A complexidade de espaço de um algoritmo é uma medida do espaço de memória utilizado pelo algoritmo em função do tamanho da entrada. Ela é geralmente expressa em termos de notação assintótica, como O(n), onde n é o tamanho da entrada.

```java
int n = 1000;
int[] array = new int[n];

for (int i = 0; i < n; i++) {
    array[i] = i;
}

int bits = array.length * Integer.SIZE;
int bytes = array.length * Integer.BYTES;

System.out.println("Quantidade de bits: " + bits);
System.out.println("Quantidade de bytes: " + bytes);
```

Nesse exemplo, criamos um array de inteiros com 1000 elementos e medimos o espaço de memória utilizado pelo array. O tamanho do array é 1000, o que significa que ele ocupa 1000 * 4 bytes (tamanho de um inteiro) de memória.

### Notação Assintótica

A notação assintótica é uma forma de descrever o comportamento de uma função à medida que o tamanho da entrada cresce indefinidamente. Ela é usada para analisar a complexidade de tempo e espaço dos algoritmos.

- **O(1)**: Complexidade constante, o tempo de execução não depende do tamanho da entrada.
- **O(log n)**: Complexidade logarítmica, o tempo de execução cresce logaritmicamente com o tamanho da entrada.
- **O(n)**: Complexidade linear, o tempo de execução cresce linearmente com o tamanho da entrada.
- **O(n log n)**: Complexidade linearítmica, o tempo de execução cresce linearmente multiplicado pelo logaritmo do tamanho da entrada.
- **O(n^2)**: Complexidade quadrática, o tempo de execução cresce quadráticamente com o tamanho da entrada.
- **O(2^n)**: Complexidade exponencial, o tempo de execução cresce exponencialmente com o tamanho da entrada.
- **O(n!)**: Complexidade fatorial, o tempo de execução cresce fatorialmente com o tamanho da entrada.

![Big O Notation](https://paper-attachments.dropbox.com/s_2D428973624E7FC84C7D69D11421DE762BEA6B6F3361231FCDCAE0425D14526F_1664885448372_Untitled.drawio+17.png)

### Algoritmos de Ordenação
