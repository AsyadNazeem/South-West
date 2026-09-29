'use strict';

const { Model } = require('sequelize');

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

            image_url: {
                type: DataTypes.STRING(500),
                allowNull: false
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
