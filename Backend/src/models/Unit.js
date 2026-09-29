'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Unit extends Model {
        static associate(models) {
            Unit.hasMany(models.Item, {
                foreignKey: 'unit_id',
                as: 'items'
            });
        }
    }

    Unit.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },

            name: {
                type: DataTypes.STRING(50),
                allowNull: false,
                unique: true
            },

            code: {
                type: DataTypes.STRING(20),
                allowNull: false,
                unique: true
            },

            description: {
                type: DataTypes.STRING(255),
                allowNull: true
            },

            is_active: {
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
            modelName: 'Unit',
            tableName: 'units',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return Unit;
};
