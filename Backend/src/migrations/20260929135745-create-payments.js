'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('payments', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },

      payment_reference: {
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

      payment_method: {
        type: Sequelize.ENUM(
            'cash',
            'card',
            'bank_transfer',
            'online',
            'wallet',
            'cheque',
            'other'
        ),
        allowNull: false
      },

      payment_status: {
        type: Sequelize.ENUM(
            'pending',
            'authorized',
            'paid',
            'failed',
            'cancelled',
            'refunded',
            'partially_refunded'
        ),
        allowNull: false,
        defaultValue: 'pending'
      },

      amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },

      transaction_reference: {
        type: Sequelize.STRING(150),
        allowNull: true
      },

      payment_date: {
        type: Sequelize.DATE,
        allowNull: true
      },

      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },

      processed_by: {
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
        'payments',
        ['order_id']
    );

    await queryInterface.addIndex(
        'payments',
        ['payment_status']
    );

    await queryInterface.addIndex(
        'payments',
        ['payment_date']
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
        'payments',
        ['order_id']
    );

    await queryInterface.removeIndex(
        'payments',
        ['payment_status']
    );

    await queryInterface.removeIndex(
        'payments',
        ['payment_date']
    );

    await queryInterface.dropTable('payments');
  }
};
