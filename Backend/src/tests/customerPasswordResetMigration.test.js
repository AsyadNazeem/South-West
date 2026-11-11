'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const migration = require('../migrations/20261110100000-create-customer-password-reset-tokens');

test('password reset migration creates indexed tokens with customer cascade foreign key and safe rollback', async () => {
    let table;
    const indexes = [];
    let dropped;
    const queryInterface = {
        async createTable(name, columns) { table = { name, columns }; },
        async addIndex(name, fields, options) { indexes.push({ name, fields, options }); },
        async dropTable(name) { dropped = name; },
    };
    const Sequelize = {
        BIGINT: { UNSIGNED: 'BIGINT UNSIGNED' },
        CHAR: length => `CHAR(${length})`,
        DATE: 'DATE',
        literal: value => ({ value }),
    };

    await migration.up(queryInterface, Sequelize);
    assert.equal(table.name, 'customer_password_reset_tokens');
    assert.deepEqual(table.columns.customer_id.references, { model: 'customers', key: 'id' });
    assert.equal(table.columns.customer_id.onDelete, 'CASCADE');
    assert.equal(table.columns.token_hash.unique, true);
    assert.equal(indexes.length, 2);
    assert.deepEqual(indexes.map(index => index.fields), [['customer_id'], ['expires_at']]);

    await migration.down(queryInterface);
    assert.equal(dropped, 'customer_password_reset_tokens');
});
