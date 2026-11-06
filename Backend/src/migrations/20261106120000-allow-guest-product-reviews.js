'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.changeColumn('product_reviews', 'customer_id', {
            type: Sequelize.BIGINT.UNSIGNED,
            allowNull: true,
        });

        await queryInterface.addColumn('product_reviews', 'guest_name', {
            type: Sequelize.STRING(100),
            allowNull: true,
        });

        await queryInterface.addColumn('product_reviews', 'guest_email', {
            type: Sequelize.STRING(254),
            allowNull: true,
        });

        await queryInterface.addIndex(
            'product_reviews',
            ['item_id', 'guest_email'],
            {
                name: 'product_reviews_item_guest_email_unique',
                unique: true,
            }
        );
    },

    async down() {
        throw new Error(
            'Manual review required before rolling back guest product reviews. ' +
            'Guest review records must be handled before customer_id can become NOT NULL.'
        );
    },
};
