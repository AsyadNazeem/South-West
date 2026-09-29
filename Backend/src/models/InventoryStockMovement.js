'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class InventoryStockMovement extends Model {
        static associate(models) {
            InventoryStockMovement.belongsTo(models.Item, {
                foreignKey: 'item_id',
                as: 'item'
            });

            InventoryStockMovement.belongsTo(models.InventoryLocation, {
                foreignKey: 'location_id',
                as: 'location'
            });

            InventoryStockMovement.belongsTo(models.User, {
                foreignKey: 'created_by',
                as: 'creator'
            });
        }
    }

    InventoryStockMovement.init(
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

            movement_type: {
                type: DataTypes.ENUM(
                    'purchase',
                    'sale',
                    'customer_return',
                    'supplier_return',
                    'adjustment',
                    'transfer_in',
                    'transfer_out'
                ),
                allowNull: false
            },

            quantity: {
                type: DataTypes.DECIMAL(15, 3),
                allowNull: false
            },

            reference_type: {
                type: DataTypes.STRING(50),
                allowNull: true
            },

            reference_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: true
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
            }
        },
        {
            sequelize,
            modelName: 'InventoryStockMovement',
            tableName: 'inventory_stock_movements',
            timestamps: false
        }
    );

    return InventoryStockMovement;
};
