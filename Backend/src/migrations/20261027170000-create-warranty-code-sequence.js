'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('warranty_code_sequences', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
      },
      next_value: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
      },
    });

    // Continue after existing WAR-0001-style codes.
    const [rows] = await queryInterface.sequelize.query(
      "SELECT code FROM warranties WHERE code REGEXP '^WAR-[0-9]+$'"
    );

    const maxCode = rows.reduce((max, row) => {
      const match = /^WAR-(\d+)$/i.exec(String(row.code || ''));
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);

    await queryInterface.bulkInsert('warranty_code_sequences', [{
      id: 1,
      next_value: maxCode + 1,
    }]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('warranty_code_sequences');
  },
};
