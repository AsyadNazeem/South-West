
'use strict';

const permissionNames = [
    'homepage_banners.view',
    'homepage_banners.create',
    'homepage_banners.update',
    'homepage_banners.delete',
];

const permissionDefinitions = [
    {
        name: 'homepage_banners.view',
        module: 'homepage_banners',
        description: 'View homepage banners',
    },
    {
        name: 'homepage_banners.create',
        module: 'homepage_banners',
        description: 'Create homepage banners',
    },
    {
        name: 'homepage_banners.update',
        module: 'homepage_banners',
        description: 'Update homepage banners',
    },
    {
        name: 'homepage_banners.delete',
        module: 'homepage_banners',
        description: 'Delete homepage banners',
    },
];

module.exports = {
    async up(queryInterface) {
        const now = new Date();

        await queryInterface.bulkInsert(
            'permissions',
            permissionDefinitions.map((permission) => ({
                ...permission,
                created_at: now,
                updated_at: now,
            })),
            { ignoreDuplicates: true }
        );

        const [adminRoles] = await queryInterface.sequelize.query(
            `SELECT id FROM roles WHERE name = 'Admin' LIMIT 1`
        );

        if (!adminRoles.length) {
            return;
        }

        const [permissions] = await queryInterface.sequelize.query(
            `SELECT id FROM permissions WHERE name IN (:permissionNames)`,
            { replacements: { permissionNames } }
        );

        await queryInterface.bulkInsert(
            'role_permissions',
            permissions.map((permission) => ({
                role_id: adminRoles[0].id,
                permission_id: permission.id,
                created_at: now,
                updated_at: now,
            })),
            { ignoreDuplicates: true }
        );
    },

    async down(queryInterface) {
        const [permissions] = await queryInterface.sequelize.query(
            `SELECT id FROM permissions WHERE name IN (:permissionNames)`,
            { replacements: { permissionNames } }
        );

        if (permissions.length) {
            await queryInterface.bulkDelete('role_permissions', {
                permission_id: permissions.map((permission) => permission.id),
            });
        }

        await queryInterface.bulkDelete('permissions', {
            name: permissionNames,
        });
    },
};
