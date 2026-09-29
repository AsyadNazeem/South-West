'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class InventoryLocation extends Model {
        static associate(models) {
            InventoryLocation.hasMany(models.InventoryStock, {
                foreignKey: 'location_id',
                as: 'stocks'
            });

            InventoryLocation.hasMany(models.InventoryStockMovement, {
                foreignKey: 'location_id',
                as: 'stockMovements'
            });

            InventoryLocation.hasMany(models.GoodsReceipt, {
                foreignKey: 'location_id',
                as: 'goodsReceipts'
            });
        }
    }

    InventoryLocation.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },

            code: {
                type: DataTypes.STRING(50),
                allowNull: false,
                unique: true
            },

            name: {
                type: DataTypes.STRING(150),
                allowNull: false
            },

            location_type: {
                type: DataTypes.ENUM(
                    'store',
                    'warehouse',
                    'online',
                    'service'
                ),
                allowNull: false,
                defaultValue: 'store'
            },

            address: {
                type: DataTypes.TEXT,
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
            modelName: 'InventoryLocation',
            tableName: 'inventory_locations',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return InventoryLocation;
};
