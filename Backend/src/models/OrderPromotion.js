'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class OrderPromotion extends Model {
        static associate(models) {
            OrderPromotion.belongsTo(models.Order, {
                foreignKey: 'order_id',
                as: 'order'
            });

            OrderPromotion.belongsTo(models.Promotion, {
                foreignKey: 'promotion_id',
                as: 'promotion'
            });
        }
    }

    OrderPromotion.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },

            order_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            },

            promotion_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            },

            promotion_code: {
                type: DataTypes.STRING(100),
                allowNull: false
            },

            discount_amount: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false,
                defaultValue: 0
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
            modelName: 'OrderPromotion',
            tableName: 'order_promotions',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return OrderPromotion;
};
