'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('order_addresses', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },

      order_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'orders',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },

      address_type: {
        type: Sequelize.ENUM(
            'billing',
            'shipping'
        ),
        allowNull: false
      },

      recipient_name: {
        type: Sequelize.STRING(150),
        allowNull: false
      },

      phone: {
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
        'order_addresses',
        ['order_id']
    );

    await queryInterface.addIndex(
        'order_addresses',
        ['order_id', 'address_type'],
        {
          unique: true
        }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
        'order_addresses',
        ['order_id']
    );

    await queryInterface.removeIndex(
        'order_addresses',
        ['order_id', 'address_type']
    );

    await queryInterface.dropTable('order_addresses');
  }
};
