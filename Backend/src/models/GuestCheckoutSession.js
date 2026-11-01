'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define(
        'GuestCheckoutSession',
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },
            token_hash: {
                type: DataTypes.CHAR(64),
                allowNull: false,
                unique: true
            },
            cart_items: {
                type: DataTypes.JSON,
                allowNull: false
            },
            expires_at: {
                type: DataTypes.DATE,
                allowNull: false
            },
            consumed_at: {
                type: DataTypes.DATE,
                allowNull: true,
                defaultValue: null
            }
        },
        {
            tableName: 'guest_checkout_sessions',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                {
                    name: 'idx_guest_checkout_sessions_expiry',
                    fields: ['expires_at']
                }
            ]
        }
    );
};
