// Validar os dados

// Classe do erro
class ValidationError extends Error {
    constructor (errorMessage){
        super(errorMessage);
        this.name = "Erro de validação"
    }
}

// Função que valida o usuario
const userDataValidator = (user) => {
    if(!user.name){
        throw new ValidationError("Nome não encontrado");
    }

    else if(!user.email){
        throw new ValidationError("Email não encontrado");
    }

    return true
}

module.exports = userDataValidator;