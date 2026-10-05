'use strict';

const { Model } = require('sequelize');
const { buildFileUrl } = require('../utils/fileStorage');

module.exports = (sequelize, DataTypes) => {
    class ItemVideo extends Model {
        static associate(models) {
            ItemVideo.belongsTo(models.Item, {
                foreignKey: 'item_id',
                as: 'item'
            });
        }
    }

    ItemVideo.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },

            item_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false,
                unique: true
            },

            file_name: {
                type: DataTypes.STRING(255),
                allowNull: false
            },

            // Relative to the uploads folder, e.g. items/videos/<uuid>.mp4
            file_path: {
                type: DataTypes.STRING(500),
                allowNull: false
            },

            mime_type: {
                type: DataTypes.STRING(100),
                allowNull: false
            },

            file_size: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: false
            },

            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true
            },

            // Not a column: public URL built from file_path
            url: {
                type: DataTypes.VIRTUAL,
                get() {
                    return buildFileUrl(this.getDataValue('file_path'));
                }
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
            modelName: 'ItemVideo',
            tableName: 'item_videos',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return ItemVideo;
};
