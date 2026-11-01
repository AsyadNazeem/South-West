
'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class GuestCheckoutIdempotency extends Model {}

    GuestCheckoutIdempotency.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },
            guest_checkout_session_id: {
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
            }
        },
        {
            sequelize,
            modelName: 'GuestCheckoutIdempotency',
            tableName: 'guest_checkout_idempotency',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                {
                    name: 'uq_guest_checkout_idempotency_session_key',
                    unique: true,
                    fields: [
                        'guest_checkout_session_id',
                        'idempotency_key'
                    ]
                }
            ]
        }
    );

    return GuestCheckoutIdempotency;
};
