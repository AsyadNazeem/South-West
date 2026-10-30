'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.changeColumn(
            'inventory_stock_movements',
            'movement_type',
            {
                type: Sequelize.ENUM(
                    'purchase',
                    'goods_receipt',
                    'sale',
                    'customer_return',
                    'supplier_return',
                    'adjustment',
                    'transfer_in',
                    'transfer_out'
                ),
                allowNull: false,
            }
        );
    },

    async down(queryInterface, Sequelize) {
        const [movements] = await queryInterface.sequelize.query(`
            SELECT COUNT(*) AS count
            FROM inventory_stock_movements
            WHERE movement_type = 'goods_receipt'
        `);

        if (Number(movements[0].count) > 0) {
            throw new Error(
                'Cannot remove goods_receipt movement type while movements use it.'
            );
        }

        await queryInterface.changeColumn(
            'inventory_stock_movements',
            'movement_type',
            {
                type: Sequelize.ENUM(
                    'purchase',
                    'sale',
                    'customer_return',
                    'supplier_return',
                    'adjustment',
                    'transfer_in',
                    'transfer_out'
                ),
                allowNull: false,
            }
        );
    },
};