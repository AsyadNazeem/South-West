'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class PurchaseOrder extends Model {
        static associate(models) {
            PurchaseOrder.belongsTo(models.Supplier, {
                foreignKey: 'supplier_id',
                as: 'supplier'
            });

            PurchaseOrder.belongsTo(models.User, {
                foreignKey: 'created_by',
                as: 'creator'
            });

            PurchaseOrder.belongsTo(models.User, {
                foreignKey: 'approved_by',
                as: 'approver'
            });

            PurchaseOrder.hasMany(models.PurchaseOrderItem, {
                foreignKey: 'purchase_order_id',
                as: 'items'
            });

            PurchaseOrder.hasMany(models.GoodsReceipt, {
                foreignKey: 'purchase_order_id',
                as: 'goodsReceipts'
            });
        }
    }

    PurchaseOrder.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },

            purchase_order_number: {
                type: DataTypes.STRING(50),
                allowNull: false,
                unique: true
            },

            supplier_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            },

            order_date: {
                type: DataTypes.DATEONLY,
                allowNull: false
            },

            expected_date: {
                type: DataTypes.DATEONLY,
                allowNull: true
            },

            status: {
                type: DataTypes.ENUM(
                    'draft',
                    'submitted',
                    'approved',
                    'partially_received',
                    'received',
                    'cancelled'
                ),
                allowNull: false,
                defaultValue: 'draft'
            },

            subtotal: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false,
                defaultValue: 0
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

            shipping_amount: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false,
                defaultValue: 0
            },

            total_amount: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false,
                defaultValue: 0
            },

            notes: {
                type: DataTypes.TEXT,
                allowNull: true
            },

            created_by: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: true
            },

            approved_by: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: true
            },

            approved_at: {
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
            modelName: 'PurchaseOrder',
            tableName: 'purchase_orders',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return PurchaseOrder;
};
