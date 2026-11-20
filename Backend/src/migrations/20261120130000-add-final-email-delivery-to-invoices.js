'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('invoices', 'final_email_status', {
            type: Sequelize.ENUM('sending', 'sent', 'failed'),
            allowNull: true
        });
        await queryInterface.addColumn('invoices', 'final_email_claimed_at', {
            type: Sequelize.DATE,
            allowNull: true
        });
        await queryInterface.addColumn('invoices', 'final_email_sent_at', {
            type: Sequelize.DATE,
            allowNull: true
        });
        await queryInterface.addColumn('invoices', 'final_email_attempts', {
            type: Sequelize.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 0
        });
        await queryInterface.addColumn('invoices', 'final_email_last_error', {
            type: Sequelize.STRING(500),
            allowNull: true
        });
        await queryInterface.addIndex('invoices', ['final_email_status'], {
            name: 'idx_invoices_final_email_status'
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex(
            'invoices',
            'idx_invoices_final_email_status'
        );
        await queryInterface.removeColumn('invoices', 'final_email_last_error');
        await queryInterface.removeColumn('invoices', 'final_email_attempts');
        await queryInterface.removeColumn('invoices', 'final_email_sent_at');
        await queryInterface.removeColumn('invoices', 'final_email_claimed_at');
        await queryInterface.removeColumn('invoices', 'final_email_status');
    }
};
