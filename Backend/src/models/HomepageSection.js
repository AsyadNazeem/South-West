'use strict';

module.exports = (sequelize, DataTypes) => {
    const HomepageSection = sequelize.define(
        'HomepageSection',
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },

            section_key: {
                type: DataTypes.STRING(100),
                allowNull: false,
                unique: true,
            },

            title: {
                type: DataTypes.STRING(200),
                allowNull: false,
            },

            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },

            sort_order: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },

            settings: {
                type: DataTypes.JSON,
                allowNull: true,
            },
        },
        {
            tableName: 'homepage_sections',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        }
    );

    return HomepageSection;
};
