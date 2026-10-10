'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class DeliveryCharge extends Model {
        static associate(models) {
            // Relationships can be added later if required
        }
    }

    DeliveryCharge.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },

            district_name: {
                type: DataTypes.STRING(100),
                allowNull: false
            },

            area_name: {
                type: DataTypes.STRING(150),
                allowNull: false
            },

            first_kg_charge: {
                type: DataTypes.DECIMAL(12, 2),
                allowNull: false
            },

            additional_kg_charge: {
                type: DataTypes.DECIMAL(12, 2),
                allowNull: false,
                defaultValue: 100.00
            },

            status: {
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
            modelName: 'DeliveryCharge',
            tableName: 'delivery_charges',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',

            indexes: [
                {
                    unique: true,
                    fields: ['district_name', 'area_name']
                },
                {
                    fields: ['district_name']
                },
                {
                    fields: ['status']
                }
            ]
        }
    );

    return DeliveryCharge;
};
