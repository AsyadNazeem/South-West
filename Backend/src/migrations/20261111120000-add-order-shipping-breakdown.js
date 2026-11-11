'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('orders', 'normal_delivery_amount', {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: true
    });
    await queryInterface.addColumn('orders', 'additional_shipping_amount', {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('orders', 'additional_shipping_amount');
    await queryInterface.removeColumn('orders', 'normal_delivery_amount');
  }
};
