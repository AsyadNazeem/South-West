'use strict';

const { permissionCatalog } = require('../config/permissions');

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    await queryInterface.bulkInsert(
      'permissions',
      permissionCatalog.map((permission) => ({
        ...permission,
        created_at: now,
        updated_at: now
      })),
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('permissions', {
      name: permissionCatalog.map((permission) => permission.name)
    });
  }
};
