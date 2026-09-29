'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Order extends Model {
        static associate(models) {
            Order.belongsTo(models.Customer, {
                foreignKey: 'customer_id',
                as: 'customer'
            });

            Order.belongsTo(models.User, {
                foreignKey: 'created_by',
                as: 'creator'
            });

            Order.hasMany(models.OrderItem, {
                foreignKey: 'order_id',
                as: 'items'
            });

            Order.hasMany(models.OrderAddress, {
                foreignKey: 'order_id',
                as: 'addresses'
            });

            Order.hasMany(models.Payment, {
                foreignKey: 'order_id',
                as: 'payments'
            });

            Order.hasMany(models.Delivery, {
                foreignKey: 'order_id',
                as: 'deliveries'
            });

            Order.hasMany(models.Invoice, {
                foreignKey: 'order_id',
                as: 'invoices'
            });

            Order.hasMany(models.OrderPromotion, {
                foreignKey: 'order_id',
                as: 'promotions'
            });

            Order.hasMany(models.ProductReview, {
                foreignKey: 'order_id',
                as: 'productReviews'
            });
        }
    }

    Order.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },

            order_number: {
                type: DataTypes.STRING(50),
                allowNull: false,
                unique: true
            },

            customer_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: true
            },

            order_date: {
                type: DataTypes.DATE,
                allowNull: false
            },

            order_type: {
                type: DataTypes.ENUM(
                    'online',
                    'pos',
                    'manual'
                ),
                allowNull: false,
                defaultValue: 'online'
            },

            status: {
                type: DataTypes.ENUM(
                    'pending',
                    'confirmed',
                    'processing',
                    'partially_shipped',
                    'shipped',
                    'delivered',
                    'cancelled',
                    'returned'
                ),
                allowNull: false,
                defaultValue: 'pending'
            },

            payment_status: {
                type: DataTypes.ENUM(
                    'unpaid',
                    'partially_paid',
                    'paid',
                    'refunded',
                    'partially_refunded'
                ),
                allowNull: false,
                defaultValue: 'unpaid'
            },

            fulfillment_status: {
                type: DataTypes.ENUM(
                    'unfulfilled',
                    'partially_fulfilled',
                    'fulfilled',
                    'cancelled'
                ),
                allowNull: false,
                defaultValue: 'unfulfilled'
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
            modelName: 'Order',
            tableName: 'orders',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return Order;
};
