'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // MySQL commits DDL separately. Resume safely after a partial run.
        const columns = await queryInterface.describeTable('items');
        if (!columns.new_label_duration) {
            await queryInterface.addColumn('items', 'new_label_duration', {
                type: Sequelize.ENUM('14_days', '1_month', '2_months'), allowNull: true,
            });
        }
        if (!columns.new_label_expires_at_ms) {
            await queryInterface.addColumn('items', 'new_label_expires_at_ms', {
                type: Sequelize.BIGINT.UNSIGNED, allowNull: true,
            });
        }
        // CLI sessions use Asia/Colombo's +05:30. DATE_ADD clamps month ends.
        await queryInterface.sequelize.query(`UPDATE items
            SET new_label_duration = '1_month',
                new_label_expires_at_ms = UNIX_TIMESTAMP(DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL 1 MONTH)) * 1000
            WHERE is_new = 1 AND new_label_expires_at_ms IS NULL`);
    },
    async down(queryInterface) {
        // An old backend reads only is_new. Do not resurrect expired badges.
        await queryInterface.sequelize.query(`UPDATE items SET is_new = 0
            WHERE is_new = 1 AND new_label_expires_at_ms <= UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000`);
        const columns = await queryInterface.describeTable('items');

        if (columns.new_label_expires_at_ms) {
            await queryInterface.removeColumn('items', 'new_label_expires_at_ms');
        }

        if (columns.new_label_duration) {
            await queryInterface.removeColumn('items', 'new_label_duration');
        }
    },
};
