'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.changeColumn('goods_receipts', 'purchase_order_id', {
            type: Sequelize.BIGINT.UNSIGNED,
            allowNull: true,
        });

        await queryInterface.changeColumn(
            'goods_receipt_items',
            'purchase_order_item_id',
            {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: true,
            }
        );
    },

    async down(queryInterface, Sequelize) {
        const [receipts] = await queryInterface.sequelize.query(`
            SELECT COUNT(*) AS count
            FROM goods_receipts
            WHERE purchase_order_id IS NULL
        `);

        const [items] = await queryInterface.sequelize.query(`
            SELECT COUNT(*) AS count
            FROM goods_receipt_items
            WHERE purchase_order_item_id IS NULL
        `);

        if (
            Number(receipts[0].count) > 0 ||
            Number(items[0].count) > 0
        ) {
            throw new Error(
                'Cannot reverse GRN migration while records have no Purchase Order reference.'
            );
        }

        await queryInterface.changeColumn(
            'goods_receipt_items',
            'purchase_order_item_id',
            {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
            }
        );

        await queryInterface.changeColumn(
            'goods_receipts',
            'purchase_order_id',
            {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
            }
        );
    },
};