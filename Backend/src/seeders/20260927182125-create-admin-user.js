'use strict';

const bcrypt = require('bcryptjs');

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    const passwordHash = await bcrypt.hash(
        'SouthWest@2026!',
        12
    );

    await queryInterface.bulkInsert('users', [
      {
        email: 'admin@southwest.lk',
        password_hash: passwordHash,
        email_verified_at: now,
        is_active: true,
        created_at: now,
        updated_at: now
      }
    ]);

    const [users] = await queryInterface.sequelize.query(
        `SELECT id FROM users WHERE email = 'admin@southwest.lk' LIMIT 1`
    );

    if (!users.length) {
      throw new Error('Admin user was not created');
    }

    const [roles] = await queryInterface.sequelize.query(
        `SELECT id FROM roles WHERE name = 'Admin' LIMIT 1`
    );

    if (!roles.length) {
      throw new Error('Admin role not found');
    }

    await queryInterface.bulkInsert('user_roles', [
      {
        user_id: users[0].id,
        role_id: roles[0].id,
        created_at: now
      }
    ]);
  },

  async down(queryInterface) {
    const [users] = await queryInterface.sequelize.query(
        `SELECT id FROM users WHERE email = 'admin@southwest.lk' LIMIT 1`
    );

    if (users.length) {
      await queryInterface.bulkDelete('user_roles', {
        user_id: users[0].id
      });

      await queryInterface.bulkDelete('users', {
        id: users[0].id
      });
    }
  }
};
