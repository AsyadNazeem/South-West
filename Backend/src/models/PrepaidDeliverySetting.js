'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class PrepaidDeliverySetting extends Model {}

    PrepaidDeliverySetting.init(
        {
            id: {
                type: DataTypes.TINYINT.UNSIGNED,
                primaryKey: true,
                allowNull: false
            },
            colombo_first_kg_charge: {
                type: DataTypes.DECIMAL(12, 2),
                allowNull: false,
                defaultValue: 450.00
            },
            outside_colombo_first_kg_charge: {
                type: DataTypes.DECIMAL(12, 2),
                allowNull: false,
                defaultValue: 550.00
            },
            additional_kg_charge: {
                type: DataTypes.DECIMAL(12, 2),
                allowNull: false,
                defaultValue: 100.00
            }
        },
        {
            sequelize,
            modelName: 'PrepaidDeliverySetting',
            tableName: 'prepaid_delivery_settings',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return PrepaidDeliverySetting;
};
