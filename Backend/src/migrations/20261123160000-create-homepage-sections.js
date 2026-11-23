'use strict';

const defaultSections = [
    ['hero_banner', 'Hero Banner', 0],
    ['shopping_benefits', 'Shopping Benefits', 1],
    ['shop_categories', 'Shop by Category', 2],
    ['shop_brands', 'Shop by Brand', 3],
    ['discount_products', 'Discount Products', 4],
    ['promo_banner_1', 'Promotional Banner 1', 5],
    ['category_product_rows', 'Category Product Rows', 6],
    ['promo_banner_2', 'Promotional Banner 2', 7],
    ['just_for_you', 'Just For You', 8],
];

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('homepage_sections', {
            id: {
                type: Sequelize.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            section_key: {
                type: Sequelize.STRING(100),
                allowNull: false,
                unique: true,
            },
            title: {
                type: Sequelize.STRING(200),
                allowNull: false,
            },
            is_active: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
            sort_order: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            settings: {
                type: Sequelize.JSON,
                allowNull: true,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
        });

        await queryInterface.addIndex(
            'homepage_sections',
            ['is_active', 'sort_order'],
            { name: 'homepage_sections_active_sort_idx' }
        );

        const now = new Date();

        await queryInterface.bulkInsert(
            'homepage_sections',
            defaultSections.map(([section_key, title, sort_order]) => ({
                section_key,
                title,
                sort_order,
                is_active: true,
                settings: JSON.stringify({}),
                created_at: now,
                updated_at: now,
            }))
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('homepage_sections');
    },
};
