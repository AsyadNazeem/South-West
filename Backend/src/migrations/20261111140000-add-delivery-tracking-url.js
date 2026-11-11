'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('deliveries', 'tracking_url', {
      type: Sequelize.STRING(2048),
      allowNull: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('deliveries', 'tracking_url');
  }
};
