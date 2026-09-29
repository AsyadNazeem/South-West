'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('customers', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },

      customer_code: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },

      first_name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },

      last_name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },

      email: {
        type: Sequelize.STRING(255),
        allowNull: true
      },

      phone: {
        type: Sequelize.STRING(30),
        allowNull: false
      },

      is_active: {
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
  },

  async down(queryInterface) {
    await queryInterface.dropTable('customers');
  }
};
