'use strict';

const { defaultRolePermissions } = require('../config/permissions');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [roles] = await queryInterface.sequelize.query(`
      SELECT id, name
      FROM roles
    `);
    const [permissions] = await queryInterface.sequelize.query(`
      SELECT id, name
      FROM permissions
    `);
    const roleIds = new Map(roles.map((role) => [role.name, role.id]));
    const permissionIds = new Map(
      permissions.map((permission) => [permission.name, permission.id])
    );
    const assignments = [];

    Object.entries(defaultRolePermissions).forEach(([roleName, permissionNames]) => {
      const roleId = roleIds.get(roleName);

      if (!roleId) {
        return;
      }

      permissionNames.forEach((permissionName) => {
        const permissionId = permissionIds.get(permissionName);

        if (permissionId) {
          assignments.push({
            role_id: roleId,
            permission_id: permissionId,
            created_at: now,
            updated_at: now
          });
        }
      });
    });

    await queryInterface.bulkInsert('role_permissions', assignments, {
      ignoreDuplicates: true
    });
  },

  async down(queryInterface) {
    const [roles] = await queryInterface.sequelize.query(`
      SELECT id, name
      FROM roles
    `);
    const [permissions] = await queryInterface.sequelize.query(`
      SELECT id, name
      FROM permissions
    `);
    const roleIds = new Map(roles.map((role) => [role.name, role.id]));
    const permissionIds = new Map(
      permissions.map((permission) => [permission.name, permission.id])
    );

    for (const [roleName, permissionNames] of Object.entries(defaultRolePermissions)) {
      const roleId = roleIds.get(roleName);
      const permissionIdsForRole = permissionNames
        .map((permissionName) => permissionIds.get(permissionName))
        .filter(Boolean);

      if (roleId && permissionIdsForRole.length) {
        await queryInterface.bulkDelete('role_permissions', {
          role_id: roleId,
          permission_id: permissionIdsForRole
        });
      }
    }
  }
};
