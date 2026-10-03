// HOFs - HIGH ORDER FUNCTIONs

// Facilitar o entendimento do código
/* function escreverNome(nome){
    console.log(nome)
}
let destinos = ['Franca', 'Florenza', 'Roma']
// são metodos de arrays/listas

const escreverNomes = (nomes) => {}

escreverNomes() */

// forEach() - paraCada - Executa uma ação para cada item da lista mas nao retorna nada

/* let listaNumeros = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

listaNumeros.forEach(numero => {
    if(numero % 2 === 0){
       // console.log(numero)
    }
}) */

// some() - Algum - Verifica se algum elemento da lista satisfaz alguma condição

/* let listaNumeros = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

let temMaiorQue5 = listaNumeros.some(numero => numero > 5)

console.log(temMaiorQue5) */

// every() - Todos - Verifica se todos os elementos da lista satisfazem alguma condição

/* let listaNumeros = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

let eMaiorQue5 = listaNumeros.every(numero => numero > 1)
console.log(eMaiorQue5) */

// find() - Encontrar - retorna o primeiro elemento que satisfaz uma condição

/* let destinos = ['Franca', 'Florenza', 'Roma']

let comecaComR = destinos.find(destino => destino.startsWith('R'))

let usuarios = [
    {nome: 'Lara', idade: 21},
    {nome: 'Lucca', idade: 22},
    {nome: 'Bia', idade: 23}
]

let comecaComL = usuarios.find(usuario => usuario.nome.startsWith("L"))

console.log(comecaComL) */

// filter() - Filtrar - Retorna todos os elementos que satisfazem uma condição

/* const idades = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]

const maiorDeIdade = idades.filter(idade => idade >= 18)

console.log(maiorDeIdade) */

// reduce() - Reduzir - Reduzir uma lista DE INTEIROS para um só numero INTEIRO

/* const numeros = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 40, 50, 60]

const resultadoReduce = numeros.reduce((acumulador, numero) => {
    
    if(numero % 2  === 0){
        return acumulador + numero
    }

    return acumulador
})

console.log(resultadoReduce) */

// map() - mapeia - Mapeia uma lista e retorna outra com base em uma operação

const precos = [100, 200, 300]

const precosComDescontos = precos.map(preco => preco * 0.6)

console.log(precosComDescontos)