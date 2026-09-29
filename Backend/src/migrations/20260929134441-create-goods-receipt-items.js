'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('goods_receipt_items', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },

      goods_receipt_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'goods_receipts',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },

      purchase_order_item_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'purchase_order_items',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
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

      quantity_received: {
        type: Sequelize.DECIMAL(15, 3),
        allowNull: false
      },

      unit_cost: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },

      condition: {
        type: Sequelize.ENUM(
            'good',
            'damaged',
            'defective'
        ),
        allowNull: false,
        defaultValue: 'good'
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
        'goods_receipt_items',
        ['goods_receipt_id']
    );

    await queryInterface.addIndex(
        'goods_receipt_items',
        ['purchase_order_item_id']
    );

    await queryInterface.addIndex(
        'goods_receipt_items',
        ['item_id']
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
        'goods_receipt_items',
        ['goods_receipt_id']
    );

    await queryInterface.removeIndex(
        'goods_receipt_items',
        ['purchase_order_item_id']
    );

    await queryInterface.removeIndex(
        'goods_receipt_items',
        ['item_id']
    );

    await queryInterface.dropTable('goods_receipt_items');
  }
};
