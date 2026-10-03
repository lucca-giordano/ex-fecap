// Interagir com o JSON

const fs = require("fs");

const filePath = "./data/users.json";

// Ler o arquivo
const loadUserFromFile = () => {
    try{
        const fileContent = fs.readFileSync(filePath);
        return JSON.parse(fileContent);
    } catch (error) {
        console.log('Deu erro');
        return [];
    }
}

// Salvar no arquivo
const saveUserOnFile = (usersList) => {
    const saveUser = JSON.stringify(usersList, null, 2);
    fs.writeFileSync(filePath, saveUser);
}

// Exportar funções
module.exports = {
    loadUserFromFile,
    saveUserOnFile
}