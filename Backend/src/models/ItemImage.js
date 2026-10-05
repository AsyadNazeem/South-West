'use strict';

const { Model } = require('sequelize');
const { buildFileUrl } = require('../utils/fileStorage');

module.exports = (sequelize, DataTypes) => {
    class ItemImage extends Model {
        static associate(models) {
            ItemImage.belongsTo(models.Item, {
                foreignKey: 'item_id',
                as: 'item'
            });
        }
    }

    ItemImage.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },

            item_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            },

            file_name: {
                type: DataTypes.STRING(255),
                allowNull: false
            },

            // Relative to the uploads folder, e.g. items/images/<uuid>.jpg
            file_path: {
                type: DataTypes.STRING(500),
                allowNull: false
            },

            mime_type: {
                type: DataTypes.STRING(100),
                allowNull: true
            },

            file_size: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: true
            },

            alt_text: {
                type: DataTypes.STRING(255),
                allowNull: true
            },

            sort_order: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0
            },

            is_primary: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false
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
            modelName: 'ItemImage',
            tableName: 'item_images',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return ItemImage;
};
