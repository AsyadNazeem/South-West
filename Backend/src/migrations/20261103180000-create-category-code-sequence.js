'use strict';

const { QueryTypes } = require('sequelize');

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('category_code_sequences', {
            id: {
                type: Sequelize.TINYINT.UNSIGNED,
                primaryKey: true,
                allowNull: false
            },
            next_value: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false
            }
        });

        // Continue after the highest existing CAT-0001-style category code.
        const rows = await queryInterface.sequelize.query(
            `
                SELECT
                    COALESCE(
                        MAX(CAST(SUBSTRING(code, 5) AS UNSIGNED)),
                        0
                    ) + 1 AS next_value
                FROM categories
                WHERE code REGEXP '^CAT-[0-9]+$'
            `,
            { type: QueryTypes.SELECT }
        );

        await queryInterface.bulkInsert('category_code_sequences', [
            {
                id: 1,
                next_value: rows[0].next_value
            }
        ]);
    },

    async down(queryInterface) {
        await queryInterface.dropTable('category_code_sequences');
    }
};
