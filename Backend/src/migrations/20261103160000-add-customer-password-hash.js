'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const [columns] = await queryInterface.sequelize.query(
      "SHOW COLUMNS FROM `customers` LIKE 'password_hash'"
    );

    if (columns.length === 0) {
      await queryInterface.addColumn('customers', 'password_hash', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
  },

  async down() {
    throw new Error('Manual review required before removing customers.password_hash');
  },
};
