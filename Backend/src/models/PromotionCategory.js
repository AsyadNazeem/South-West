'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class PromotionCategory extends Model {
        static associate(models) {
            PromotionCategory.belongsTo(models.Promotion, {
                foreignKey: 'promotion_id',
                as: 'promotion'
            });

            PromotionCategory.belongsTo(models.Category, {
                foreignKey: 'category_id',
                as: 'category'
            });
        }
    }

    PromotionCategory.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },

            promotion_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            },

            category_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
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
            modelName: 'PromotionCategory',
            tableName: 'promotion_categories',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return PromotionCategory;
};
