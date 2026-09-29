'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('purchase_orders', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },

      purchase_order_number: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },

      supplier_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'suppliers',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },

      order_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },

      expected_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },

      status: {
        type: Sequelize.ENUM(
            'draft',
            'submitted',
            'approved',
            'partially_received',
            'received',
            'cancelled'
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

      approved_by: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },

      approved_at: {
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
        'purchase_orders',
        ['supplier_id']
    );

    await queryInterface.addIndex(
        'purchase_orders',
        ['status']
    );

    await queryInterface.addIndex(
        'purchase_orders',
        ['order_date']
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
        'purchase_orders',
        ['supplier_id']
    );

    await queryInterface.removeIndex(
        'purchase_orders',
        ['status']
    );

    await queryInterface.removeIndex(
        'purchase_orders',
        ['order_date']
    );

    await queryInterface.dropTable('purchase_orders');
  }
};
