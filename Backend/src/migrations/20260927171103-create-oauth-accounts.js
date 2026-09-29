'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('oauth_accounts', {
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

      provider: {
        type: Sequelize.STRING(50),
        allowNull: false
      },

      provider_user_id: {
        type: Sequelize.STRING(255),
        allowNull: false
      },

      provider_email: {
        type: Sequelize.STRING(255),
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

    await queryInterface.addConstraint('oauth_accounts', {
      fields: ['provider', 'provider_user_id'],
      type: 'unique',
      name: 'uq_oauth_accounts_provider_user'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('oauth_accounts');
  }
};
