
'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class ItemColor extends Model {
        static associate(models) {
            ItemColor.belongsTo(models.Item, {
                foreignKey: 'item_id',
                as: 'item'
            });

            ItemColor.belongsToMany(models.ItemVariant, {
  through: models.ItemVariantColor,
  foreignKey: 'color_id',
  otherKey: 'variant_id',
  as: 'variants',
});
        }

        
    }

    ItemColor.init(
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

            color_name: {
                type: DataTypes.STRING(50),
                allowNull: false,
                validate: {
                    notEmpty: true,
                    len: [1, 50]
                }
            },

            hex_code: {
                type: DataTypes.STRING(7),
                allowNull: false,
                validate: {
                    is: /^#[0-9A-Fa-f]{6}$/
                }
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
            modelName: 'ItemColor',
            tableName: 'item_colors',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return ItemColor;
};
