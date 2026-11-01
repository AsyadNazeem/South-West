'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('customer_sessions', {
            id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
            },
            customer_id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                references: {
                    model: 'customers',
                    key: 'id',
                },
                onUpdate: 'RESTRICT',
                onDelete: 'RESTRICT',
            },
            token_hash: {
                type: Sequelize.CHAR(64),
                allowNull: false,
            },
            expires_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            revoked_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            ip_address: {
                type: Sequelize.STRING(45),
                allowNull: true,
            },
            user_agent: {
                type: Sequelize.STRING(500),
                allowNull: true,
            },
            session_uuid: {
                type: Sequelize.CHAR(36),
                allowNull: true,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal(
                    'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
                ),
            },
        });

        await queryInterface.addIndex(
            'customer_sessions',
            ['token_hash'],
            {
                name: 'uq_customer_sessions_token_hash',
                unique: true,
            }
        );

        await queryInterface.addIndex(
            'customer_sessions',
            ['customer_id'],
            {
                name: 'idx_customer_sessions_customer_id',
            }
        );

        await queryInterface.addIndex(
            'customer_sessions',
            ['expires_at'],
            {
                name: 'idx_customer_sessions_expiry',
            }
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('customer_sessions');
    },
};