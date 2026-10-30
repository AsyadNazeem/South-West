
'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('customer_code_sequences', {
            id: {
                type: Sequelize.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            customer_type: {
                type: Sequelize.ENUM('self_registered', 'staff_created'),
                allowNull: false,
            },
            sequence_year: {
                type: Sequelize.SMALLINT.UNSIGNED,
                allowNull: false,
            },
            last_number: {
                type: Sequelize.INTEGER.UNSIGNED,
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

        await queryInterface.addConstraint('customer_code_sequences', {
            fields: ['customer_type', 'sequence_year'],
            type: 'unique',
            name: 'uq_customer_code_sequence_type_year',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('customer_code_sequences');
    },
};
