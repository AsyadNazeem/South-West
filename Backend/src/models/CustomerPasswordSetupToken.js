
'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const CustomerPasswordSetupToken = sequelize.define(
        'CustomerPasswordSetupToken',
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            customer_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false,
            },
            token_hash: {
                type: DataTypes.CHAR(64),
                allowNull: false,
                unique: true,
            },
            expires_at: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            used_at: {
                type: DataTypes.DATE,
                allowNull: true,
                defaultValue: null,
            },
        },
        {
            tableName: 'customer_password_setup_tokens',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        }
    );

    CustomerPasswordSetupToken.associate = (models) => {
        CustomerPasswordSetupToken.belongsTo(models.Customer, {
            foreignKey: 'customer_id',
            as: 'customer',
        });
    };

    return CustomerPasswordSetupToken;
};
