'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('guest_checkout_sessions', {
            id: {
                type: Sequelize.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },
            token_hash: {
                type: Sequelize.CHAR(64),
                allowNull: false,
                unique: true
            },
            cart_items: {
                type: Sequelize.JSON,
                allowNull: false
            },
            expires_at: {
                type: Sequelize.DATE,
                allowNull: false
            },
            consumed_at: {
                type: Sequelize.DATE,
                allowNull: true,
                defaultValue: null
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false
            }
        });

        await queryInterface.addIndex(
            'guest_checkout_sessions',
            ['expires_at'],
            { name: 'idx_guest_checkout_sessions_expiry' }
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('guest_checkout_sessions');
    }
};
