
'use strict';

module.exports = {
    async up(queryInterface) {
        const [duplicates] = await queryInterface.sequelize.query(`
            SELECT purchase_order_id, item_id, COUNT(*) AS duplicate_count
            FROM purchase_order_items
            GROUP BY purchase_order_id, item_id
            HAVING COUNT(*) > 1
        `);

        if (duplicates.length > 0) {
            throw new Error(
                'Cannot add unique index: duplicate purchase order items exist.'
            );
        }

        await queryInterface.addIndex(
            'purchase_order_items',
            ['purchase_order_id', 'item_id'],
            {
                name: 'purchase_order_items_order_item_unique',
                unique: true
            }
        );
    },

    async down(queryInterface) {
        await queryInterface.removeIndex(
            'purchase_order_items',
            'purchase_order_items_order_item_unique'
        );
    }
};
