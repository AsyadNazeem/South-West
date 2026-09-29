'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class GoodsReceiptItem extends Model {
        static associate(models) {
            GoodsReceiptItem.belongsTo(models.GoodsReceipt, {
                foreignKey: 'goods_receipt_id',
                as: 'goodsReceipt'
            });

            GoodsReceiptItem.belongsTo(models.PurchaseOrderItem, {
                foreignKey: 'purchase_order_item_id',
                as: 'purchaseOrderItem'
            });

            GoodsReceiptItem.belongsTo(models.Item, {
                foreignKey: 'item_id',
                as: 'item'
            });
        }
    }

    GoodsReceiptItem.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },

            goods_receipt_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            },

            purchase_order_item_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            },

            item_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            },

            quantity_received: {
                type: DataTypes.DECIMAL(15, 3),
                allowNull: false
            },

            unit_cost: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false
            },

            condition: {
                type: DataTypes.ENUM(
                    'good',
                    'damaged',
                    'defective'
                ),
                allowNull: false,
                defaultValue: 'good'
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
            modelName: 'GoodsReceiptItem',
            tableName: 'goods_receipt_items',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return GoodsReceiptItem;
};
