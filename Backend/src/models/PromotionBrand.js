'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class PromotionBrand extends Model {
        static associate(models) {
            PromotionBrand.belongsTo(models.Promotion, {
                foreignKey: 'promotion_id',
                as: 'promotion'
            });

            PromotionBrand.belongsTo(models.Brand, {
                foreignKey: 'brand_id',
                as: 'brand'
            });
        }
    }

    PromotionBrand.init(
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
            brand_id: {
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
            modelName: 'PromotionBrand',
            tableName: 'promotion_brands',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return PromotionBrand;
};