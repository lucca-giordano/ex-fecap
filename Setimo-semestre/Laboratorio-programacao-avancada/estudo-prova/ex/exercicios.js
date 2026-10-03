const {items, levels, categories} = require('./tecnologias')

// EXERCÍCIO 01 - Usando filter() e map(), liste os nomes das tecnologias com popularity >= 9
// filter: retorna somente os elementos com pop >= 9
// map: substituir os objetos somente pelos seus nomes

const ex1 = items.filter(item => item.popularity >= 9).map(item => item.name)

// EXERCÍCIO 02 - Usando filter() e map(), retorne um objeto das tecnologias criadas antes de 2010
/* Resposta:
[
  { name: 'JavaScript', year: 1995 },
  { name: 'Python', year: 1991 },
  { name: 'Node.js', year: 2009 },
  { name: 'PostgreSQL', year: 1996 },
  { name: 'AWS', year: 2006 },
  { name: 'Git', year: 2005 }
]
*/
const ex2 = items.filter(item => item.year < 2010).map(item => ({name: item.name, year: item.year}))

// EXERCÍCIO 03 - Usando filter(), map() e find(), retorne um objeto das tecnologias com categoryId === 1
/* Resposta:
[
  { name: 'JavaScript', category: 'Programming Language' },
  { name: 'Python', category: 'Programming Language' },
  { name: 'TypeScript', category: 'Programming Language' }
]
*/

const ex3 = items
            .filter(item => item.categoryId === 1)
            .map(item => ({
                name: item.name,
                category: categories.find(category => category.id === item.categoryId).name
            }))

// EXERCÍCIO 04 - Usando filter() e map(), liste os nomes das tecnologias que não são Programming Language
// Resposta: [ 'React', 'Node.js', 'Docker', 'PostgreSQL', 'TensorFlow', 'AWS', 'Git' ]

const ex4 = items
            .filter(item => item.categoryId !== 1)
            .map(item => item.name)

// EXERCÍCIO 05 - Usando filter() e map(), liste os nomes das tecnologias cuja descrição contém "JavaScript"
// Resposta: [ 'React', 'Node.js', 'TypeScript' ]

const ex5 = items.filter(item => item.description.includes('JavaScript')).map(item => item.name)

// EXERCÍCIO 06 - Usando filter() e map(), liste nomes com levelId >= 2 e popularity >= 9
// Resposta: [ 'React', 'Node.js', 'TypeScript', 'AWS' ]

const ex6 = items.filter(item => item.levelId >= 2 && item.popularity >= 9).map(item => item.name)

// EXERCÍCIO 07 - Usando some(), filter() e map(), verifique se existe tecnologia com popularity < 7 e retorne as com >= 7
/* Resposta:
{
  existeLow: false,
  result: [ 'JavaScript', 'Python', 'React', 'Node.js', 'Docker', 'PostgreSQL', 'TensorFlow', 'TypeScript', 'AWS', 'Git' ]
}
*/

const ex7 = {
    existeLow: items.some(item => item.popularity < 7),
    result: items.filter(item => item.popularity >= 7).map(item => item.name)
}

// EXERCÍCIO 08 - Usando every(), filter() e map(), verifique se todos têm year > 1990 e retorne os nomes
/* Resposta:
{
  allValid: true,
  result: [ 'JavaScript', 'Python', 'React', 'Node.js', 'Docker', 'PostgreSQL', 'TensorFlow', 'TypeScript', 'AWS', 'Git' ]
}
*/

const ex8 = {
    allValid: items.every(item => item.year > 1990),
    result: items.filter(item => item.year > 1990).map(item => item.name)
}

// EXERCÍCIO 09 - Usando find(), filter() e map(), liste nomes de tecnologias cuja categoria contém "Tool"
// Resposta: [ 'Docker' ]

const ex9 = items.filter(item => {
    const category = categories.find(category => category.id === item.categoryId);
    return category.name.includes('Tool');
}).map(item => item.name)

// EXERCÍCIO 10 - Usando find(), filter() e map(), liste nomes de tecnologias que sejam de "Database" ou "Machine Learning"
// Resposta: [ 'PostgreSQL', 'TensorFlow' ]

const ex10 = items.filter(item => {
    const category = categories.find(category => category.id === item.categoryId)
    return category.name.includes('Database') || category.name.includes('Machine Learning')
}).map(item => item.name)

// EXERCÍCIO 11 - Usando filter() e map(), retorne o id e nome apenas das tecnologias com ID par
/* Resposta:
[
  { id: 2, name: 'Python' },
  { id: 4, name: 'Node.js' },
  { id: 6, name: 'PostgreSQL' },
  { id: 8, name: 'TypeScript' },
  { id: 10, name: 'Git' }
]
*/

const ex11 = items.filter(item => item.id % 2 === 0).map(item => ({id: item.id, name: item.name}))

// EXERCÍCIO 12 - Usando forEach(), crie um array de strings no formato "Tecnologia (Ano)" apenas para os de nível "Beginner Friendly"
// Resposta: [ 'JavaScript (1995)', 'Python (1991)', 'Git (2005)' ]

const ex12 = []
items.forEach(item => {
    const level = levels.find(level => level.id === item.levelId)
    if(level.name === 'Beginner Friendly'){
        ex12.push(`${item.name} (${item.year})`)
    }
})

// EXERCÍCIO 13 - Usando reduce(), calcule a média de popularidade de todas as tecnologias
// Resposta: 9

const ex13 = items.reduce((acumulador, item) => acumulador + item.popularity, 0) / items.length

// EXERCÍCIO 14 - Usando reduce() e find(), monte um objeto que agrupe o nome das tecnologias por seus níveis (levels)
/* Resposta:
{
  'Beginner Friendly': [ 'JavaScript', 'Python', 'Git' ],
  Intermediate: [ 'React', 'Node.js', 'PostgreSQL', 'TypeScript' ],
  Advanced: [ 'Docker', 'AWS' ],
  Expert: [ 'TensorFlow' ]
}
*/

const ex14 = items.reduce((acumulador, item) => {
    const nivelNome = levels.find(level => level.id  === item.levelId).name;
    if(!acumulador[nivelNome]){
        acumulador[nivelNome] = []
    }
    acumulador[nivelNome].push(item.name);
    return acumulador
}, {})

console.log(ex14)