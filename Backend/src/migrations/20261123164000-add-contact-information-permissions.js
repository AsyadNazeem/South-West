'use strict';

const permissionDefinitions = [
    {
        name: 'contact_information.view',
        module: 'contact_information',
        description: 'View contact information settings',
    },
    {
        name: 'contact_information.update',
        module: 'contact_information',
        description: 'Update contact information settings',
    },
];

const permissionNames = permissionDefinitions.map(
    permission => permission.name
);

module.exports = {
    async up(queryInterface) {
        const now = new Date();

        await queryInterface.bulkInsert(
            'permissions',
            permissionDefinitions.map(permission => ({
                ...permission,
                created_at: now,
                updated_at: now,
            })),
            { ignoreDuplicates: true }
        );

        const [adminRoles] = await queryInterface.sequelize.query(
            "SELECT id FROM roles WHERE name = 'Admin' LIMIT 1"
        );

        if (!adminRoles.length) {
            return;
        }

        const [permissions] = await queryInterface.sequelize.query(
            'SELECT id FROM permissions WHERE name IN (:permissionNames)',
            { replacements: { permissionNames } }
        );

        if (!permissions.length) {
            return;
        }

        await queryInterface.bulkInsert(
            'role_permissions',
            permissions.map(permission => ({
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
            'SELECT id FROM permissions WHERE name IN (:permissionNames)',
            { replacements: { permissionNames } }
        );

        if (permissions.length) {
            await queryInterface.bulkDelete('role_permissions', {
                permission_id: permissions.map(permission => permission.id),
            });
        }

        await queryInterface.bulkDelete('permissions', {
            name: permissionNames,
        });
    },
};
