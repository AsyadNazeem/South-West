'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class DeliveryStatusHistory extends Model {
        static associate(models) {
            DeliveryStatusHistory.belongsTo(models.Delivery, {
                foreignKey: 'delivery_id',
                as: 'delivery'
            });

            DeliveryStatusHistory.belongsTo(models.User, {
                foreignKey: 'changed_by',
                as: 'changedBy'
            });
        }
    }

    DeliveryStatusHistory.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },

            delivery_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            },

            status: {
                type: DataTypes.ENUM(
                    'pending',
                    'processing',
                    'ready_for_dispatch',
                    'dispatched',
                    'in_transit',
                    'out_for_delivery',
                    'delivered',
                    'failed',
                    'cancelled',
                    'returned'
                ),
                allowNull: false
            },

            notes: {
                type: DataTypes.TEXT,
                allowNull: true
            },

            changed_by: {
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
            modelName: 'DeliveryStatusHistory',
            tableName: 'delivery_status_history',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return DeliveryStatusHistory;
};
