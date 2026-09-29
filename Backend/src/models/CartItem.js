'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class CartItem extends Model {
        static associate(models) {
            CartItem.belongsTo(models.Cart, {
                foreignKey: 'cart_id',
                as: 'cart'
            });

            CartItem.belongsTo(models.Item, {
                foreignKey: 'item_id',
                as: 'item'
            });
        }
    }

    CartItem.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },

            cart_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            },

            item_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            },

            quantity: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: false,
                defaultValue: 1
            },

            unit_price: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false
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
            modelName: 'CartItem',
            tableName: 'cart_items',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return CartItem;
};
