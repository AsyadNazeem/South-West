'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('brand_code_sequences', {
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

        // Existing brand codes are preserved.
        // New generated codes start at BR-0001.
        await queryInterface.bulkInsert('brand_code_sequences', [
            {
                id: 1,
                next_value: 1,
            },
        ]);
    },

    async down(queryInterface) {
        await queryInterface.dropTable('brand_code_sequences');
    },
};