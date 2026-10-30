'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class DiscountCampaign extends Model {
        static associate(models) {
            DiscountCampaign.hasMany(models.DiscountCampaignItem, {
                foreignKey: 'campaign_id',
                as: 'campaignItems'
            });

            DiscountCampaign.hasMany(models.DiscountCampaignCategory, {
                foreignKey: 'campaign_id',
                as: 'campaignCategories'
            });

            DiscountCampaign.hasMany(models.DiscountCampaignBrand, {
                foreignKey: 'campaign_id',
                as: 'campaignBrands'
            });

            DiscountCampaign.belongsTo(models.User, {
                foreignKey: 'created_by',
                as: 'creator'
            });
        }
    }

    DiscountCampaign.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },
            campaign_name: {
                type: DataTypes.STRING(150),
                allowNull: false
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            discount_reason: {
                type: DataTypes.STRING(80),
                allowNull: false,
                defaultValue: 'custom'
            },
            custom_reason: {
                type: DataTypes.STRING(150),
                allowNull: true
            },
            target_type: {
                type: DataTypes.ENUM(
                    'all_products',
                    'selected_products',
                    'category',
                    'brand'
                ),
                allowNull: false
            },
            discount_type: {
                type: DataTypes.ENUM('percentage', 'fixed_amount'),
                allowNull: false
            },
            discount_value: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false
            },
            allow_promo_code: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false
            },
            start_date: {
                type: DataTypes.DATE,
                allowNull: false
            },
            end_date: {
                type: DataTypes.DATE,
                allowNull: false
            },
            status: {
                type: DataTypes.ENUM(
                    'draft',
                    'scheduled',
                    'active',
                    'paused',
                    'expired',
                    'cancelled'
                ),
                allowNull: false,
                defaultValue: 'draft'
            },
            created_by: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: true
            }
        },
        {
            sequelize,
            modelName: 'DiscountCampaign',
            tableName: 'discount_campaigns',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return DiscountCampaign;
};
