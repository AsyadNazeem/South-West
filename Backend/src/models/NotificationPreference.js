'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class NotificationPreference extends Model {
        static associate(models) {
            NotificationPreference.belongsTo(models.Customer, {
                foreignKey: 'customer_id',
                as: 'customer'
            });
        }
    }

    NotificationPreference.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },

            customer_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            },

            order_updates: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true
            },

            payment_updates: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true
            },

            delivery_updates: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true
            },

            promotional_notifications: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true
            },

            product_updates: {
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
            modelName: 'NotificationPreference',
            tableName: 'notification_preferences',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return NotificationPreference;
};
