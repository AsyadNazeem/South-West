'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('goods_receipts', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },

      receipt_number: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },

      purchase_order_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'purchase_orders',
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

      receipt_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },

      supplier_delivery_note: {
        type: Sequelize.STRING(100),
        allowNull: true
      },

      status: {
        type: Sequelize.ENUM(
            'draft',
            'received',
            'cancelled'
        ),
        allowNull: false,
        defaultValue: 'draft'
      },

      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },

      received_by: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },

      received_at: {
        type: Sequelize.DATE,
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
        'goods_receipts',
        ['purchase_order_id']
    );

    await queryInterface.addIndex(
        'goods_receipts',
        ['location_id']
    );

    await queryInterface.addIndex(
        'goods_receipts',
        ['receipt_date']
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
        'goods_receipts',
        ['purchase_order_id']
    );

    await queryInterface.removeIndex(
        'goods_receipts',
        ['location_id']
    );

    await queryInterface.removeIndex(
        'goods_receipts',
        ['receipt_date']
    );

    await queryInterface.dropTable('goods_receipts');
  }
};
