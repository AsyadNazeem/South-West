'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('invoices', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },

      invoice_number: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },

      order_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'orders',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
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

      invoice_date: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },

      due_date: {
        type: Sequelize.DATE,
        allowNull: true
      },

      status: {
        type: Sequelize.ENUM(
            'draft',
            'issued',
            'partially_paid',
            'paid',
            'overdue',
            'cancelled',
            'refunded'
        ),
        allowNull: false,
        defaultValue: 'draft'
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

      paid_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },

      balance_amount: {
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
        'invoices',
        ['order_id']
    );

    await queryInterface.addIndex(
        'invoices',
        ['customer_id']
    );

    await queryInterface.addIndex(
        'invoices',
        ['status']
    );

    await queryInterface.addIndex(
        'invoices',
        ['invoice_date']
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
        'invoices',
        ['order_id']
    );

    await queryInterface.removeIndex(
        'invoices',
        ['customer_id']
    );

    await queryInterface.removeIndex(
        'invoices',
        ['status']
    );

    await queryInterface.removeIndex(
        'invoices',
        ['invoice_date']
    );

    await queryInterface.dropTable('invoices');
  }
};
