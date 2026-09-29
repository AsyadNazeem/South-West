'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class ItemType extends Model {
        static associate(models) {
            ItemType.hasMany(models.Item, {
                foreignKey: 'item_type_id',
                as: 'items'
            });

            ItemType.belongsToMany(models.ItemSpecification, {
                through: models.ItemTypeSpecification,
                foreignKey: 'item_type_id',
                otherKey: 'specification_id',
                as: 'specifications'
            });

            ItemType.hasMany(models.ItemTypeSpecification, {
                foreignKey: 'item_type_id',
                as: 'itemTypeSpecifications'
            });
        }
    }

    ItemType.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },

            name: {
                type: DataTypes.STRING(50),
                allowNull: false,
                unique: true
            },

            code: {
                type: DataTypes.STRING(30),
                allowNull: false,
                unique: true
            },

            description: {
                type: DataTypes.STRING(255),
                allowNull: true
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
            modelName: 'ItemType',
            tableName: 'item_types',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return ItemType;
};
