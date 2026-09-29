'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('user_sessions', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },

      user_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },

      refresh_token_hash: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      },

      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true
      },

      user_agent: {
        type: Sequelize.TEXT,
        allowNull: true
      },

      expires_at: {
        type: Sequelize.DATE,
        allowNull: false
      },

      revoked_at: {
        type: Sequelize.DATE,
        allowNull: true
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('user_sessions');
  }
};
