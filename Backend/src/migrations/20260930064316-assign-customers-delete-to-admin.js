'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    const [roles] = await queryInterface.sequelize.query(`
      SELECT id
      FROM roles
      WHERE name = 'Admin'
      LIMIT 1
    `);

    const [permissions] = await queryInterface.sequelize.query(`
      SELECT id
      FROM permissions
      WHERE name = 'customers.delete'
      LIMIT 1
    `);

    if (!roles.length) {
      throw new Error('Admin role not found');
    }

    if (!permissions.length) {
      throw new Error('customers.delete permission not found');
    }

    await queryInterface.bulkInsert('role_permissions', [
      {
        role_id: roles[0].id,
        permission_id: permissions[0].id,
        created_at: now,
        updated_at: now
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    const [roles] = await queryInterface.sequelize.query(`
      SELECT id
      FROM roles
      WHERE name = 'Admin'
      LIMIT 1
    `);

    const [permissions] = await queryInterface.sequelize.query(`
      SELECT id
      FROM permissions
      WHERE name = 'customers.delete'
      LIMIT 1
    `);

    if (roles.length && permissions.length) {
      await queryInterface.bulkDelete('role_permissions', {
        role_id: roles[0].id,
        permission_id: permissions[0].id
      });
    }
  }
};
