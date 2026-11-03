'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('items', 'shipping_weight', {
      type: Sequelize.DECIMAL(10, 3),
      allowNull: true
    });

    await queryInterface.addColumn('items', 'shipping_weight_unit', {
      type: Sequelize.ENUM('g', 'kg'),
      allowNull: false,
      defaultValue: 'kg'
    });

    await queryInterface.addColumn('orders', 'invoice_number', {
      type: Sequelize.STRING(50),
      allowNull: true,
      unique: true
    });

    await queryInterface.addColumn('payments', 'payment_number', {
      type: Sequelize.STRING(50),
      allowNull: true,
      unique: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('payments', 'payment_number');
    await queryInterface.removeColumn('orders', 'invoice_number');
    await queryInterface.removeColumn('items', 'shipping_weight_unit');
    await queryInterface.removeColumn('items', 'shipping_weight');
  }
};
