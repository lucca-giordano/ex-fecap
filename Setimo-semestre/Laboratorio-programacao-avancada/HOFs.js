// HOFs servem para facilitar a leitura do código

// forEach() - Passa por todos os elementos e faz algo

filmes = ['Jurassic park', 'Harry Potter', 'Spider man']

filmes.forEach(filme => {
    //*console.log(fi// HOFlme)
});

for (let i = 0; i < filmes.length; i++){
    if(filmes[i] % 2 === 0){
       //*console.log(numeros[i])
    }
}

//some() - Verifica se tem algum elemento que satifaz alguma condição

numerosSome = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const resultadoSome = numerosSome.some(numero => numero > 10)

//*console.log(resultadoSome)

//every() - Verifica se todos os elementos satifazem a condição

numerosEvery = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const resultadoEvery = numerosEvery.every(numero => {
    return numero > 1;
})

//*console.log(resultadoEvery);

// find() - Retorna objeto completo que satisfaz uma condição

const usuarios = [
    {id: 1, nome: 'Vitor'},
    {id: 2, nome: 'Lucca'}
];

const respostaFind = usuarios.find(usuario => usuario.nome.startsWith('V'))

//*console.log(respostaFind)

// filter() - Filtra uma array e retorna todos os elementos que satisfazem a condição

const idades = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

const respostaFilter = idades.filter(idade => idade >= 18)

//*console.log(respostaFilter);

// reduce() - Reduz a array para um só numero

const numerosReduce = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

const respostaReduce = numerosReduce.reduce((acumulador, numero) => acumulador + numero)

//*console.log(respostaReduce)

// map() - Mapeia a array e cria outra com base em uma operação

const precos = [100, 200, 300];

const comDesconto = precos.map(preco => preco * 0.5)

//*console.log(comDesconto)