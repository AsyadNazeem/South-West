'use strict';

module.exports = {
    async up(queryInterface) {
        await queryInterface.addIndex(
            'item_prices',
            ['variant_id', 'price_type', 'currency', 'is_active'],
            {
                name: 'item_prices_variant_listing_idx'
            }
        );
    },

    async down(queryInterface) {
        await queryInterface.removeIndex(
            'item_prices',
            'item_prices_variant_listing_idx'
        );
    }
};
