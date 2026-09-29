'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Payment extends Model {
        static associate(models) {
            Payment.belongsTo(models.Order, {
                foreignKey: 'order_id',
                as: 'order'
            });

            Payment.belongsTo(models.User, {
                foreignKey: 'processed_by',
                as: 'processor'
            });
        }
    }

    Payment.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },

            payment_reference: {
                type: DataTypes.STRING(100),
                allowNull: false,
                unique: true
            },

            order_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            },

            payment_method: {
                type: DataTypes.ENUM(
                    'cash',
                    'card',
                    'bank_transfer',
                    'online',
                    'wallet',
                    'cheque',
                    'other'
                ),
                allowNull: false
            },

            payment_status: {
                type: DataTypes.ENUM(
                    'pending',
                    'authorized',
                    'paid',
                    'failed',
                    'cancelled',
                    'refunded',
                    'partially_refunded'
                ),
                allowNull: false,
                defaultValue: 'pending'
            },

            amount: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false
            },

            transaction_reference: {
                type: DataTypes.STRING(150),
                allowNull: true
            },

            payment_date: {
                type: DataTypes.DATE,
                allowNull: true
            },

            notes: {
                type: DataTypes.TEXT,
                allowNull: true
            },

            processed_by: {
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
            modelName: 'Payment',
            tableName: 'payments',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return Payment;
};
