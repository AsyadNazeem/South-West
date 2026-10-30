
'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // Remove the duplicate foreign-key constraint.
        await queryInterface.removeConstraint(
            'order_promotions',
            'order_promotions_customer_id_foreign_idx'
        );

        // Keep the original order_promotions_ibfk_3 constraint.
        // Make customer_id mandatory.
        await queryInterface.changeColumn(
            'order_promotions',
            'customer_id',
            {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                references: {
                    model: 'customers',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT'
            }
        );
    },

    async down(queryInterface, Sequelize) {
        // Restore nullable customer_id.
        await queryInterface.changeColumn(
            'order_promotions',
            'customer_id',
            {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: true,
                references: {
                    model: 'customers',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT'
            }
        );

        // Restore the removed foreign-key constraint.
        await queryInterface.addConstraint('order_promotions', {
            fields: ['customer_id'],
            type: 'foreign key',
            name: 'order_promotions_customer_id_foreign_idx',
            references: {
                table: 'customers',
                field: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT'
        });
    }
};
