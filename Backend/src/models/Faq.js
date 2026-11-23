'use strict';

module.exports = (sequelize, DataTypes) => {
    const Faq = sequelize.define(
        'Faq',
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            question: {
                type: DataTypes.STRING(500),
                allowNull: false,
            },
            answer: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            category: {
                type: DataTypes.STRING(100),
                allowNull: true,
            },
            link_url: {
                type: DataTypes.STRING(1000),
                allowNull: true,
            },
            link_text: {
                type: DataTypes.STRING(150),
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
                defaultValue: true,
            },
        },
        {
            tableName: 'faqs',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        }
    );

    return Faq;
};
