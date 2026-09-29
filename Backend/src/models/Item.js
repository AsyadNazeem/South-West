'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Item extends Model {
        static associate(models) {
            Item.belongsTo(models.Category, {
                foreignKey: 'category_id',
                as: 'category'
            });

            Item.belongsTo(models.Brand, {
                foreignKey: 'brand_id',
                as: 'brand'
            });

            Item.belongsTo(models.Unit, {
                foreignKey: 'unit_id',
                as: 'unitOfMeasure'
            });

            Item.belongsTo(models.ItemType, {
                foreignKey: 'item_type_id',
                as: 'itemType'
            });

            Item.hasMany(models.ItemPrice, {
                foreignKey: 'item_id',
                as: 'prices'
            });

            Item.hasMany(models.ItemImage, {
                foreignKey: 'item_id',
                as: 'images'
            });

            Item.hasMany(models.ItemSpecificationValue, {
                foreignKey: 'item_id',
                as: 'specificationValues'
            });

            Item.hasMany(models.InventoryStock, {
                foreignKey: 'item_id',
                as: 'inventoryStocks'
            });

            Item.hasMany(models.InventoryStockMovement, {
                foreignKey: 'item_id',
                as: 'stockMovements'
            });

            Item.hasMany(models.PurchaseOrderItem, {
                foreignKey: 'item_id',
                as: 'purchaseOrderItems'
            });

            Item.hasMany(models.GoodsReceiptItem, {
                foreignKey: 'item_id',
                as: 'goodsReceiptItems'
            });

            Item.hasMany(models.OrderItem, {
                foreignKey: 'item_id',
                as: 'orderItems'
            });

            Item.hasMany(models.PromotionItem, {
                foreignKey: 'item_id',
                as: 'promotionItems'
            });

            Item.hasMany(models.CartItem, {
                foreignKey: 'item_id',
                as: 'cartItems'
            });

            Item.hasMany(models.Wishlist, {
                foreignKey: 'item_id',
                as: 'wishlists'
            });

            Item.hasMany(models.ProductReview, {
                foreignKey: 'item_id',
                as: 'reviews'
            });
        }
    }

    Item.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },

            category_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: true
            },

            brand_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: true
            },

            unit_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: true
            },

            item_type_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: true
            },

            item_code: {
                type: DataTypes.STRING(50),
                allowNull: false,
                unique: true
            },

            item_name: {
                type: DataTypes.STRING(255),
                allowNull: false
            },

            description: {
                type: DataTypes.TEXT,
                allowNull: true
            },

            condition: {
                type: DataTypes.STRING(30),
                allowNull: false,
                defaultValue: 'new'
            },

            is_serialized: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false
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
            modelName: 'Item',
            tableName: 'items',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return Item;
};
