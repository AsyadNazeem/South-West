
'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class CheckoutIdempotency extends Model {}

    CheckoutIdempotency.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },
            customer_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            },
            idempotency_key: {
                type: DataTypes.STRING(100),
                allowNull: false
            },
            request_hash: {
                type: DataTypes.CHAR(64),
                allowNull: false
            },
            order_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: true
            },
            created_at: {
                type: DataTypes.DATE,
                allowNull: false
            },
            updated_at: {
                type: DataTypes.DATE,
                allowNull: false
            }
        },
        {
            sequelize,
            modelName: 'CheckoutIdempotency',
            tableName: 'checkout_idempotency',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return CheckoutIdempotency;
};
