'use strict';

module.exports = (sequelize, DataTypes) => {
    const { table, fields, indexes } = require('../warranty/schema')(DataTypes).WarrantyHistory;
    return sequelize.define('WarrantyHistory', fields, {
        tableName: table, indexes, timestamps: true, createdAt: 'created_at',
        updatedAt: fields.updated_at ? 'updated_at' : false
    });
};
