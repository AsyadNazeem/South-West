'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('faqs', {
            id: {
                type: Sequelize.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            question: {
                type: Sequelize.STRING(500),
                allowNull: false,
            },
            answer: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            category: {
                type: Sequelize.STRING(100),
                allowNull: true,
            },
            link_url: {
                type: Sequelize.STRING(1000),
                allowNull: true,
            },
            link_text: {
                type: Sequelize.STRING(150),
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
                defaultValue: true,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
        });

        await queryInterface.addIndex(
            'faqs',
            ['is_active', 'sort_order'],
            { name: 'faqs_active_sort_idx' }
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('faqs');
    },
};
