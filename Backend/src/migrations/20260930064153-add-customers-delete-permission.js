'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    await queryInterface.bulkInsert('permissions', [
      {
        name: 'customers.delete',
        module: 'customers',
        description: 'Delete customers',
        created_at: now,
        updated_at: now
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('permissions', {
      name: 'customers.delete'
    });
  }
};
