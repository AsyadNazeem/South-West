'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('oauth_accounts', 'access_token', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn('oauth_accounts', 'refresh_token', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn('oauth_accounts', 'expires_at', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.removeColumn('oauth_accounts', 'provider_email');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('oauth_accounts', 'provider_email', {
      type: Sequelize.STRING(255),
      allowNull: true
    });

    await queryInterface.removeColumn('oauth_accounts', 'access_token');
    await queryInterface.removeColumn('oauth_accounts', 'refresh_token');
    await queryInterface.removeColumn('oauth_accounts', 'expires_at');
  }
};
