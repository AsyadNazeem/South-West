'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('unit_code_sequences', {
            id: {
                type: Sequelize.TINYINT.UNSIGNED,
                primaryKey: true,
                allowNull: false,
            },
            next_value: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
            },
        });

        await queryInterface.bulkInsert('unit_code_sequences', [
            {
                id: 1,
                next_value: 1,
            },
        ]);
    },

    async down(queryInterface) {
        await queryInterface.dropTable('unit_code_sequences');
    },
};
