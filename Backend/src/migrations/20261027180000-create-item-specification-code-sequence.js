'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('item_specification_code_sequences', {
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

        const [rows] = await queryInterface.sequelize.query(`
            SELECT MAX(CAST(SUBSTRING(code, 6) AS UNSIGNED)) AS max_code
            FROM item_specifications
            WHERE code REGEXP '^SPEC-[0-9]+$'
        `);

        const nextValue = Number(rows[0]?.max_code || 0) + 1;

        await queryInterface.bulkInsert(
            'item_specification_code_sequences',
            [{ id: 1, next_value: nextValue }]
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('item_specification_code_sequences');
    },
};
