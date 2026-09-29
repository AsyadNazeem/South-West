'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('customer_addresses', {
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

      address_type: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: 'home'
      },

      recipient_name: {
        type: Sequelize.STRING(200),
        allowNull: false
      },

      phone: {
        type: Sequelize.STRING(30),
        allowNull: false
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
        allowNull: false,
        defaultValue: 'Sri Lanka'
      },

      is_default: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
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
  },

  async down(queryInterface) {
    await queryInterface.dropTable('customer_addresses');
  }
};
