'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeColumn('items', 'item_type');
    await queryInterface.removeColumn('items', 'unit');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('items', 'item_type', {
      type: Sequelize.STRING(50),
      allowNull: false,
      defaultValue: 'general'
    });

    await queryInterface.addColumn('items', 'unit', {
      type: Sequelize.STRING(30),
      allowNull: false,
      defaultValue: 'pcs'
    });
  }
};
