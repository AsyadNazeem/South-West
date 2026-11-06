'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const migration = require('../migrations/20261106180000-grant-notifications-view-to-operational-roles');

const allRoles = [
    { id: 1, name: 'Manager' }, { id: 2, name: 'Staff' }, { id: 3, name: 'Sales' }
];
const Sequelize = { INTEGER: 'INTEGER', DATE: 'DATE', literal: value => value };

function queryInterfaceWith({ existingLinks = [], introducedLinks = [], roles = allRoles, missingTracker = false } = {}) {
    const calls = { queries: [], creates: [], inserts: [], deletes: [], drops: [], commits: 0, rollbacks: 0 };
    const transaction = {
        commit: async () => { calls.commits += 1; },
        rollback: async () => { calls.rollbacks += 1; }
    };
    const queryInterface = {
        sequelize: {
            transaction: async () => transaction,
            async query(sql, options) {
                calls.queries.push({ sql, options });
                if (sql.includes('FROM permissions')) return [[{ id: 90 }], {}];
                if (sql.includes('FROM roles')) return [roles, {}];
                if (sql.includes('FROM role_permissions')) return [existingLinks, {}];
                if (sql.includes('FROM migration_notifications_view_role_permissions')) {
                    if (missingTracker) {
                        const error = new Error("Table 'migration_notifications_view_role_permissions' doesn't exist");
                        error.code = 'ER_NO_SUCH_TABLE';
                        throw error;
                    }
                    return [introducedLinks, {}];
                }
                throw new Error(`Unexpected query: ${sql}`);
            }
        },
        async createTable(table, attributes, options) { calls.creates.push({ table, attributes, options }); },
        async bulkInsert(table, rows, options) { calls.inserts.push({ table, rows, options }); },
        async bulkDelete(table, where, options) { calls.deletes.push({ table, where, options }); },
        async dropTable(table, options) { calls.drops.push({ table, options }); }
    };
    return { queryInterface, calls };
}

test('migration inserts only missing role links and tracks only the links it creates', async () => {
    const { queryInterface, calls } = queryInterfaceWith({ existingLinks: [{ role_id: 1, permission_id: 90 }] });

    await migration.up(queryInterface, Sequelize);

    assert.equal(calls.queries[0].options.replacements.name, 'notifications.view');
    assert.deepEqual(calls.queries[1].options.replacements.names, ['Manager', 'Staff', 'Sales']);
    assert.deepEqual(calls.inserts[0].rows.map(link => link.role_id), [2, 3]);
    assert.deepEqual(calls.inserts[0].rows.map(link => link.permission_id), [90, 90]);
    assert.equal(calls.inserts[1].table, 'migration_notifications_view_role_permissions');
    assert.deepEqual(calls.inserts[1].rows.map(link => link.role_id), [2, 3]);
    assert.equal(calls.creates.length, 1);
    assert.equal(calls.creates[0].attributes.role_id.type, Sequelize.INTEGER);
    assert.equal(calls.creates[0].attributes.permission_id.type, Sequelize.INTEGER);
    assert.equal(calls.commits, 1);
});

test('migration creates an empty tracker when every assignment already exists, and down succeeds', async () => {
    const existingLinks = allRoles.map(role => ({ role_id: role.id, permission_id: 90 }));
    const { queryInterface, calls } = queryInterfaceWith({ existingLinks });

    await migration.up(queryInterface, Sequelize);
    assert.equal(calls.creates.length, 1);
    assert.equal(calls.inserts.length, 0);

    await migration.down(queryInterface);
    assert.equal(calls.deletes.length, 0);
    assert.equal(calls.drops[0].table, 'migration_notifications_view_role_permissions');
    assert.equal(calls.commits, 2);
});

test('migration creates a tracker and completes safely when no expected roles exist', async () => {
    const { queryInterface, calls } = queryInterfaceWith({ roles: [] });

    await migration.up(queryInterface, Sequelize);

    assert.equal(calls.creates.length, 1);
    assert.equal(calls.inserts.length, 0);
    assert.equal(calls.commits, 1);
});

test('migration handles a missing role when the other expected roles are present', async () => {
    const roles = [allRoles[0], allRoles[2]];
    const { queryInterface, calls } = queryInterfaceWith({
        roles,
        existingLinks: [{ role_id: 1, permission_id: 90 }]
    });

    await migration.up(queryInterface, Sequelize);

    assert.deepEqual(calls.inserts[0].rows.map(link => link.role_id), [3]);
    assert.deepEqual(calls.inserts[1].rows.map(link => link.role_id), [3]);
    assert.equal(calls.commits, 1);
});

test('down deletes only assignments recorded as introduced by this migration', async () => {
    const introducedLinks = [{ role_id: 2, permission_id: 90 }, { role_id: 3, permission_id: 90 }];
    const { queryInterface, calls } = queryInterfaceWith({ introducedLinks });

    await migration.down(queryInterface);

    assert.deepEqual(calls.deletes.map(call => call.where), introducedLinks);
    assert.deepEqual(calls.deletes.map(call => call.table), ['role_permissions', 'role_permissions']);
    assert.equal(calls.drops[0].table, 'migration_notifications_view_role_permissions');
    assert.equal(calls.commits, 1);
});

test('down treats a missing legacy tracker as no recorded assignments', async () => {
    const { queryInterface, calls } = queryInterfaceWith({ missingTracker: true });

    await migration.down(queryInterface);

    assert.equal(calls.deletes.length, 0);
    assert.equal(calls.drops.length, 0);
    assert.equal(calls.commits, 1);
});
