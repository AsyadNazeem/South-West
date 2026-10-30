
'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('homepage_banner_locks', {
            id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                primaryKey: true,
            },
        });

        await queryInterface.bulkInsert('homepage_banner_locks', [
            { id: 1 },
        ]);
    },

    async down(queryInterface) {
        await queryInterface.dropTable('homepage_banner_locks');
    },
};
