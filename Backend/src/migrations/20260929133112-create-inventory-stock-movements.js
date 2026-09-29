'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inventory_stock_movements', {
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
        onDelete: 'RESTRICT'
      },

      location_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'inventory_locations',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },

      movement_type: {
        type: Sequelize.ENUM(
            'purchase',
            'sale',
            'customer_return',
            'supplier_return',
            'adjustment',
            'transfer_in',
            'transfer_out'
        ),
        allowNull: false
      },

      quantity: {
        type: Sequelize.DECIMAL(15, 3),
        allowNull: false
      },

      reference_type: {
        type: Sequelize.STRING(50),
        allowNull: true
      },

      reference_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true
      },

      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },

      created_by: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex(
        'inventory_stock_movements',
        ['item_id', 'location_id']
    );

    await queryInterface.addIndex(
        'inventory_stock_movements',
        ['movement_type']
    );

    await queryInterface.addIndex(
        'inventory_stock_movements',
        ['reference_type', 'reference_id']
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
        'inventory_stock_movements',
        ['item_id', 'location_id']
    );

    await queryInterface.removeIndex(
        'inventory_stock_movements',
        ['movement_type']
    );

    await queryInterface.removeIndex(
        'inventory_stock_movements',
        ['reference_type', 'reference_id']
    );

    await queryInterface.dropTable('inventory_stock_movements');
  }
};
