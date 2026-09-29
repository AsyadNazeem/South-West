'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Supplier extends Model {
        static associate(models) {
            Supplier.hasMany(models.PurchaseOrder, {
                foreignKey: 'supplier_id',
                as: 'purchaseOrders'
            });
        }
    }

    Supplier.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },

            supplier_code: {
                type: DataTypes.STRING(50),
                allowNull: false,
                unique: true
            },

            company_name: {
                type: DataTypes.STRING(150),
                allowNull: false
            },

            contact_person: {
                type: DataTypes.STRING(150),
                allowNull: true
            },

            email: {
                type: DataTypes.STRING(150),
                allowNull: true
            },

            phone: {
                type: DataTypes.STRING(50),
                allowNull: true
            },

            address_line_1: {
                type: DataTypes.STRING(255),
                allowNull: true
            },

            address_line_2: {
                type: DataTypes.STRING(255),
                allowNull: true
            },

            city: {
                type: DataTypes.STRING(100),
                allowNull: true
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
                allowNull: true,
                defaultValue: 'Sri Lanka'
            },

            tax_number: {
                type: DataTypes.STRING(100),
                allowNull: true
            },

            payment_terms: {
                type: DataTypes.STRING(100),
                allowNull: true
            },

            notes: {
                type: DataTypes.TEXT,
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
            modelName: 'Supplier',
            tableName: 'suppliers',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return Supplier;
};
