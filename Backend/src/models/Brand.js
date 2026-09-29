'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Brand extends Model {
        static associate(models) {
            Brand.hasMany(models.Item, {
                foreignKey: 'brand_id',
                as: 'items'
            });
        }
    }

    Brand.init(
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

            description: {
                type: DataTypes.TEXT,
                allowNull: true
            },

            website: {
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
            modelName: 'Brand',
            tableName: 'brands',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return Brand;
};
