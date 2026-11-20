'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const migration = require('../migrations/20261120100000-add-delivery-location-to-order-addresses');

test('order address migration adds nullable delivery location references', async () => {
    const calls = [];
    const queryInterface = {
        addColumn: async (...args) => calls.push(['addColumn', ...args]),
        addIndex: async (...args) => calls.push(['addIndex', ...args]),
    };
    const BIGINT = { UNSIGNED: 'BIGINT UNSIGNED' };

    await migration.up(queryInterface, { BIGINT });

    const district = calls.find(call => call[0] === 'addColumn' && call[2] === 'district_id');
    const area = calls.find(call => call[0] === 'addColumn' && call[2] === 'area_id');

    assert.equal(district[3].allowNull, true);
    assert.deepEqual(district[3].references, { model: 'delivery_districts', key: 'id' });
    assert.equal(area[3].allowNull, true);
    assert.deepEqual(area[3].references, { model: 'delivery_areas', key: 'id' });
});
