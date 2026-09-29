'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Promotion extends Model {
        static associate(models) {
            Promotion.belongsTo(models.User, {
                foreignKey: 'created_by',
                as: 'creator'
            });

            Promotion.hasMany(models.PromotionItem, {
                foreignKey: 'promotion_id',
                as: 'items'
            });

            Promotion.hasMany(models.PromotionCategory, {
                foreignKey: 'promotion_id',
                as: 'categories'
            });

            Promotion.hasMany(models.OrderPromotion, {
                foreignKey: 'promotion_id',
                as: 'orderPromotions'
            });
        }
    }

    Promotion.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },

            promotion_code: {
                type: DataTypes.STRING(100),
                allowNull: false,
                unique: true
            },

            promotion_name: {
                type: DataTypes.STRING(150),
                allowNull: false
            },

            description: {
                type: DataTypes.TEXT,
                allowNull: true
            },

            promotion_type: {
                type: DataTypes.ENUM(
                    'percentage',
                    'fixed_amount',
                    'buy_x_get_y',
                    'free_shipping'
                ),
                allowNull: false
            },

            discount_value: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: true
            },

            minimum_order_amount: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: true
            },

            maximum_discount_amount: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: true
            },

            usage_limit: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: true
            },

            usage_limit_per_customer: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: true
            },

            used_count: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: false,
                defaultValue: 0
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

            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true
            },

            created_by: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: true
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
            modelName: 'Promotion',
            tableName: 'promotions',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return Promotion;
};
