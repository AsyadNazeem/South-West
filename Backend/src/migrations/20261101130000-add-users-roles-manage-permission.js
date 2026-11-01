'use strict';

const PERMISSION = {
    name: 'users.roles.manage',
    module: 'users',
    description: 'Assign and manage user roles'
};

module.exports = {
    async up(queryInterface) {
        const transaction = await queryInterface.sequelize.transaction();

        try {
            const now = new Date();

            const [existingPermissions] =
                await queryInterface.sequelize.query(
                    `SELECT id FROM permissions WHERE name = :name LIMIT 1`,
                    {
                        replacements: { name: PERMISSION.name },
                        transaction
                    }
                );

            if (!existingPermissions.length) {
                await queryInterface.bulkInsert(
                    'permissions',
                    [{
                        ...PERMISSION,
                        created_at: now,
                        updated_at: now
                    }],
                    { transaction }
                );
            }

            const [permissions] =
                await queryInterface.sequelize.query(
                    `SELECT id FROM permissions WHERE name = :name LIMIT 1`,
                    {
                        replacements: { name: PERMISSION.name },
                        transaction
                    }
                );

            if (!permissions.length) {
                throw new Error('Could not create users.roles.manage permission');
            }

            const [roles] = await queryInterface.sequelize.query(
                `SELECT id FROM roles WHERE name = 'Admin' LIMIT 1`,
                { transaction }
            );

            if (!roles.length) {
                throw new Error('Admin role not found');
            }

            const roleId = roles[0].id;
            const permissionId = permissions[0].id;

            const [existingLinks] =
                await queryInterface.sequelize.query(
                    `SELECT role_id
                     FROM role_permissions
                     WHERE role_id = :roleId
                       AND permission_id = :permissionId
                     LIMIT 1`,
                    {
                        replacements: { roleId, permissionId },
                        transaction
                    }
                );

            if (!existingLinks.length) {
                await queryInterface.bulkInsert(
                    'role_permissions',
                    [{
                        role_id: roleId,
                        permission_id: permissionId,
                        created_at: now,
                        updated_at: now
                    }],
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
            const [permissions] =
                await queryInterface.sequelize.query(
                    `SELECT id FROM permissions WHERE name = :name LIMIT 1`,
                    {
                        replacements: { name: PERMISSION.name },
                        transaction
                    }
                );

            if (permissions.length) {
                const [roles] = await queryInterface.sequelize.query(
                    `SELECT id FROM roles WHERE name = 'Admin' LIMIT 1`,
                    { transaction }
                );

                if (roles.length) {
                    await queryInterface.bulkDelete(
                        'role_permissions',
                        {
                            role_id: roles[0].id,
                            permission_id: permissions[0].id
                        },
                        { transaction }
                    );
                }

                // Retain the permission definition to avoid deleting a
                // permission that may have existed before this migration.
            }

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
};
