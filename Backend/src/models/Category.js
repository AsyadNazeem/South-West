'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Category extends Model {
        static associate(models) {
            Category.belongsTo(Category, {
                foreignKey: 'parent_id',
                as: 'parent'
            });

            Category.hasMany(Category, {
                foreignKey: 'parent_id',
                as: 'children'
            });

            Category.hasMany(models.Item, {
                foreignKey: 'category_id',
                as: 'items'
            });

            Category.hasMany(models.PromotionCategory, {
                foreignKey: 'category_id',
                as: 'promotionCategories'
            });
        }
    }

    Category.init(
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

            parent_id: {
                type: DataTypes.BIGINT.UNSIGNED,
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
            modelName: 'Category',
            tableName: 'categories',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return Category;
};
