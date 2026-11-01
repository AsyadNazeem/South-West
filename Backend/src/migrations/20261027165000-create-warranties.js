'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('warranties', {
            id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
            },
            name: {
                type: Sequelize.STRING(100),
                allowNull: false,
                unique: true,
            },
            code: {
                type: Sequelize.STRING(50),
                allowNull: false,
                unique: true,
            },
            duration_value: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            duration_unit: {
                type: Sequelize.ENUM('Days', 'Months', 'Years'),
                allowNull: false,
                defaultValue: 'Months',
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            is_active: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true,
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

        await queryInterface.addColumn('items', 'warranty_id', {
            type: Sequelize.BIGINT.UNSIGNED,
            allowNull: true,
            references: {
                model: 'warranties',
                key: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
        });

        await queryInterface.addIndex('items', ['warranty_id'], {
            name: 'items_warranty_id_idx',
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex(
            'items',
            'items_warranty_id_idx'
        );

        await queryInterface.removeColumn('items', 'warranty_id');

        await queryInterface.dropTable('warranties');
    },
};