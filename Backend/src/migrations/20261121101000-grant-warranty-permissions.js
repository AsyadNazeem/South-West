'use strict';

const { permissionCatalog } = require('../config/permissions');
module.exports = {
    async up(q) {
        const definitions = permissionCatalog.filter(p => p.module === 'warranty_claims');
        await q.sequelize.transaction(async transaction => {
            for (const permission of definitions) {
                await q.sequelize.query(
                    'INSERT IGNORE INTO permissions (name,module,description,created_at,updated_at) VALUES (:name,:module,:description,NOW(),NOW())',
                    { replacements: permission, transaction });
                await q.sequelize.query(
                    `INSERT INTO role_permissions (role_id,permission_id,created_at,updated_at)
                     SELECT r.id,p.id,NOW(),NOW() FROM roles r JOIN permissions p ON p.name=:name
                     WHERE r.name IN ('Admin','Super Admin') AND NOT EXISTS
                     (SELECT 1 FROM role_permissions rp WHERE rp.role_id=r.id AND rp.permission_id=p.id)`,
                    { replacements: permission, transaction });
            }
        });
    },
    async down() { /* Preserve administrator-managed assignments. */ }
};
