const {items, levels, categories} = require("./tecnologias");

// EXERCiCIO 01 - Usando filter() e map(), liste os nomes das tecnologias com popularity >= 9

const ex1 = items.filter(item => item.popularity >= 9).map(item => item.name);

//*console.log(ex1)

// EXERCiCIO 02 - Usando filter() e map(), retorne um objeto das tecnologias criadas antes de 2010

const ex2 = items.filter(item => item.year < 2010).map(item => ({name: item.name, year: item.year}))

//*console.log(ex2)

// EXERCiCIO 03 - Usando filter(), map() e find(), retorne um objeto das tecnologias com categoryId === 1

const ex3 = items
            .filter(item => item.categoryId === 1)
            .map(item => ({name: item.name, category: categories
            .find(category => category.id === item.categoryId).name}))

//*console.log(ex3)

// EXERCiCIO 04 - Usando filter() e map(), liste os nomes das tecnologias que não são Programming Language

const ex4 = items.filter(item => item.categoryId !== 1).map(item => item.name)

//*console.log(ex4)

// EXERCiCIO 05 - Usando filter() e map(), liste os nomes das tecnologias cuja descrição contém "JavaScript"

const ex5 = items.filter(item => item.description.includes("JavaScript")).map(item => item.name)

//*console.log(ex5)

// EXERCiCIO 06 - Usando filter() e map(), liste nomes com levelId >= 2 e popularity >= 9

const ex6 = items.filter(item => item.levelId >= 2 && item.popularity >= 9).map(item => item.name)

//*console.log(ex6)

// EXERCiCIO 07 -  Usando some(), filter() e map(), verifique se existe tecnologia com popularity < 7 e retorne as com >= 7

const ex7 = {
    existeLow: items.some(item => item.popularity < 7),
    result: items.filter(item => item.popularity >= 7).map(item => item.name)
}

//*console.log(ex7)

// EXERCiCIO 08 - Usando Every(), filter() e map(), Verifique se todos têm year > 1990 e retorne os nomes
const ex8 = {
    allValid: items.every(item => item.year > 1990),
    result: items.filter(item => item.year > 1990).map(item => item.name)
}

//*console.log(ex8)

// EXERCiCIO 09 - Usando find(), filter() e map(), Liste nomes de tecnologias cuja categoria contém "Tool"
// 1. Passar por todos os elementos
// 2. Pegar o categoryId
// 3. Comparar com o id no objeto categories
// 4. pegar o nome da categoria 
// 5. comparar e ver se tem "Tool"

const ex9 = items.filter(item => {
    const category = categories.find(category => category.id === item.categoryId);
    return category && category.name.includes('Tool')
}).map(item => item.name)

//*console.log(ex9)

// EXERCiCIO 10

const ex10 = items.filter(item => {
    const category = categories.find(category => category.id === item.categoryId);
    return category && category.name.includes('Data') || category.name.includes('Machine')
}).map(item => item.name)

//*console.log(ex10)

// EXERCiCIO 11

const ex11 = items.filter(item => item.id % 2 === 0).map(item => ({id: item.id, name: item.name}))

console.log(ex11)

// EXERCiCIO 12


// EXERCiCIO 13


// EXERCiCIO 14


// EXERCiCIO 15


// EXERCiCIO 16


// EXERCiCIO 17

