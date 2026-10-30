
'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('homepage_banners', {
            id: {
                type: Sequelize.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            title: {
                type: Sequelize.STRING(150),
                allowNull: true,
            },
            subtitle: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            image_path: {
                type: Sequelize.STRING(500),
                allowNull: false,
            },
            mobile_image_path: {
                type: Sequelize.STRING(500),
                allowNull: true,
            },
            button_text: {
                type: Sequelize.STRING(60),
                allowNull: true,
            },
            link_url: {
                type: Sequelize.STRING(1000),
                allowNull: true,
            },
            sort_order: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            is_active: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            start_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            end_at: {
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
                defaultValue: Sequelize.literal(
                    'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
                ),
            },
        });

        await queryInterface.addIndex(
            'homepage_banners',
            ['is_active', 'sort_order'],
            { name: 'idx_homepage_banners_active_order' }
        );

        await queryInterface.addIndex(
            'homepage_banners',
            ['start_at', 'end_at'],
            { name: 'idx_homepage_banners_schedule' }
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('homepage_banners');
    },
};
