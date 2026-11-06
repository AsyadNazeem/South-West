'use strict';

const permissionName = 'notifications.view';
const roleNames = ['Manager', 'Staff', 'Sales'];
const trackingTable = 'migration_notifications_view_role_permissions';

function isMissingTrackingTable(error) {
    const databaseError = error?.original || error?.parent || error;
    return databaseError?.code === 'ER_NO_SUCH_TABLE';
}

module.exports = {
    async up(queryInterface, Sequelize) {
        const transaction = await queryInterface.sequelize.transaction();

        try {
            const [permissions] = await queryInterface.sequelize.query(
                'SELECT id FROM permissions WHERE name = :name LIMIT 1',
                { replacements: { name: permissionName }, transaction }
            );
            if (!permissions.length) throw new Error(`Permission not found: ${permissionName}`);

            const [roles] = await queryInterface.sequelize.query(
                'SELECT id, name FROM roles WHERE name IN (:names)',
                { replacements: { names: roleNames }, transaction }
            );

            const roleIds = roles.map(role => role.id);
            const permissionId = permissions[0].id;
            const now = new Date();
            let links = [];

            if (roleIds.length) {
                const [existingLinks] = await queryInterface.sequelize.query(
                    'SELECT role_id, permission_id FROM role_permissions WHERE permission_id = :permissionId AND role_id IN (:roleIds)',
                    { replacements: { permissionId, roleIds }, transaction }
                );
                const existingRoleIds = new Set(existingLinks.map(link => String(link.role_id)));
                links = roles
                    .filter(role => !existingRoleIds.has(String(role.id)))
                    .map(role => ({
                        role_id: role.id,
                        permission_id: permissionId,
                        created_at: now,
                        updated_at: now
                    }));
            }

            // roles.id and permissions.id are INTEGER in their table migrations;
            // role_permissions uses the same types for these foreign keys.
            await queryInterface.createTable(trackingTable, {
                role_id: { type: Sequelize.INTEGER, allowNull: false, primaryKey: true },
                permission_id: { type: Sequelize.INTEGER, allowNull: false, primaryKey: true },
                created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
            }, { transaction });

            if (links.length) {
                await queryInterface.bulkInsert('role_permissions', links, { transaction });
                await queryInterface.bulkInsert(
                    trackingTable,
                    links.map(({ role_id, permission_id }) => ({ role_id, permission_id, created_at: now })),
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
            let introducedLinks;
            try {
                [introducedLinks] = await queryInterface.sequelize.query(
                    `SELECT role_id, permission_id FROM ${trackingTable}`,
                    { transaction }
                );
            } catch (error) {
                // A prior version could complete without creating the tracker
                // when it inserted no links. Nothing can safely be removed.
                if (!isMissingTrackingTable(error)) throw error;
                await transaction.commit();
                return;
            }

            for (const link of introducedLinks) {
                await queryInterface.bulkDelete(
                    'role_permissions',
                    { role_id: link.role_id, permission_id: link.permission_id },
                    { transaction }
                );
            }

            await queryInterface.dropTable(trackingTable, { transaction });
            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
};
