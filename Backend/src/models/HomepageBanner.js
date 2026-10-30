
'use strict';

module.exports = (sequelize, DataTypes) => {
    const HomepageBanner = sequelize.define(
        'HomepageBanner',
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },

            title: {
                type: DataTypes.STRING(150),
                allowNull: true,
            },

            subtitle: {
                type: DataTypes.STRING(255),
                allowNull: true,
            },

            image_path: {
                type: DataTypes.STRING(500),
                allowNull: false,
            },

            mobile_image_path: {
                type: DataTypes.STRING(500),
                allowNull: true,
            },

            button_text: {
                type: DataTypes.STRING(60),
                allowNull: true,
            },

            link_url: {
                type: DataTypes.STRING(1000),
                allowNull: true,
            },

            sort_order: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },

            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },

            start_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },

            end_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        {
            tableName: 'homepage_banners',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        }
    );

    return HomepageBanner;
};
