'use strict';

const { QueryTypes } = require('sequelize');

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable(
            'inventory_location_code_sequences',
            {
                id: {
                    type: Sequelize.TINYINT.UNSIGNED,
                    primaryKey: true,
                    allowNull: false
                },
                next_value: {
                    type: Sequelize.BIGINT.UNSIGNED,
                    allowNull: false
                }
            }
        );

        const existingCodes = await queryInterface.sequelize.query(
            "SELECT code FROM inventory_locations WHERE code REGEXP '^LOC-[0-9]+$'",
            { type: QueryTypes.SELECT }
        );

        let nextValue = 1;

        for (const row of existingCodes) {
            const match = /^LOC-(\d+)$/i.exec(String(row.code || ''));

            if (match) {
                nextValue = Math.max(
                    nextValue,
                    Number(match[1]) + 1
                );
            }
        }

        await queryInterface.bulkInsert(
            'inventory_location_code_sequences',
            [{ id: 1, next_value: nextValue }]
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable(
            'inventory_location_code_sequences'
        );
    }
};
