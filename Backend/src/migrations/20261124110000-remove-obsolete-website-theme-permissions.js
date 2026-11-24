'use strict';

const obsoletePermissions = [
    'website_themes.create',
    'website_themes.delete'
];

module.exports = {
    async up(queryInterface) {
        await queryInterface.sequelize.transaction(async transaction => {
            const [permissions] = await queryInterface.sequelize.query(
                `SELECT id
                 FROM permissions
                 WHERE name IN (:names)`,
                {
                    replacements: {
                        names: obsoletePermissions
                    },
                    transaction
                }
            );

            const ids = permissions.map(permission => permission.id);

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

            await queryInterface.bulkUpdate(
                'permissions',
                {
                    description: 'Enable or disable website themes',
                    updated_at: new Date()
                },
                {
                    name: 'website_themes.update'
                },
                { transaction }
            );
        });
    },

    async down() {
        // Intentionally irreversible.
        // Obsolete permissions must not be automatically restored
        // or granted to roles without explicit authorization.
        throw new Error(
            'Obsolete website theme permissions require manual restoration.'
        );
    }
};
