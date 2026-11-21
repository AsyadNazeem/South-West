'use strict';

module.exports = (sequelize, DataTypes) => {
    const { table, fields, indexes } = require('../warranty/schema')(DataTypes).WarrantyClaim;
    const Claim = sequelize.define('WarrantyClaim', fields, {
        tableName: table, indexes, timestamps: true, createdAt: 'created_at',
        updatedAt: fields.updated_at ? 'updated_at' : false
    });
    Claim.associate = models => {
        Claim.belongsTo(models.User, { foreignKey: 'assigned_staff_id', as: 'reviewer' });
    };
    return Claim;
};
