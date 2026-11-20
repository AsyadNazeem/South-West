'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const migration = require('../migrations/20261120130000-add-final-email-delivery-to-invoices');

test('final invoice email migration adds durable delivery state and retry fields', async () => {
    const calls = [];
    const queryInterface = {
        async addColumn(table, column, definition) {
            calls.push(['addColumn', table, column, definition]);
        },
        async addIndex(table, columns, options) {
            calls.push(['addIndex', table, columns, options]);
        }
    };
    const Sequelize = {
        ENUM: (...values) => ({ type: 'ENUM', values }),
        DATE: 'DATE',
        INTEGER: { UNSIGNED: 'UNSIGNED_INTEGER' },
        STRING: () => 'STRING'
    };

    await migration.up(queryInterface, Sequelize);
    assert.deepEqual(
        calls.filter(call => call[0] === 'addColumn').map(call => call[2]),
        [
            'final_email_status', 'final_email_claimed_at',
            'final_email_sent_at', 'final_email_attempts',
            'final_email_last_error'
        ]
    );
    assert.equal(calls.at(-1)[0], 'addIndex');
    assert.equal(calls.at(-1)[3].name, 'idx_invoices_final_email_status');
});
