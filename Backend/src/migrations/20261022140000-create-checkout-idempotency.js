
'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const tables = await queryInterface.showAllTables();

        const tableExists = tables.some(table =>
            String(
                typeof table === 'string' ? table : table.tableName
            ).toLowerCase() === 'checkout_idempotency'
        );

        // Preserve the existing table and its data.
        if (tableExists) {
            return;
        }

        await queryInterface.createTable('checkout_idempotency', {
            id: {
                type: Sequelize.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            customer_id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                references: {
                    model: 'customers',
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            idempotency_key: {
                type: Sequelize.STRING(100),
                allowNull: false,
            },
            request_hash: {
                type: Sequelize.CHAR(64),
                allowNull: false,
            },
            order_id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: true,
                references: {
                    model: 'orders',
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL',
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
            'checkout_idempotency',
            ['customer_id', 'idempotency_key'],
            {
                name: 'uq_checkout_customer_key',
                unique: true,
            }
        );

        await queryInterface.addIndex(
            'checkout_idempotency',
            ['order_id'],
            {
                name: 'uq_checkout_order',
                unique: true,
            }
        );
    },

async down() {
    // Intentionally preserve checkout_idempotency.
    // This migration may be adopted for a table that already exists.
},
};
