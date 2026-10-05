'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {

    class Warranty extends Model {

        static associate(models) {

            Warranty.hasMany(models.Item, {
                foreignKey: 'warranty_id',
                as: 'items'

            });

        }
    }

    Warranty.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },

            name: {
                type: DataTypes.STRING(100),
                allowNull: false,
                unique: true
            },

            code: {
                type: DataTypes.STRING(50),
                allowNull: false,
                unique: true
            },

            duration_value: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0
            },

            duration_unit: {
                type: DataTypes.ENUM(
                    'Days',
                    'Months',
                    'Years'
                ),
                allowNull: false,
                defaultValue: 'Months'
            },

            description: {
                type: DataTypes.TEXT,
                allowNull: true
            },

            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true
            }
        },
        {
            sequelize,
            modelName: 'Warranty',
            tableName: 'warranties',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return Warranty;
};
