'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class GoodsReceipt extends Model {
        static associate(models) {
            GoodsReceipt.belongsTo(models.PurchaseOrder, {
                foreignKey: 'purchase_order_id',
                as: 'purchaseOrder'
            });

            GoodsReceipt.belongsTo(models.InventoryLocation, {
                foreignKey: 'location_id',
                as: 'location'
            });

            GoodsReceipt.belongsTo(models.User, {
                foreignKey: 'received_by',
                as: 'receiver'
            });

            GoodsReceipt.hasMany(models.GoodsReceiptItem, {
                foreignKey: 'goods_receipt_id',
                as: 'items'
            });

        }
    }

    GoodsReceipt.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },

            receipt_number: {
                type: DataTypes.STRING(50),
                allowNull: false,
                unique: true
            },

            purchase_order_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            },

            location_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            },

            receipt_date: {
                type: DataTypes.DATEONLY,
                allowNull: false
            },

            supplier_delivery_note: {
                type: DataTypes.STRING(100),
                allowNull: true
            },

            status: {
                type: DataTypes.ENUM(
                    'draft',
                    'received',
                    'cancelled'
                ),
                allowNull: false,
                defaultValue: 'draft'
            },

            notes: {
                type: DataTypes.TEXT,
                allowNull: true
            },

            received_by: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: true
            },

            received_at: {
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
            modelName: 'GoodsReceipt',
            tableName: 'goods_receipts',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return GoodsReceipt;
};
