'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('orders', 'customer_email', {
            type: Sequelize.STRING(255),
            allowNull: true,
            after: 'customer_id'
        });

        await queryInterface.addIndex('customers', ['email'], {
            name: 'uq_customers_email',
            unique: true
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex(
            'customers',
            'uq_customers_email'
        );

        await queryInterface.removeColumn('orders', 'customer_email');
    }
};
