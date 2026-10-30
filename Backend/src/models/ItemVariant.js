
'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class ItemVariant extends Model {
        static associate(models) {
            ItemVariant.belongsTo(models.Item, {
                foreignKey: 'item_id',
                as: 'item'
            });

            ItemVariant.hasMany(models.ItemPrice, {
                foreignKey: 'variant_id',
                as: 'prices'
            });

            ItemVariant.hasMany(models.InventoryStock, {
                foreignKey: 'variant_id',
                as: 'stocks'
            });
        
            ItemVariant.belongsToMany(models.ItemColor, {
  through: models.ItemVariantColor,
  foreignKey: 'variant_id',
  otherKey: 'color_id',
  as: 'colors',
});

ItemVariant.hasMany(models.ItemPaymentPrice, {
    foreignKey: 'variant_id',
    as: 'paymentPrices'
});
        }
    }

    ItemVariant.init(
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

            variant_sku: {
                type: DataTypes.STRING(100),
                allowNull: false,
                unique: true
            },

            variant_name: {
                type: DataTypes.STRING(255),
                allowNull: false
            },

            attributes: {
                type: DataTypes.JSON,
                allowNull: true
            },

            qb_item_code: {
                type: DataTypes.STRING(100),
                allowNull: true
            },

            is_default: {
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
            modelName: 'ItemVariant',
            tableName: 'item_variants',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return ItemVariant;
};
