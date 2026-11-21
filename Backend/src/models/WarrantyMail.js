'use strict';

module.exports = (sequelize, DataTypes) => {
    const { table, fields, indexes } = require('../warranty/schema')(DataTypes).WarrantyMail;
    delete fields.history_id.unique;
    fields.recipient = { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'customer' };
    indexes.push({ unique: true, name: 'warranty_mail_history_recipient', fields: ['history_id','recipient'] });
    return sequelize.define('WarrantyMail', fields, {
        tableName: table, indexes, timestamps: true, createdAt: 'created_at',
        updatedAt: fields.updated_at ? 'updated_at' : false
    });
};
