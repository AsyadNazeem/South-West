'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class ItemPrice extends Model {
        static associate(models) {
            ItemPrice.belongsTo(models.Item, {
                foreignKey: 'item_id',
                as: 'item'
            });
        }
    }

    ItemPrice.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },

            item_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            },

            price_type: {
                type: DataTypes.STRING(30),
                allowNull: false
            },

            price: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false
            },

            currency: {
                type: DataTypes.STRING(3),
                allowNull: false,
                defaultValue: 'LKR'
            },

            effective_from: {
                type: DataTypes.DATE,
                allowNull: true
            },

            effective_to: {
                type: DataTypes.DATE,
                allowNull: true
            },

            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true
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
            modelName: 'ItemPrice',
            tableName: 'item_prices',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return ItemPrice;
};
