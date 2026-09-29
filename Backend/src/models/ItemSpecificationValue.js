'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class ItemSpecificationValue extends Model {
        static associate(models) {
            ItemSpecificationValue.belongsTo(models.Item, {
                foreignKey: 'item_id',
                as: 'item'
            });

            ItemSpecificationValue.belongsTo(models.ItemSpecification, {
                foreignKey: 'specification_id',
                as: 'specification'
            });
        }
    }

    ItemSpecificationValue.init(
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

            specification_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            },

            value: {
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
            modelName: 'ItemSpecificationValue',
            tableName: 'item_specification_values',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return ItemSpecificationValue;
};
