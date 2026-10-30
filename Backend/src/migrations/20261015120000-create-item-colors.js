
'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('item_colors', {
            id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true
            },

            item_id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                references: {
                    model: 'items',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },

            color_name: {
                type: Sequelize.STRING(50),
                allowNull: false
            },

            hex_code: {
                type: Sequelize.STRING(7),
                allowNull: false
            },

            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            },

            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal(
                    'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
                )
            }
        });

        await queryInterface.addIndex(
            'item_colors',
            ['item_id', 'hex_code'],
            {
                unique: true,
                name: 'item_colors_item_hex_unique_idx'
            }
        );
    },

    async down(queryInterface) {
        await queryInterface.removeIndex(
            'item_colors',
            'item_colors_item_hex_unique_idx'
        );

        await queryInterface.dropTable('item_colors');
    }
};
