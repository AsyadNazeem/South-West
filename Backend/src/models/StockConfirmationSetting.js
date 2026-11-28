'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class StockConfirmationSetting extends Model {}

    StockConfirmationSetting.init({
        id: {
            type: DataTypes.TINYINT.UNSIGNED,
            primaryKey: true,
            allowNull: false
        },
        enabled: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        threshold: {
            type: DataTypes.DECIMAL(12, 2),
            allowNull: false,
            defaultValue: 50000.00
        },
        primary_phone: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: '0773029614'
        },
        primary_whatsapp: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        secondary_phone: {
            type: DataTypes.STRING(20),
            allowNull: true
        },
        secondary_whatsapp: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        }
    }, {
        sequelize,
        modelName: 'StockConfirmationSetting',
        tableName: 'stock_confirmation_settings',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });

    return StockConfirmationSetting;
};
