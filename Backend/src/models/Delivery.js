'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Delivery extends Model {
        static associate(models) {
            Delivery.belongsTo(models.Order, {
                foreignKey: 'order_id',
                as: 'order'
            });

            Delivery.hasMany(models.DeliveryStatusHistory, {
                foreignKey: 'delivery_id',
                as: 'statusHistory'
            });
        }
    }

    Delivery.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },

            delivery_reference: {
                type: DataTypes.STRING(100),
                allowNull: false,
                unique: true
            },

            order_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            },

            delivery_method: {
                type: DataTypes.ENUM(
                    'standard',
                    'express',
                    'pickup',
                    'courier'
                ),
                allowNull: false,
                defaultValue: 'standard'
            },

            delivery_status: {
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
                allowNull: false,
                defaultValue: 'pending'
            },

            recipient_name: {
                type: DataTypes.STRING(150),
                allowNull: false
            },

            recipient_phone: {
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

            delivery_charge: {
                type: DataTypes.DECIMAL(15, 2),
                allowNull: false,
                defaultValue: 0
            },

            tracking_number: {
                type: DataTypes.STRING(150),
                allowNull: true
            },

            courier_name: {
                type: DataTypes.STRING(150),
                allowNull: true
            },

            expected_delivery_date: {
                type: DataTypes.DATE,
                allowNull: true
            },

            dispatched_at: {
                type: DataTypes.DATE,
                allowNull: true
            },

            delivered_at: {
                type: DataTypes.DATE,
                allowNull: true
            },

            notes: {
                type: DataTypes.TEXT,
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
            modelName: 'Delivery',
            tableName: 'deliveries',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return Delivery;
};
