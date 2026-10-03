// Qualidade de código

destinos = ['Paris', 'Disney', 'Roma', 'California'];

for (let destino = 0; destino < destinos.length; destino++){
    //console.log(destinos[destino]);
}

function f(x, y){
    return x * y;
}

function multiplicar(num1, num2){
    return num1 * num2;
}

// Escrever um código que qualquer um possa entender

// 1. O nome deve descrever a função

//function nomearCampoDoJogador
//function nomearCDJ 

// 2. Escopo da função

nomeUsuario = "vitor";
senhaUsuario = "123";

function autenticarUsuario(nome, senha){ // Função deve fazer apenas UMA coisa 
    if (nome == nomeUsuario){
        if(senha == senhaUsuario){
            return true
            // salvarCookies - Foge do escopo nomeado pela função
        }
    }

    return false
}

//console.log(autenticarUsuario("vitor", "123"));

// 3. Efeitos colaterais - função altera valores fora do seu escopo

nomes = ['vitor', 'lucca', 'gustavo'];

function addNome(nome){
    nomes.push(nome)
}

addNome("Lara");
//console.log(nomes)

// DRY
