'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('promotions', 'eligibility_type', {
            type: Sequelize.ENUM(
                'all_products',
                'selected_products',
                'selected_categories',
                'selected_brands'
            ),
            allowNull: false,
            defaultValue: 'all_products'
        });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn(
            'promotions',
            'eligibility_type'
        );
    }
};