'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const transaction = await queryInterface.sequelize.transaction();

        try {
            const existing = await queryInterface.sequelize.query(
                'SELECT section_key FROM homepage_sections WHERE section_key = :key',
                {
                    replacements: { key: 'top_rated_products' },
                    type: Sequelize.QueryTypes.SELECT,
                    transaction,
                }
            );

            if (existing.length === 0) {
                const now = new Date();

                const [rows] = await queryInterface.sequelize.query(
                    'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM homepage_sections',
                    { transaction }
                );

                await queryInterface.bulkInsert(
                    'homepage_sections',
                    [{
                        section_key: 'top_rated_products',
                        title: 'Top Rated Products',
                        is_active: true,
                        sort_order: Number(rows[0].max_order) + 1,
                        settings: JSON.stringify({}),
                        created_at: now,
                        updated_at: now,
                    }],
                    { transaction }
                );
            }

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    },

    async down(queryInterface) {
        await queryInterface.bulkDelete(
            'homepage_sections',
            { section_key: 'top_rated_products' }
        );
    },
};
