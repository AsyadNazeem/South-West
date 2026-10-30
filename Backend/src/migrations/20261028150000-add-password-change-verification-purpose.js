
'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.changeColumn(
            'customer_email_verifications',
            'purpose',
            {
                type: Sequelize.ENUM(
                    'registration',
                    'activation',
                    'password_change'
                ),
                allowNull: false,
            }
        );
    },

    async down(queryInterface, Sequelize) {
        // Do not remove this purpose while password-change records still use it.
        const [rows] = await queryInterface.sequelize.query(
            "SELECT COUNT(*) AS total FROM customer_email_verifications WHERE purpose = 'password_change'"
        );

        if (Number(rows[0]?.total || 0) > 0) {
            throw new Error(
                'Cannot roll back: password-change verification records exist.'
            );
        }

        await queryInterface.changeColumn(
            'customer_email_verifications',
            'purpose',
            {
                type: Sequelize.ENUM('registration', 'activation'),
                allowNull: false,
            }
        );
    },
};
