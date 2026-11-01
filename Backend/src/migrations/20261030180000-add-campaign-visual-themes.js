'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const table = 'discount_campaigns';

        await queryInterface.addColumn(table, 'visual_theme', {
            type: Sequelize.STRING(40),
            allowNull: true,
            defaultValue: null,
        });

        await queryInterface.addColumn(table, 'visual_frame_path', {
            type: Sequelize.STRING(255),
            allowNull: true,
            defaultValue: null,
        });

        await queryInterface.addColumn(table, 'visual_frame_enabled', {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        });

        await queryInterface.addColumn(table, 'visual_priority', {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
        });
    },

    async down(queryInterface) {
        const table = 'discount_campaigns';

        await queryInterface.removeColumn(table, 'visual_priority');
        await queryInterface.removeColumn(table, 'visual_frame_enabled');
        await queryInterface.removeColumn(table, 'visual_frame_path');
        await queryInterface.removeColumn(table, 'visual_theme');
    },
};
