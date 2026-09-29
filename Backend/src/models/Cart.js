'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Cart extends Model {
        static associate(models) {
            Cart.belongsTo(models.Customer, {
                foreignKey: 'customer_id',
                as: 'customer'
            });

            Cart.hasMany(models.CartItem, {
                foreignKey: 'cart_id',
                as: 'items'
            });
        }
    }

    Cart.init(
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

            status: {
                type: DataTypes.ENUM(
                    'active',
                    'converted',
                    'abandoned',
                    'expired'
                ),
                allowNull: false,
                defaultValue: 'active'
            },

            expires_at: {
                type: DataTypes.DATE,
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
            modelName: 'Cart',
            tableName: 'carts',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return Cart;
};
