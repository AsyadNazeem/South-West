'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class PromotionItem extends Model {
        static associate(models) {
            PromotionItem.belongsTo(models.Promotion, {
                foreignKey: 'promotion_id',
                as: 'promotion'
            });

            PromotionItem.belongsTo(models.Item, {
                foreignKey: 'item_id',
                as: 'item'
            });
        }
    }

    PromotionItem.init(
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

            item_id: {
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
            modelName: 'PromotionItem',
            tableName: 'promotion_items',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return PromotionItem;
};
