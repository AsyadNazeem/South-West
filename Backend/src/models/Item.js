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

            Item.belongsTo(models.Warranty, {
                foreignKey: 'warranty_id',
                as: 'warranty'
            });

            Item.hasMany(models.ItemPrice, {
                foreignKey: 'item_id',
                as: 'prices'
            });

            Item.hasMany(models.ItemImage, {
                foreignKey: 'item_id',
                as: 'images'
            });

            Item.hasOne(models.ItemVideo, {
                foreignKey: 'item_id',
                as: 'video'
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
                as: 'wishlists',
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE'
            });

            Item.hasMany(models.ProductReview, {
                foreignKey: 'item_id',
                as: 'reviews'
            });

            Item.hasMany(models.ItemColor, {
                foreignKey: 'item_id',
                as: 'colors',
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE'
            });

            Item.hasMany(models.ItemVariant, {
    foreignKey: 'item_id',
    as: 'variants'
});

Item.hasMany(models.ItemPaymentPrice, {
    foreignKey: 'item_id',
    as: 'paymentPrices'
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

public_id: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
},

slug: {
    type: DataTypes.STRING(191),
    allowNull: false,
    unique: true,
},

qb_item_code: {
    type: DataTypes.STRING(100),
    allowNull: true,
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

            shipping_weight: {
                type: DataTypes.DECIMAL(10, 3),
                allowNull: true
            },

            shipping_weight_unit: {
                type: DataTypes.ENUM('g', 'kg'),
                allowNull: false,
                defaultValue: 'kg'
            },

            condition: {
                type: DataTypes.STRING(30),
                allowNull: false,
                defaultValue: 'new'
            },

            warranty_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: true
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
