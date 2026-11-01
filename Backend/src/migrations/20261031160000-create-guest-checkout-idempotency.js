
'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('guest_checkout_idempotency', {
            id: {
                type: Sequelize.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },
            guest_checkout_session_id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                references: {
                    model: 'guest_checkout_sessions',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            idempotency_key: {
                type: Sequelize.STRING(100),
                allowNull: false
            },
            request_hash: {
                type: Sequelize.CHAR(64),
                allowNull: false
            },
            order_id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: true
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
            'guest_checkout_idempotency',
            ['guest_checkout_session_id', 'idempotency_key'],
            {
                name: 'uq_guest_checkout_idempotency_session_key',
                unique: true
            }
        );

        await queryInterface.addIndex(
            'guest_checkout_idempotency',
            ['order_id'],
            {
                name: 'idx_guest_checkout_idempotency_order'
            }
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('guest_checkout_idempotency');
    }
};
