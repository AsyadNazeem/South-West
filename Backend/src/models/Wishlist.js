'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Wishlist extends Model {
        static associate(models) {
            Wishlist.belongsTo(models.Customer, {
                foreignKey: 'customer_id',
                as: 'customer'
            });

            Wishlist.belongsTo(models.Item, {
                foreignKey: 'item_id',
                as: 'item'
            });
        }
    }

    Wishlist.init(
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

            item_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            }
        },
        {
            sequelize,
            modelName: 'Wishlist',
            tableName: 'wishlists',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return Wishlist;
};
