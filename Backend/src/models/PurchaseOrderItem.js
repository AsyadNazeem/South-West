'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class PurchaseOrderItem extends Model {
        static associate(models) {
            PurchaseOrderItem.belongsTo(models.PurchaseOrder, {
                foreignKey: 'purchase_order_id',
                as: 'purchaseOrder'
            });

            PurchaseOrderItem.belongsTo(models.Item, {
                foreignKey: 'item_id',
                as: 'item'
            });

            PurchaseOrderItem.hasMany(models.GoodsReceiptItem, {
                foreignKey: 'purchase_order_item_id',
                as: 'goodsReceiptItems'
            });
        }
    }

    PurchaseOrderItem.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },

            purchase_order_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            },

            item_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            },

            quantity_ordered: {
                type: DataTypes.DECIMAL(15, 3),
                allowNull: false
            },

            unit_cost: {
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

            quantity_received: {
                type: DataTypes.DECIMAL(15, 3),
                allowNull: false,
                defaultValue: 0
            },

            notes: {
                type: DataTypes.TEXT,
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
            modelName: 'PurchaseOrderItem',
            tableName: 'purchase_order_items',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return PurchaseOrderItem;
};
