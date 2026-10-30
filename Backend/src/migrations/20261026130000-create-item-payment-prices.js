
'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('item_payment_prices', {
            id: {
                type: Sequelize.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },
            item_id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                references: {
                    model: 'items',
                    key: 'id'
                },
                onUpdate: 'RESTRICT',
                onDelete: 'RESTRICT'
            },
            variant_id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: true,
                references: {
                    model: 'item_variants',
                    key: 'id'
                },
                onUpdate: 'RESTRICT',
                onDelete: 'RESTRICT'
            },
            payment_method: {
                type: Sequelize.STRING(20),
                allowNull: false
            },
            price: {
                type: Sequelize.DECIMAL(15, 2),
                allowNull: false
            },
            currency: {
                type: Sequelize.STRING(3),
                allowNull: false,
                defaultValue: 'LKR'
            },
            is_active: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            }
        });

        await queryInterface.addIndex(
            'item_payment_prices',
            ['item_id', 'variant_id', 'payment_method'],
            {
                name: 'uq_item_payment_prices_item_variant_method',
                unique: true
            }
        );

        await queryInterface.addIndex(
            'item_payment_prices',
            ['payment_method', 'is_active'],
            {
                name: 'idx_item_payment_prices_method_active'
            }
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('item_payment_prices');
    }
};
