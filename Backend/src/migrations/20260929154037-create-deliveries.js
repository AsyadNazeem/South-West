'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('deliveries', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },

      delivery_reference: {
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

      delivery_method: {
        type: Sequelize.ENUM(
            'standard',
            'express',
            'pickup',
            'courier'
        ),
        allowNull: false,
        defaultValue: 'standard'
      },

      delivery_status: {
        type: Sequelize.ENUM(
            'pending',
            'processing',
            'ready_for_dispatch',
            'dispatched',
            'in_transit',
            'out_for_delivery',
            'delivered',
            'failed',
            'cancelled',
            'returned'
        ),
        allowNull: false,
        defaultValue: 'pending'
      },

      recipient_name: {
        type: Sequelize.STRING(150),
        allowNull: false
      },

      recipient_phone: {
        type: Sequelize.STRING(30),
        allowNull: true
      },

      address_line_1: {
        type: Sequelize.STRING(255),
        allowNull: false
      },

      address_line_2: {
        type: Sequelize.STRING(255),
        allowNull: true
      },

      city: {
        type: Sequelize.STRING(100),
        allowNull: false
      },

      state: {
        type: Sequelize.STRING(100),
        allowNull: true
      },

      postal_code: {
        type: Sequelize.STRING(20),
        allowNull: true
      },

      country: {
        type: Sequelize.STRING(100),
        allowNull: false
      },

      delivery_charge: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },

      tracking_number: {
        type: Sequelize.STRING(150),
        allowNull: true
      },

      courier_name: {
        type: Sequelize.STRING(150),
        allowNull: true
      },

      expected_delivery_date: {
        type: Sequelize.DATE,
        allowNull: true
      },

      dispatched_at: {
        type: Sequelize.DATE,
        allowNull: true
      },

      delivered_at: {
        type: Sequelize.DATE,
        allowNull: true
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
        'deliveries',
        ['order_id']
    );

    await queryInterface.addIndex(
        'deliveries',
        ['delivery_status']
    );

    await queryInterface.addIndex(
        'deliveries',
        ['tracking_number']
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
        'deliveries',
        ['order_id']
    );

    await queryInterface.removeIndex(
        'deliveries',
        ['delivery_status']
    );

    await queryInterface.removeIndex(
        'deliveries',
        ['tracking_number']
    );

    await queryInterface.dropTable('deliveries');
  }
};
