const sequelize = require('./src/config/database');
const dbName = 'projetoNode';

sequelize.query(`CREATE DATABASE IF NOT EXISTS ${dbName};`).then(() => {
    console.log(`Database ${dbName} created!`);
    sequelize.close();  
}).catch(error => {
    console.log(`Error creating database! ${error.message}`);
    sequelize.close();
});