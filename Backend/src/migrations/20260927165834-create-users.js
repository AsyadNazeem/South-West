'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },

      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      },

      password_hash: {
        type: Sequelize.STRING(255),
        allowNull: true
      },

      email_verified_at: {
        type: Sequelize.DATE,
        allowNull: true
      },

      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },

      last_login_at: {
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
  },

  async down(queryInterface) {
    await queryInterface.dropTable('users');
  }
};
