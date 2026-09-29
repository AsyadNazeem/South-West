'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class ItemTypeSpecification extends Model {
        static associate(models) {
            ItemTypeSpecification.belongsTo(models.ItemType, {
                foreignKey: 'item_type_id',
                as: 'itemType'
            });

            ItemTypeSpecification.belongsTo(models.ItemSpecification, {
                foreignKey: 'specification_id',
                as: 'specification'
            });
        }
    }

    ItemTypeSpecification.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },

            item_type_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            },

            specification_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            },

            is_required: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false
            },

            sort_order: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0
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
            modelName: 'ItemTypeSpecification',
            tableName: 'item_type_specifications',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return ItemTypeSpecification;
};
