'use strict';

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    await queryInterface.bulkInsert('roles', [
      {
        name: 'Admin',
        description: 'Full system access',
        created_at: now,
        updated_at: now
      },
      {
        name: 'Manager',
        description: 'Management-level system access',
        created_at: now,
        updated_at: now
      },
      {
        name: 'Staff',
        description: 'General staff system access',
        created_at: now,
        updated_at: now
      },
      {
        name: 'Sales',
        description: 'Sales-related system access',
        created_at: now,
        updated_at: now
      }
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('roles', {
      name: ['Admin', 'Manager', 'Staff', 'Sales']
    });
  }
};
