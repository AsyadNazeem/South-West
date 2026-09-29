'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class OrderAddress extends Model {
        static associate(models) {
            OrderAddress.belongsTo(models.Order, {
                foreignKey: 'order_id',
                as: 'order'
            });
        }
    }

    OrderAddress.init(
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

            address_type: {
                type: DataTypes.ENUM(
                    'billing',
                    'shipping'
                ),
                allowNull: false
            },

            recipient_name: {
                type: DataTypes.STRING(150),
                allowNull: false
            },

            phone: {
                type: DataTypes.STRING(30),
                allowNull: true
            },

            address_line_1: {
                type: DataTypes.STRING(255),
                allowNull: false
            },

            address_line_2: {
                type: DataTypes.STRING(255),
                allowNull: true
            },

            city: {
                type: DataTypes.STRING(100),
                allowNull: false
            },

            state: {
                type: DataTypes.STRING(100),
                allowNull: true
            },

            postal_code: {
                type: DataTypes.STRING(20),
                allowNull: true
            },

            country: {
                type: DataTypes.STRING(100),
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
            modelName: 'OrderAddress',
            tableName: 'order_addresses',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return OrderAddress;
};
