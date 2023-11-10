const { Sequelize } = require('sequelize');
const sequelize = new Sequelize('projetoNode', 'root', '', {
    host: 'localhost',
    dialect: 'mysql',

});

module.exports = sequelize;