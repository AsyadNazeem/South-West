'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class OrderItem extends Model {
        static associate(models) {
            OrderItem.belongsTo(models.Order, {
                foreignKey: 'order_id',
                as: 'order'
            });

            OrderItem.belongsTo(models.Item, {
                foreignKey: 'item_id',
                as: 'item'
            });
        }
    }

    OrderItem.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },

            order_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            },

            item_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            },

            quantity: {
                type: DataTypes.DECIMAL(15, 3),
                allowNull: false
            },

            unit_price: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false
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

            line_total: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false,
                defaultValue: 0
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
            modelName: 'OrderItem',
            tableName: 'order_items',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return OrderItem;
};
