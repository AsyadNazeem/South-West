'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class DiscountCampaignItem extends Model {
        static associate(models) {
            DiscountCampaignItem.belongsTo(models.DiscountCampaign, {
                foreignKey: 'campaign_id',
                as: 'campaign'
            });

            DiscountCampaignItem.belongsTo(models.Item, {
                foreignKey: 'item_id',
                as: 'item'
            });
        }
    }

    DiscountCampaignItem.init(
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
            item_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            }
        },
        {
            sequelize,
            modelName: 'DiscountCampaignItem',
            tableName: 'discount_campaign_items',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return DiscountCampaignItem;
};
