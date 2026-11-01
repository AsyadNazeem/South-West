'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class CampaignFrame extends Model {
        static associate(models) {
            CampaignFrame.hasMany(models.DiscountCampaign, {
                foreignKey: 'visual_frame_id',
                as: 'campaigns',
            });
        }
    }

    CampaignFrame.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            name: {
                type: DataTypes.STRING(120),
                allowNull: false,
            },
            image_path: {
                type: DataTypes.STRING(255),
                allowNull: false,
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
        },
        {
            sequelize,
            modelName: 'CampaignFrame',
            tableName: 'campaign_frames',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        }
    );

    return CampaignFrame;
};
