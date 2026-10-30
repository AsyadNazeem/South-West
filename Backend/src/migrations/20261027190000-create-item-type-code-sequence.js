'use strict';

const { QueryTypes } = require('sequelize');

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('item_type_code_sequences', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                allowNull: false
            },
            next_value: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 1
            }
        });

        // Continue after existing TYPE-0001-style item type codes.
        const existingCodes = await queryInterface.sequelize.query(
            "SELECT code FROM item_types WHERE code REGEXP '^TYPE-[0-9]+$'",
            { type: QueryTypes.SELECT }
        );

        let nextValue = 1;

        for (const row of existingCodes) {
            const match = /^TYPE-(\d+)$/i.exec(String(row.code || ''));

            if (match) {
                nextValue = Math.max(
                    nextValue,
                    Number(match[1]) + 1
                );
            }
        }

        await queryInterface.bulkInsert('item_type_code_sequences', [
            {
                id: 1,
                next_value: nextValue
            }
        ]);
    },

    async down(queryInterface) {
        await queryInterface.dropTable('item_type_code_sequences');
    }
};
