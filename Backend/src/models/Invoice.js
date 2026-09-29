'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Invoice extends Model {
        static associate(models) {
            Invoice.belongsTo(models.Order, {
                foreignKey: 'order_id',
                as: 'order'
            });

            Invoice.belongsTo(models.Customer, {
                foreignKey: 'customer_id',
                as: 'customer'
            });

            Invoice.belongsTo(models.User, {
                foreignKey: 'created_by',
                as: 'creator'
            });
        }
    }

    Invoice.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },

            invoice_number: {
                type: DataTypes.STRING(100),
                allowNull: false,
                unique: true
            },

            order_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            },

            customer_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: true
            },

            invoice_date: {
                type: DataTypes.DATE,
                allowNull: false
            },

            due_date: {
                type: DataTypes.DATE,
                allowNull: true
            },

            status: {
                type: DataTypes.ENUM(
                    'draft',
                    'issued',
                    'partially_paid',
                    'paid',
                    'overdue',
                    'cancelled',
                    'refunded'
                ),
                allowNull: false,
                defaultValue: 'draft'
            },

            subtotal: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false,
                defaultValue: 0
            },

            discount_amount: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false,
                defaultValue: 0
            },

            tax_amount: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false,
                defaultValue: 0
            },

            shipping_amount: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false,
                defaultValue: 0
            },

            total_amount: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false,
                defaultValue: 0
            },

            paid_amount: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false,
                defaultValue: 0
            },

            balance_amount: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false,
                defaultValue: 0
            },

            notes: {
                type: DataTypes.TEXT,
                allowNull: true
            },

            created_by: {
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
            modelName: 'Invoice',
            tableName: 'invoices',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return Invoice;
};
