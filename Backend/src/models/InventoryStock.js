'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class InventoryStock extends Model {
        static associate(models) {
            InventoryStock.belongsTo(models.Item, {
                foreignKey: 'item_id',
                as: 'item'
            });

            InventoryStock.belongsTo(models.InventoryLocation, {
                foreignKey: 'location_id',
                as: 'location'
            });
        }
    }

    InventoryStock.init(
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

            location_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            },

            quantity_on_hand: {
                type: DataTypes.DECIMAL(15, 3),
                allowNull: false,
                defaultValue: 0
            },

            quantity_reserved: {
                type: DataTypes.DECIMAL(15, 3),
                allowNull: false,
                defaultValue: 0
            },

            reorder_level: {
                type: DataTypes.DECIMAL(15, 3),
                allowNull: false,
                defaultValue: 0
            },

            reorder_quantity: {
                type: DataTypes.DECIMAL(15, 3),
                allowNull: false,
                defaultValue: 0
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
            modelName: 'InventoryStock',
            tableName: 'inventory_stock',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return InventoryStock;
};
