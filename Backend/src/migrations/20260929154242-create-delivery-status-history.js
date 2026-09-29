'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('delivery_status_history', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },

      delivery_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'deliveries',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },

      status: {
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
        allowNull: false
      },

      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },

      changed_by: {
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
        'delivery_status_history',
        ['delivery_id']
    );

    await queryInterface.addIndex(
        'delivery_status_history',
        ['changed_by']
    );

    await queryInterface.addIndex(
        'delivery_status_history',
        ['created_at']
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
        'delivery_status_history',
        ['delivery_id']
    );

    await queryInterface.removeIndex(
        'delivery_status_history',
        ['changed_by']
    );

    await queryInterface.removeIndex(
        'delivery_status_history',
        ['created_at']
    );

    await queryInterface.dropTable('delivery_status_history');
  }
};
