'use strict';

const crypto = require('crypto');

function generateGuestNumber(usedNumbers) {
    let number;

    do {
        number = String(crypto.randomInt(100000, 1000000));
    } while (usedNumbers.has(number));

    usedNumbers.add(number);
    return number;
}

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('product_reviews', 'guest_number', {
            type: Sequelize.STRING(6),
            allowNull: true,
        });

        await queryInterface.addColumn('product_reviews', 'display_name', {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        });

        const [guestReviews] = await queryInterface.sequelize.query(
            `SELECT id FROM product_reviews WHERE customer_id IS NULL`
        );

        const usedNumbers = new Set();

        for (const review of guestReviews) {
            const guestNumber = generateGuestNumber(usedNumbers);

            await queryInterface.sequelize.query(
                `UPDATE product_reviews SET guest_number = :guestNumber WHERE id = :id`,
                {
                    replacements: {
                        guestNumber,
                        id: review.id,
                    },
                }
            );
        }

        await queryInterface.addIndex(
            'product_reviews',
            ['guest_number'],
            {
                name: 'product_reviews_guest_number_unique',
                unique: true,
            }
        );

        await queryInterface.removeIndex(
            'product_reviews',
            'product_reviews_item_guest_email_unique'
        );

        await queryInterface.removeColumn('product_reviews', 'guest_name');
        await queryInterface.removeColumn('product_reviews', 'guest_email');
    },

    async down() {
        throw new Error(
            'Manual review required before rolling back guest review privacy changes.'
        );
    },
};
