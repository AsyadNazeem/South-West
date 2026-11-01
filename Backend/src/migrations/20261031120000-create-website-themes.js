'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('website_themes', {
            id: {
                type: Sequelize.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            name: {
                type: Sequelize.STRING(120),
                allowNull: false,
            },
            slug: {
                type: Sequelize.STRING(120),
                allowNull: false,
                unique: true,
            },
            description: {
                type: Sequelize.STRING(500),
                allowNull: true,
            },
            config: {
                type: Sequelize.JSON,
                allowNull: false,
            },
            is_active: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            starts_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            ends_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
        });

        await queryInterface.addIndex(
            'website_themes',
            ['is_active', 'starts_at', 'ends_at'],
            { name: 'idx_website_themes_active_schedule' }
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('website_themes');
    },
};
