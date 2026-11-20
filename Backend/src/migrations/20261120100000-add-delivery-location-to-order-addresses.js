'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('order_addresses', 'district_id', {
            type: Sequelize.BIGINT.UNSIGNED,
            allowNull: true,
            references: {
                model: 'delivery_districts',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
        });

        await queryInterface.addColumn('order_addresses', 'area_id', {
            type: Sequelize.BIGINT.UNSIGNED,
            allowNull: true,
            references: {
                model: 'delivery_areas',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
        });

        await queryInterface.addIndex('order_addresses', ['district_id'], {
            name: 'idx_order_addresses_district_id'
        });

        await queryInterface.addIndex('order_addresses', ['area_id'], {
            name: 'idx_order_addresses_area_id'
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex(
            'order_addresses',
            'idx_order_addresses_area_id'
        );
        await queryInterface.removeIndex(
            'order_addresses',
            'idx_order_addresses_district_id'
        );
        await queryInterface.removeColumn('order_addresses', 'area_id');
        await queryInterface.removeColumn('order_addresses', 'district_id');
    }
};
