'use strict';

module.exports = (sequelize, DataTypes) => {
    const { table, fields, indexes } = require('../warranty/schema')(DataTypes).WarrantyRequest;
    return sequelize.define('WarrantyRequest', fields, {
        tableName: table, indexes, timestamps: true, createdAt: 'created_at',
        updatedAt: fields.updated_at ? 'updated_at' : false
    });
};
