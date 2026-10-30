
'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('items', 'qb_item_code', {
            type: Sequelize.STRING(100),
            allowNull: true,
        });

        await queryInterface.createTable('item_code_sequences', {
            id: {
                type: Sequelize.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            sequence_name: {
                type: Sequelize.STRING(50),
                allowNull: false,
                unique: true,
            },
            last_number: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                defaultValue: 0,
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

        await queryInterface.bulkInsert('item_code_sequences', [{
            sequence_name: 'item',
            last_number: 3,
            created_at: new Date(),
            updated_at: new Date(),
        }]);
    },

    async down(queryInterface) {
        await queryInterface.dropTable('item_code_sequences');
        await queryInterface.removeColumn('items', 'qb_item_code');
    },
};
