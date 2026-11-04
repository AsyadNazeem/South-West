'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.changeColumn('payments', 'payment_method', {
            type: Sequelize.ENUM(
                'cash',
                'card',
                'bank_transfer',
                'online',
                'wallet',
                'cheque',
                'other',
                'koko',
                'mintpay'
            ),
            allowNull: false
        });

        await queryInterface.changeColumn('payments', 'payment_status', {
            type: Sequelize.ENUM(
                'pending',
                'authorized',
                'paid',
                'failed',
                'cancelled',
                'refunded',
                'partially_refunded',
                'unpaid',
                'partially_paid'
            ),
            allowNull: false,
            defaultValue: 'unpaid'
        });
    },

    async down() {
        // Retain expanded ENUMs to protect existing payment records.
    }
};
