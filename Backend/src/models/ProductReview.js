'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class ProductReview extends Model {
        static associate(models) {
            ProductReview.belongsTo(models.Item, {
                foreignKey: 'item_id',
                as: 'item'
            });

            ProductReview.belongsTo(models.Customer, {
                foreignKey: 'customer_id',
                as: 'customer'
            });

            ProductReview.belongsTo(models.Order, {
                foreignKey: 'order_id',
                as: 'order'
            });
        }
    }

    ProductReview.init(
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

            customer_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            },

            order_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: true
            },

            rating: {
                type: DataTypes.TINYINT.UNSIGNED,
                allowNull: false,
                validate: {
                    min: 1,
                    max: 5
                }
            },

            review_title: {
                type: DataTypes.STRING(200),
                allowNull: true
            },

            review_text: {
                type: DataTypes.TEXT,
                allowNull: true
            },

            status: {
                type: DataTypes.ENUM(
                    'pending',
                    'approved',
                    'rejected'
                ),
                allowNull: false,
                defaultValue: 'pending'
            },

            is_verified_purchase: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false
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
            modelName: 'ProductReview',
            tableName: 'product_reviews',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return ProductReview;
};
