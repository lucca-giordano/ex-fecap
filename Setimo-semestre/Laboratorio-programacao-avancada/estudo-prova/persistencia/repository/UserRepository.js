// Interagir com o Persistance, indicando o que deve ser salvo e o que deve ser carregado

const { loadUserFromFile, saveUserOnFile } = require("../services/Persistance");
const userDataValidator = require("../validators/UserValidator")

class UserRepository {
    constructor(){
        this.userList = loadUserFromFile();
    }

    listAllUsers() {
        return this.userList;
    }

    addNewUser(newUser){
        userDataValidator(newUser);
        this.userList.push(newUser);
        saveUserOnFile(this.userList);
    }
}

module.exports = UserRepository;