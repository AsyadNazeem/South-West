
'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // Add customer_id to promo usage records.
        await queryInterface.addColumn('order_promotions', 'customer_id', {
            type: Sequelize.BIGINT.UNSIGNED,
            allowNull: true,
            references: {
                model: 'customers',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT'
        });

        // Backfill customer_id from each order.
        await queryInterface.sequelize.query(`
            UPDATE order_promotions op
            INNER JOIN orders o ON o.id = op.order_id
            SET op.customer_id = o.customer_id
        `);

        // Existing records must all have a customer before enforcing this.
        await queryInterface.changeColumn('order_promotions', 'customer_id', {
            type: Sequelize.BIGINT.UNSIGNED,
            allowNull: false,
            references: {
                model: 'customers',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT'
        });

        // One use of each promotion per customer.
        await queryInterface.addIndex(
            'order_promotions',
            ['promotion_id', 'customer_id'],
            {
                unique: true,
                name: 'uq_order_promotions_promotion_customer'
            }
        );
    },

    async down(queryInterface) {
        await queryInterface.removeIndex(
            'order_promotions',
            'uq_order_promotions_promotion_customer'
        );

        await queryInterface.removeColumn(
            'order_promotions',
            'customer_id'
        );
    }
};
