
'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ItemVariantColor extends Model {
    static associate(models) {
      ItemVariantColor.belongsTo(models.ItemVariant, {
        foreignKey: 'variant_id',
        as: 'variant',
      });

      ItemVariantColor.belongsTo(models.ItemColor, {
        foreignKey: 'color_id',
        as: 'color',
      });
    }
  }

  ItemVariantColor.init(
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      variant_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
      color_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'ItemVariantColor',
      tableName: 'item_variant_colors',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  return ItemVariantColor;
};
