'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('homepage_banners', 'placement', {
            type: Sequelize.ENUM('hero', 'promo_1', 'promo_2'),
            allowNull: false,
            defaultValue: 'hero',
        });

        await queryInterface.addIndex(
            'homepage_banners',
            ['placement', 'is_active', 'sort_order'],
            { name: 'idx_homepage_banners_placement_active_order' }
        );
    },

    async down(queryInterface) {
        await queryInterface.removeIndex(
            'homepage_banners',
            'idx_homepage_banners_placement_active_order'
        );

        await queryInterface.removeColumn(
            'homepage_banners',
            'placement'
        );
    },
};
