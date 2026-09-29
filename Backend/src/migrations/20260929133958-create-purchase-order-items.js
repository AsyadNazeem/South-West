'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('purchase_order_items', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },

      purchase_order_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'purchase_orders',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
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

      quantity_ordered: {
        type: Sequelize.DECIMAL(15, 3),
        allowNull: false
      },

      unit_cost: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },

      discount_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },

      tax_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },

      line_total: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },

      quantity_received: {
        type: Sequelize.DECIMAL(15, 3),
        allowNull: false,
        defaultValue: 0
      },

      notes: {
        type: Sequelize.TEXT,
        allowNull: true
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
        'purchase_order_items',
        ['purchase_order_id']
    );

    await queryInterface.addIndex(
        'purchase_order_items',
        ['item_id']
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
        'purchase_order_items',
        ['purchase_order_id']
    );

    await queryInterface.removeIndex(
        'purchase_order_items',
        ['item_id']
    );

    await queryInterface.dropTable('purchase_order_items');
  }
};
