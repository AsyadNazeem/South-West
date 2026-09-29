'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notification_preferences', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },

      customer_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'customers',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },

      order_updates: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },

      payment_updates: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },

      delivery_updates: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },

      promotional_notifications: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },

      product_updates: {
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
        'notification_preferences',
        ['customer_id'],
        {
          unique: true
        }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
        'notification_preferences',
        ['customer_id']
    );

    await queryInterface.dropTable('notification_preferences');
  }
};
