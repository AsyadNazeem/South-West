
'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class ItemPaymentPrice extends Model {
        static associate(models) {
            ItemPaymentPrice.belongsTo(models.Item, {
                foreignKey: 'item_id',
                as: 'item'
            });

            ItemPaymentPrice.belongsTo(models.ItemVariant, {
                foreignKey: 'variant_id',
                as: 'variant'
            });
        }
    }

    ItemPaymentPrice.init(
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
            variant_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: true
            },
            payment_method: {
                type: DataTypes.STRING(20),
                allowNull: false,
                validate: {
                    isIn: [['cash', 'card', 'koko', 'mintpay']]
                }
            },
            price: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false,
                validate: {
                    min: 0
                }
            },
            currency: {
                type: DataTypes.STRING(3),
                allowNull: false,
                defaultValue: 'LKR'
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true
            }
        },
        {
            sequelize,
            modelName: 'ItemPaymentPrice',
            tableName: 'item_payment_prices',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return ItemPaymentPrice;
};
