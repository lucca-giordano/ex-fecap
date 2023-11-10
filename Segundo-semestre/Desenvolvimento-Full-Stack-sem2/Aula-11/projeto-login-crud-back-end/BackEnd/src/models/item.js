const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Item = sequelize.define('Item', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    title:{
        type: DataTypes.STRING,
        allowNull: false
    },
    description:{
        type: DataTypes.STRING,
        allowNull: false
    },
    imgURL:{
        type: DataTypes.STRING,
        allowNull: false
    }

});