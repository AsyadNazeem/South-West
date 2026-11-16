'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class ProductReviewImage extends Model {
        static associate(models) {
            ProductReviewImage.belongsTo(models.ProductReview, {
                foreignKey: 'product_review_id',
                as: 'review'
            });
        }
    }

    ProductReviewImage.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },
            product_review_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            },
            file_path: {
                type: DataTypes.STRING(500),
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
            modelName: 'ProductReviewImage',
            tableName: 'product_review_images',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return ProductReviewImage;
};
