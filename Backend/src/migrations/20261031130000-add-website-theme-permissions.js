'use strict';

const {
    permissionCatalog,
    defaultRolePermissions,
} = require('../config/permissions');

const permissionNames = [
    'website_themes.view',
    'website_themes.create',
    'website_themes.update',
    'website_themes.delete',
];

module.exports = {
    async up(queryInterface) {
        const transaction = await queryInterface.sequelize.transaction();

        try {
            const now = new Date();

            const definitions = permissionCatalog
                .filter(permission => permissionNames.includes(permission.name));

            const [existing] = await queryInterface.sequelize.query(
                'SELECT name FROM permissions WHERE name IN (:names)',
                {
                    replacements: { names: permissionNames },
                    transaction,
                }
            );

            const existingNames = new Set(existing.map(row => row.name));
            const missing = definitions
                .filter(permission => !existingNames.has(permission.name))
                .map(permission => ({
                    ...permission,
                    created_at: now,
                    updated_at: now,
                }));

            if (missing.length) {
                await queryInterface.bulkInsert('permissions', missing, {
                    transaction,
                });
            }

            const [roles] = await queryInterface.sequelize.query(
                'SELECT id, name FROM roles WHERE name IN (:names)',
                {
                    replacements: {
                        names: Object.keys(defaultRolePermissions),
                    },
                    transaction,
                }
            );

            const [permissions] = await queryInterface.sequelize.query(
                'SELECT id, name FROM permissions WHERE name IN (:names)',
                {
                    replacements: { names: permissionNames },
                    transaction,
                }
            );

            const roleIds = new Map(roles.map(role => [role.name, role.id]));
            const permissionIds = new Map(
                permissions.map(permission => [permission.name, permission.id])
            );

            const [existingLinks] = await queryInterface.sequelize.query(
                'SELECT role_id, permission_id FROM role_permissions',
                { transaction }
            );

            const linkKeys = new Set(
                existingLinks.map(link => `${link.role_id}:${link.permission_id}`)
            );

            const links = [];

            for (const [roleName, configuredPermissions] of Object.entries(defaultRolePermissions)) {
                const roleId = roleIds.get(roleName);

                if (!roleId || !configuredPermissions.includes('website_themes.view')) {
                    continue;
                }

                for (const permissionName of permissionNames) {
                    if (!configuredPermissions.includes(permissionName)) continue;

                    const permissionId = permissionIds.get(permissionName);
                    if (!permissionId) {
                        throw new Error(`Missing permission: ${permissionName}`);
                    }

                    const key = `${roleId}:${permissionId}`;
                    if (linkKeys.has(key)) continue;

                    links.push({
                        role_id: roleId,
                        permission_id: permissionId,
                        created_at: now,
                        updated_at: now,
                    });

                    linkKeys.add(key);
                }
            }

            if (links.length) {
                await queryInterface.bulkInsert('role_permissions', links, {
                    transaction,
                });
            }

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    },

    async down() {
        // Intentionally retain website theme permissions and role assignments.
        // The up migration may reuse permission records that existed before
        // this migration, so deleting them here could remove existing access.
    },
};
