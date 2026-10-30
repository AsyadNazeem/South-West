'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('categories');

    if (!columns.image_url) {
      await queryInterface.addColumn('categories', 'image_url', {
        type: Sequelize.STRING(500),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable('categories');

    if (columns.image_url) {
      await queryInterface.removeColumn('categories', 'image_url');
    }
  },
};