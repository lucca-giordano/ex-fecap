const UserRepository = require("./repository/UserRepository");

const userRepository = new UserRepository();

user = { 
    name: 'Lara Marina',
    email: 'larafecapbr'
}

userRepository.addNewUser(user)