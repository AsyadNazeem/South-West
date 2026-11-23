'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class ContactInformation extends Model {}

    ContactInformation.init(
        {
            id: {
                type: DataTypes.TINYINT.UNSIGNED,
                primaryKey: true,
                allowNull: false
            },
            support_phone: {
                type: DataTypes.STRING(50),
                allowNull: true
            },
            whatsapp_number: {
                type: DataTypes.STRING(50),
                allowNull: true
            },
            support_email: {
                type: DataTypes.STRING(255),
                allowNull: true
            },
            business_address: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            support_hours: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            google_maps_url: {
                type: DataTypes.STRING(1000),
                allowNull: true
            },
            facebook_url: {
                type: DataTypes.STRING(1000),
                allowNull: true
            },
            instagram_url: {
                type: DataTypes.STRING(1000),
                allowNull: true
            },
            tiktok_url: {
                type: DataTypes.STRING(1000),
                allowNull: true
            },
            response_time: {
                type: DataTypes.STRING(255),
                allowNull: true
            },
            allow_customer_visits: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false
            }
        },
        {
            sequelize,
            modelName: 'ContactInformation',
            tableName: 'contact_information',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return ContactInformation;
};
