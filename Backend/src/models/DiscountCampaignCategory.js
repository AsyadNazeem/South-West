'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class DiscountCampaignCategory extends Model {
        static associate(models) {
            DiscountCampaignCategory.belongsTo(models.DiscountCampaign, {
                foreignKey: 'campaign_id',
                as: 'campaign'
            });

            DiscountCampaignCategory.belongsTo(models.Category, {
                foreignKey: 'category_id',
                as: 'category'
            });
        }
    }

    DiscountCampaignCategory.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },
            campaign_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            },
            category_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            }
        },
        {
            sequelize,
            modelName: 'DiscountCampaignCategory',
            tableName: 'discount_campaign_categories',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return DiscountCampaignCategory;
};
