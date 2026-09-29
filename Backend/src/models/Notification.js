'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Notification extends Model {
        static associate(models) {
            Notification.belongsTo(models.Customer, {
                foreignKey: 'customer_id',
                as: 'customer'
            });
        }
    }

    Notification.init(
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

            type: {
                type: DataTypes.STRING(100),
                allowNull: false
            },

            title: {
                type: DataTypes.STRING(200),
                allowNull: false
            },

            message: {
                type: DataTypes.TEXT,
                allowNull: false
            },

            reference_type: {
                type: DataTypes.STRING(100),
                allowNull: true
            },

            reference_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: true
            },

            is_read: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false
            },

            read_at: {
                type: DataTypes.DATE,
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
            modelName: 'Notification',
            tableName: 'notifications',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return Notification;
};
