const {items, categories, platforms} = require("./jogos")

// EXERCÍCIO 01 - Usando filter() e map(), liste apenas os títulos dos jogos que possuem rating igual a 10
// Resposta: [ 'The Witcher 3', 'Elden Ring', 'Stardew Valley' ]

const ex1 = items.filter(item => item.rating === 10).map(item => item.title)

// EXERCÍCIO 02 - Usando filter() e map(), liste os títulos dos jogos lançados a partir de 2022
// Resposta: [ 'Counter-Strike 2', 'Elden Ring', 'FIFA 23', 'Street Fighter 6' ]

const ex2 = items.filter(item => item.releaseYear >= 2022).map(item => item.title)



// EXERCÍCIO 03 - Usando filter() e map(), retorne um objeto apenas com o título e as vendas dos jogos puramente offline
/* Resposta:
[
  { title: 'The Witcher 3', salesMillions: 50 },
  { title: 'Cyberpunk 2077', salesMillions: 20 },
  { title: 'Hades', salesMillions: 6 }
]
*/
const ex3 = items.filter(item => item.online === false).map(item => ({title: item.title, salesMillions:item.salesMillions}))

// EXERCÍCIO 04 - Usando filter() e map(), liste os IDs dos jogos que venderam mais de 25 milhões de cópias
// Resposta: [ 1, 2, 4, 8 ]

const ex4 = items.filter(item => item.salesMillions > 25).map(item => item.id)

// EXERCÍCIO 05 - Usando filter() e map(), traga os títulos dos jogos que possuem a tag 'Competitive'
// Resposta: [ 'Counter-Strike 2', 'Valorant', 'League of Legends', 'Street Fighter 6' ]

const ex5 = items.filter(item => item.tags.includes("Competitive")).map(item => item.title)

// EXERCÍCIO 06 - Usando filter() e map(), traga os jogos cujo título tenha mais de 10 caracteres (retorne objeto com title e tamanho do texto)
/* Resposta:
[
  { title: 'The Witcher 3', length: 13 },
  { title: 'Counter-Strike 2', length: 16 },
  { title: 'Cyberpunk 2077', length: 14 },
  { title: 'Stardew Valley', length: 14 },
  { title: 'League of Legends', length: 17 },
  { title: 'Street Fighter 6', length: 16 }
]
*/

const ex6 = items.filter(item => item.title.length > 10).map(item => ({title: item.title, lenght: item.title.length}));

// EXERCÍCIO 07 - Usando filter() e map(), liste os títulos dos jogos que NÃO pertencem à plataforma com ID 1
// Resposta: [ 'Elden Ring', 'FIFA 23', 'Hades', 'Stardew Valley', 'Street Fighter 6' ]

const ex7 = items.filter(item => item.platformId !== 1).map(item => item.title)

// EXERCÍCIO 08 - Usando filter() e map(), liste os títulos dos jogos que são Free-to-Play (vendas iguais a 0) e online ao mesmo tempo
// Resposta: [ 'Valorant', 'League of Legends' ]

const ex8 = items.filter(item => item.salesMillions === 0 && item.online === true).map(item => item.title)



// EXERCÍCIO 09 - Usando filter() e map(), filtre os jogos lançados entre 2015 e 2020 (inclusive) e retorne strings formatadas: "Título [Ano]"
// Resposta: [ 'The Witcher 3 [2015]', 'Cyberpunk 2077 [2020]', 'Hades [2020]', 'Valorant [2020]', 'Stardew Valley [2016]' ]

const ex9 = items.filter(item => item.releaseYear >= 2015 && item.releaseYear <= 2020).map(item => `${item.title} [${item.releaseYear}]`)

// EXERCÍCIO 10 - Usando filter() e map(), retorne o título convertido para letras maiúsculas de todos os jogos com rating menor ou igual a 8
// Resposta: [ 'CYBERPUNK 2077', 'FIFA 23', 'VALORANT', 'LEAGUE OF LEGENDS' ]

const ex10 = items.filter(item => item.rating <= 8).map(item => item.title.toUpperCase())

// EXERCÍCIO 11 - Usando filter() e map(), retorne um objeto estruturado contendo {gameId, tagsCount} apenas para jogos com mais de 2 tags
/* Resposta:
[
  { gameId: 1, tagsCount: 3 },
  { gameId: 2, tagsCount: 3 },
  { gameId: 3, tagsCount: 3 },
  { gameId: 4, tagsCount: 3 },
  ...
]
*/
const ex11 = items.filter(item => item.tags.length > 2).map(item => ({gameId: item.id, tagsCount: item.tags.length}))


// EXERCÍCIO 12 - Usando filter() e map(), retorne apenas a primeira tag de cada jogo cujo rating seja maior ou igual a 9
// Resposta: [ 'RPG', 'FPS', 'RPG', 'Rogue-like', 'Farming', 'Fighting' ]

const ex12 = items.filter(item => item.rating >= 9).map(item => item.tags[0])

// EXERCÍCIO 13 - Usando some() e filter(), verifique se há jogos de antes de 2010 e liste os nomes dos jogos que atendem ao critério
/* Resposta:
{
  hasOldGames: true,
  titles: [ 'League of Legends' ]
}
*/

const ex13 = {
    hasOldGames: items.some(item => item.releaseYear < 2010),
    titles: items.filter(item => item.releaseYear < 2010).map(item => item.title)
}



// EXERCÍCIO 14 - Usando every(), cheque se TODOS os jogos cadastrados possuem pelo menos 1 milhão de cópias vendidas ou se são gratuitos (sales >= 0)
// Resposta: true
const ex14 = items.every(item => item.salesMillions >= 0)



// EXERCÍCIO 15 - Usando find(), retorne o objeto completo da categoria cujo ID está atrelado ao jogo "Valorant"
// Resposta: { id: 2, name: 'Shooter' }

const ex15 = categories.find(category => category.id === items.find(item => item.title === 'Valorant').categoryId)

// EXERCÍCIO 16 - Usando filter(), map() e find(), liste os títulos dos jogos acompanhados do nome legível da sua Plataforma
/* Resposta:
[
  { title: 'The Witcher 3', platform: 'PC Only' },
  { title: 'Elden Ring', platform: 'Cross-Platform' },
  ...
]
*/

const ex16 = items.filter(item => {
    const platform = platforms.find(pla => pla.id === item.platformId);
    return platform.name
}).map(item => ({title: item.title, platform: platform.name}))


// EXERCÍCIO 17 - Usando find() dentro de um filter(), encontre todos os jogos que pertencem à categoria "RPG"
// Resposta: [ 'The Witcher 3', 'Elden Ring', 'Cyberpunk 2077' ]

const ex17 = items.filter(item => item.categoryId === categories.find(category => category.name === "RPG").id).map(item => item.title)

// EXERCÍCIO 18 - Usando filter(), find() e map(), selecione os jogos que rodam na plataforma "Cross-Platform" e tenham rating superior a 8
// Resposta: [ 'Elden Ring' ]

const ex18 = items.filter(item => {
    const platform = platforms.find(plat => plat.id === item.platformId);
    return platform.name === 'Cross-Platform' && item.rating > 8;
}).map(item => item.title)

// EXERCÍCIO 19 - Usando forEach(), preencha um array externo com strings no modelo "Jogo: X | Vendas: YM" apenas se o jogo vendeu acima de 20 milhões
// Resposta: [ 'Jogo: The Witcher 3 | Vendas: 50M', 'Jogo: Counter-Strike 2 | Vendas: 40M', 'Jogo: Stardew Valley | Vendas: 30M' ]


// EXERCÍCIO 20 - Usando some() e find(), descubra se existe algum jogo na plataforma "PC Only" avaliado com nota menor que 8
// Resposta: false

const ex20 = items.some(item => {
    const platform = platforms.find(plat => plat.id === item.platformId);
    return platform.name === 'PC Only' && item.rating < 8;
})
    
// EXERCÍCIO 21 - Usando every() e filter(), avalie se todos os jogos com a tag 'Open World' são estritamente jogos offline
// Resposta: false (Elden Ring quebrou a regra)

const ex21 = items.filter(item => item.tags.includes('Open World')).every(item => item.online === false)

// EXERCÍCIO 22 - Usando find() e map(), monte uma lista de objetos contendo o ID do jogo e o nome da Categoria, pulando os que não possuem dados válidos
/* Resposta:
[
  { title: 'The Witcher 3', categoryName: 'RPG' },
  { title: 'Counter-Strike 2', categoryName: 'Shooter' },
  ...
]
*/
const ex22 = title


// EXERCÍCIO 23 - Usando filter() e map(), liste os nomes de categorias presentes no sistema que possuem jogos lançados no ano de 2020
// Resposta: [ 'RPG', 'Action Rogue-like', 'Shooter' ]


const categories2020 = items.filter(item => item.releaseYear === 2020).map(item => {
    return categories.find(category => category.id === item.categoryId).name
})
const ex23 = [...new Set(categories2020)]


// EXERCÍCIO 24 - Usando forEach() e find(), mapeie e popule uma lista contendo a string "O jogo X é exclusivo ou focado em Y" (onde Y é o nome da plataforma)
/* Resposta: 
[
  'O jogo The Witcher 3 é exclusivo ou focado em PC Only',
  'O jogo Counter-Strike 2 é exclusivo ou focado em PC Only', ...
]
*/



//console.log(ex13)
console.log(ex16)

