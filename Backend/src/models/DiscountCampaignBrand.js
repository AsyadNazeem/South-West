'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class DiscountCampaignBrand extends Model {
        static associate(models) {
            DiscountCampaignBrand.belongsTo(models.DiscountCampaign, {
                foreignKey: 'campaign_id',
                as: 'campaign'
            });

            DiscountCampaignBrand.belongsTo(models.Brand, {
                foreignKey: 'brand_id',
                as: 'brand'
            });
        }
    }

    DiscountCampaignBrand.init(
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
            brand_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            }
        },
        {
            sequelize,
            modelName: 'DiscountCampaignBrand',
            tableName: 'discount_campaign_brands',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return DiscountCampaignBrand;
};
