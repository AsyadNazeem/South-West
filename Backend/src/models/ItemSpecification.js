'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class ItemSpecification extends Model {
        static associate(models) {
            ItemSpecification.belongsToMany(models.ItemType, {
                through: models.ItemTypeSpecification,
                foreignKey: 'specification_id',
                otherKey: 'item_type_id',
                as: 'itemTypes'
            });

            ItemSpecification.hasMany(models.ItemSpecificationValue, {
                foreignKey: 'specification_id',
                as: 'values'
            });
        }
    }

    ItemSpecification.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },

            name: {
                type: DataTypes.STRING(100),
                allowNull: false,
                unique: true
            },

            code: {
                type: DataTypes.STRING(50),
                allowNull: false,
                unique: true
            },

            data_type: {
                type: DataTypes.ENUM(
                    'text',
                    'number',
                    'decimal',
                    'boolean',
                    'date',
                    'select'
                ),
                allowNull: false,
                defaultValue: 'text'
            },

            unit: {
                type: DataTypes.STRING(30),
                allowNull: true
            },

            description: {
                type: DataTypes.STRING(255),
                allowNull: true
            },

            is_required: {
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
            modelName: 'ItemSpecification',
            tableName: 'item_specifications',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return ItemSpecification;
};
