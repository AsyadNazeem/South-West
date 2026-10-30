'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.changeColumn(
            'customer_checkout_sessions',
            'variant_id',
            {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: true,
                defaultValue: null,
                references: {
                    model: 'item_variants',
                    key: 'id',
                },
                onUpdate: 'RESTRICT',
                onDelete: 'RESTRICT',
            }
        );
    },

    async down(queryInterface, Sequelize) {
        const [rows] = await queryInterface.sequelize.query(
            'SELECT COUNT(*) AS total FROM customer_checkout_sessions WHERE variant_id IS NULL'
        );

        if (Number(rows[0].total) > 0) {
            throw new Error(
                'Cannot reverse this migration while checkout sessions have NULL variant_id values.'
            );
        }

        await queryInterface.changeColumn(
            'customer_checkout_sessions',
            'variant_id',
            {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                references: {
                    model: 'item_variants',
                    key: 'id',
                },
                onUpdate: 'RESTRICT',
                onDelete: 'RESTRICT',
            }
        );
    },
};
