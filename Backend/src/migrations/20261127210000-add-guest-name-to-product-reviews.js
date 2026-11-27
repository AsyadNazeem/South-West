'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn(
            'product_reviews',
            'guest_name',
            {
                type: Sequelize.STRING(100),
                allowNull: true,
            }
        );
    },

    async down(queryInterface) {
        const [rows] = await queryInterface.sequelize.query(
            `SELECT COUNT(*) AS total
             FROM product_reviews
             WHERE guest_name IS NOT NULL`
        );

        if (Number(rows[0].total) > 0) {
            throw new Error(
                'Guest names exist. Back up and review the data before rollback.'
            );
        }

        await queryInterface.removeColumn(
            'product_reviews',
            'guest_name'
        );
    },
};
