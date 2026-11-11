'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const migration = require('../migrations/20261111140000-add-delivery-tracking-url');

test('delivery tracking URL migration adds a nullable URL column and rolls it back', async () => {
    const calls = [];
    const queryInterface = {
        async addColumn(...args) { calls.push(['add', ...args]); },
        async removeColumn(...args) { calls.push(['remove', ...args]); }
    };
    const Sequelize = { STRING: length => ({ type: 'STRING', length }) };

    await migration.up(queryInterface, Sequelize);
    assert.equal(calls[0][1], 'deliveries');
    assert.equal(calls[0][2], 'tracking_url');
    assert.equal(calls[0][3].type.length, 2048);
    assert.equal(calls[0][3].allowNull, true);

    await migration.down(queryInterface);
    assert.deepEqual(calls[1], ['remove', 'deliveries', 'tracking_url']);
});
