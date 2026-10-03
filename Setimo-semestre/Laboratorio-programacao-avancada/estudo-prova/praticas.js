// Boa práticas

// Garantir que seu código tem qualidade, garantir que outras pessoas consigam ler e entender seu código em qualquer momento

// 1. Nomenclatura - Nomes devem ser descritivos

let objetoUsuario = {
    nome: 'lara',
    idade: 21
}

let obUsu = {
    n: 'lara',
    i: 21
}

// 2. Escopo de função - Metódos ou funções devem fazer APENAS uma coisa

let senha = '12346'
let senhaCorreta = '12345'

function verificarSenhaDoUsuario(senha, senhaCorreta){
    //! salvarCookiesDaSessao() - Errado
    return senha == senhaCorreta
}

// 3. Efeitos colaterais - funções alteram algum estado fora do seu escopo local
// Não é necessariamente ruim, em muitos casos são necessários, mas precisa ficar esperto

let destinos = ['Disney', 'Paris', 'Italia', 'Franca', 'Florenza', 'Roma']

function listarDestinos(){
    destinos.push('California')
    for (let i = 0; i < destinos.length; i++){
        console.log(destinos[i])
    }
}

listarDestinos()
console.log(destinos)


// 4. DRY - Don't Repeat Yourself - NAO SE REPITA

let nome = 'lara'

function cumprimentarLara(){
    console.log('Boa semana', nome)
    console.log('Boa noite', nome)
    console.log('Boa tarde', nome)
    console.log('Bom trabalho', nome)
}

//cumprimentarLara();
//cumprimentarLara();
//cumprimentarLara();
