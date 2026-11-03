'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const [emailColumns] = await queryInterface.sequelize.query(
      "SHOW COLUMNS FROM `customers` LIKE 'email_verified_at'"
    );

    if (emailColumns.length === 0) {
      await queryInterface.addColumn('customers', 'email_verified_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    const [phoneColumns] = await queryInterface.sequelize.query(
      "SHOW COLUMNS FROM `customers` LIKE 'phone_verified_at'"
    );

    if (phoneColumns.length === 0) {
      await queryInterface.addColumn('customers', 'phone_verified_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
  },

  async down() {
    throw new Error(
      'Manual review required before removing customer verification timestamps'
    );
  },
};
