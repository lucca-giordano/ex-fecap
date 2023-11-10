const sequelize = require('.src/config/database');
//const user = require('./src/models/user');
//const item = require('./src/models/item');

sequelize.sync().then(() => {
    console.log('Database and tables created!');
}).catch(error => {
    console.log(`Error creating database! ${error.message}`);
});
