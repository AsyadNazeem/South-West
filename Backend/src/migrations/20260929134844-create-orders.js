'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('orders', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },

      order_number: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },

      customer_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: {
          model: 'customers',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },

      order_date: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },

      order_type: {
        type: Sequelize.ENUM(
            'online',
            'pos',
            'manual'
        ),
        allowNull: false,
        defaultValue: 'online'
      },

      status: {
        type: Sequelize.ENUM(
            'pending',
            'confirmed',
            'processing',
            'partially_shipped',
            'shipped',
            'delivered',
            'cancelled',
            'returned'
        ),
        allowNull: false,
        defaultValue: 'pending'
      },

      payment_status: {
        type: Sequelize.ENUM(
            'unpaid',
            'partially_paid',
            'paid',
            'refunded',
            'partially_refunded'
        ),
        allowNull: false,
        defaultValue: 'unpaid'
      },

      fulfillment_status: {
        type: Sequelize.ENUM(
            'unfulfilled',
            'partially_fulfilled',
            'fulfilled',
            'cancelled'
        ),
        allowNull: false,
        defaultValue: 'unfulfilled'
      },

      subtotal: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
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

      shipping_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },

      total_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
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
        'orders',
        ['customer_id']
    );

    await queryInterface.addIndex(
        'orders',
        ['status']
    );

    await queryInterface.addIndex(
        'orders',
        ['payment_status']
    );

    await queryInterface.addIndex(
        'orders',
        ['order_date']
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
        'orders',
        ['customer_id']
    );

    await queryInterface.removeIndex(
        'orders',
        ['status']
    );

    await queryInterface.removeIndex(
        'orders',
        ['payment_status']
    );

    await queryInterface.removeIndex(
        'orders',
        ['order_date']
    );

    await queryInterface.dropTable('orders');
  }
};
