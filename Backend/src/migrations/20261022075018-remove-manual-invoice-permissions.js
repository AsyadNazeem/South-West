
'use strict';

const obsoletePermissions = [
    {
        name: 'invoices.create',
        description: 'Create invoices'
    },
    {
        name: 'invoices.update',
        description: 'Update invoices'
    },
    {
        name: 'invoices.delete',
        description: 'Delete invoices'
    }
];

module.exports = {
    async up(queryInterface) {
        const transaction = await queryInterface.sequelize.transaction();

        try {
            const [permissions] = await queryInterface.sequelize.query(
                `SELECT id
                 FROM permissions
                 WHERE name IN (:names)`,
                {
                    replacements: {
                        names: obsoletePermissions.map(p => p.name)
                    },
                    transaction
                }
            );

            const ids = permissions.map(p => p.id);

            if (ids.length) {
                await queryInterface.bulkDelete(
                    'role_permissions',
                    { permission_id: ids },
                    { transaction }
                );

                await queryInterface.bulkDelete(
                    'permissions',
                    { id: ids },
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
            const now = new Date();

            for (const permission of obsoletePermissions) {
                await queryInterface.bulkInsert(
                    'permissions',
                    [{
                        ...permission,
                        module: 'invoices',
                        created_at: now,
                        updated_at: now
                    }],
                    { ignoreDuplicates: true, transaction }
                );
            }

            const [adminRoles] = await queryInterface.sequelize.query(
                `SELECT id
                 FROM roles
                 WHERE name = 'Admin'
                 LIMIT 1`,
                { transaction }
            );

            const [permissions] = await queryInterface.sequelize.query(
                `SELECT id
                 FROM permissions
                 WHERE name IN (:names)`,
                {
                    replacements: {
                        names: obsoletePermissions.map(p => p.name)
                    },
                    transaction
                }
            );

            if (adminRoles.length && permissions.length) {
                await queryInterface.bulkInsert(
                    'role_permissions',
                    permissions.map(permission => ({
                        role_id: adminRoles[0].id,
                        permission_id: permission.id,
                        created_at: now,
                        updated_at: now
                    })),
                    { ignoreDuplicates: true, transaction }
                );
            }

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
};
