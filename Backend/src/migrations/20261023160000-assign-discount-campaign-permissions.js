
'use strict';

const {
    permissionCatalog,
    defaultRolePermissions,
} = require('../config/permissions');

const campaignPermissionNames = [
    'discount_campaigns.view',
    'discount_campaigns.create',
    'discount_campaigns.update',
    'discount_campaigns.delete',
];

module.exports = {
    async up(queryInterface) {
        const transaction = await queryInterface.sequelize.transaction();

        try {
            const now = new Date();

            const campaignPermissions = permissionCatalog.filter(
                permission => campaignPermissionNames.includes(permission.name)
            );

            // Insert campaign permissions that do not already exist.
            const [existingPermissions] = await queryInterface.sequelize.query(
                `SELECT name FROM permissions
                 WHERE name IN (:names)`,
                {
                    replacements: { names: campaignPermissionNames },
                    transaction,
                }
            );

            const existingNames = new Set(
                existingPermissions.map(permission => permission.name)
            );

            const missingPermissions = campaignPermissions
                .filter(permission => !existingNames.has(permission.name))
                .map(permission => ({
                    ...permission,
                    created_at: now,
                    updated_at: now,
                }));

            if (missingPermissions.length) {
                await queryInterface.bulkInsert(
                    'permissions',
                    missingPermissions,
                    { transaction }
                );
            }

            // Load the roles and campaign permission IDs.
            const [roles] = await queryInterface.sequelize.query(
                `SELECT id, name FROM roles
                 WHERE name IN (:roleNames)`,
                {
                    replacements: {
                        roleNames: Object.keys(defaultRolePermissions),
                    },
                    transaction,
                }
            );

            const [permissions] = await queryInterface.sequelize.query(
                `SELECT id, name FROM permissions
                 WHERE name IN (:names)`,
                {
                    replacements: { names: campaignPermissionNames },
                    transaction,
                }
            );

            const roleIds = new Map(
                roles.map(role => [role.name, role.id])
            );

            const permissionIds = new Map(
                permissions.map(permission => [
                    permission.name,
                    permission.id,
                ])
            );

            const [existingLinks] = await queryInterface.sequelize.query(
                `SELECT role_id, permission_id
                 FROM role_permissions`,
                { transaction }
            );

            const existingLinkKeys = new Set(
                existingLinks.map(
                    link => `${link.role_id}:${link.permission_id}`
                )
            );

            const rolePermissionRows = [];

            for (const [roleName, configuredPermissions]
                of Object.entries(defaultRolePermissions)) {
                const roleId = roleIds.get(roleName);

                if (!roleId) {
                    continue;
                }

                for (const permissionName of campaignPermissionNames) {
                    if (!configuredPermissions.includes(permissionName)) {
                        continue;
                    }

                    const permissionId = permissionIds.get(permissionName);

                    if (!permissionId) {
                        throw new Error(
                            `Missing permission: ${permissionName}`
                        );
                    }

                    const linkKey = `${roleId}:${permissionId}`;

                    if (existingLinkKeys.has(linkKey)) {
                        continue;
                    }

                    rolePermissionRows.push({
                        role_id: roleId,
                        permission_id: permissionId,
                        created_at: now,
                        updated_at: now,
                    });

                    existingLinkKeys.add(linkKey);
                }
            }

            if (rolePermissionRows.length) {
                await queryInterface.bulkInsert(
                    'role_permissions',
                    rolePermissionRows,
                    { transaction }
                );
            }

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    },

    async down(queryInterface) {
        const transaction = await queryInterface.sequelize.transaction();

        try {
            const [permissions] = await queryInterface.sequelize.query(
                `SELECT id FROM permissions
                 WHERE name IN (:names)`,
                {
                    replacements: { names: campaignPermissionNames },
                    transaction,
                }
            );

            const permissionIds = permissions.map(permission => permission.id);

            if (permissionIds.length) {
                await queryInterface.bulkDelete(
                    'role_permissions',
                    { permission_id: permissionIds },
                    { transaction }
                );
            }

            await queryInterface.bulkDelete(
                'permissions',
                { name: campaignPermissionNames },
                { transaction }
            );

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    },
};
