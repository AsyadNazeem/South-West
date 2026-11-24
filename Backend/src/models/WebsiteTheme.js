'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class WebsiteTheme extends Model {}

    WebsiteTheme.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            name: {
                type: DataTypes.STRING(120),
                allowNull: false,
            },
            slug: {
                type: DataTypes.STRING(120),
                allowNull: false,
                unique: true,
            },
            description: {
                type: DataTypes.STRING(500),
                allowNull: true,
            },
            config: {
                type: DataTypes.JSON,
                allowNull: false,
                get() {
                    const value = this.getDataValue('config');

                    if (typeof value === 'string') {
                        try {
                            return JSON.parse(value);
                        } catch {
                            return {};
                        }
                    }

                    return value;
                },
                set(value) {
                    if (typeof value === 'string') {
                        try {
                            value = JSON.parse(value);
                        } catch {
                            throw new Error('Invalid website theme configuration JSON.');
                        }
                    }

                    this.setDataValue('config', value);
                },
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            starts_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            ends_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        {
            sequelize,
            modelName: 'WebsiteTheme',
            tableName: 'website_themes',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        }
    );

    return WebsiteTheme;
};
