'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inventory_stock', {
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

      quantity_on_hand: {
        type: Sequelize.DECIMAL(15, 3),
        allowNull: false,
        defaultValue: 0
      },

      quantity_reserved: {
        type: Sequelize.DECIMAL(15, 3),
        allowNull: false,
        defaultValue: 0
      },

      reorder_level: {
        type: Sequelize.DECIMAL(15, 3),
        allowNull: false,
        defaultValue: 0
      },

      reorder_quantity: {
        type: Sequelize.DECIMAL(15, 3),
        allowNull: false,
        defaultValue: 0
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
        defaultValue: Sequelize.literal(
            'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
        )
      }
    });

    await queryInterface.addIndex(
        'inventory_stock',
        ['item_id', 'location_id'],
        {
          unique: true,
          name: 'inventory_stock_item_location_unique_idx'
        }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
        'inventory_stock',
        'inventory_stock_item_location_unique_idx'
    );

    await queryInterface.dropTable('inventory_stock');
  }
};
