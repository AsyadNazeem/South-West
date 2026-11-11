'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const CustomerPasswordResetToken = sequelize.define(
        'CustomerPasswordResetToken',
        {
            id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, allowNull: false },
            customer_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
            token_hash: { type: DataTypes.CHAR(64), allowNull: false, unique: true },
            expires_at: { type: DataTypes.DATE, allowNull: false },
            used_at: { type: DataTypes.DATE, allowNull: true },
        },
        {
            tableName: 'customer_password_reset_tokens',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                { name: 'idx_password_reset_customer', fields: ['customer_id'] },
                { name: 'idx_password_reset_expiry', fields: ['expires_at'] },
            ],
        }
    );

    CustomerPasswordResetToken.associate = (models) => {
        CustomerPasswordResetToken.belongsTo(models.Customer, {
            foreignKey: 'customer_id',
            as: 'customer',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
        });
    };

    return CustomerPasswordResetToken;
};
