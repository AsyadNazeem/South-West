'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();

function loadNotifyAdmins({ admins = [] } = {}) {
    const calls = { findAll: [], bulkCreate: [] };
    const controller = proxyquire('../controllers/adminNotificationController', {
        '../models': {
            User: {
                async findAll(options) {
                    calls.findAll.push(options);
                    return admins;
                }
            },
            Role: {},
            AdminNotification: {
                async bulkCreate(rows, options) {
                    calls.bulkCreate.push({ rows, options });
                }
            },
            AdminNotificationPreference: {}
        },
        '../services/auditLogService': {}
    });

    return { notifyAdmins: controller.notifyAdmins, calls };
}

test('notifyAdmins filters recipients by preference and propagates the transaction', async () => {
    const transaction = { id: 'transaction-1' };
    const admins = [
        { id: 11, adminNotificationPreference: { new_orders: true } },
        { id: 12, adminNotificationPreference: { new_orders: false } },
        { id: 13, adminNotificationPreference: null }
    ];
    const { notifyAdmins, calls } = loadNotifyAdmins({ admins });

    await notifyAdmins({
        type: 'order',
        title: 'New order',
        message: 'A customer placed an order.',
        referenceType: 'order',
        referenceId: 123,
        transaction
    });

    assert.equal(calls.findAll.length, 1);
    assert.equal(calls.findAll[0].transaction, transaction);
    assert.equal(calls.findAll[0].where.is_active, true);
    assert.equal(calls.bulkCreate.length, 1);
    assert.equal(calls.bulkCreate[0].options.transaction, transaction);
    assert.deepEqual(calls.bulkCreate[0].rows.map(row => row.user_id), [11, 13]);
    assert.ok(calls.bulkCreate[0].rows.every(row => row.is_read === false));
});

test('notifyAdmins maps notification types to the matching preference', async () => {
    const { notifyAdmins, calls } = loadNotifyAdmins({
        admins: [
            { id: 21, adminNotificationPreference: { reviews: false } },
            { id: 22, adminNotificationPreference: { reviews: true } }
        ]
    });

    await notifyAdmins({ type: 'review', title: 'Review', message: 'A review arrived.' });

    assert.deepEqual(calls.bulkCreate[0].rows.map(row => row.user_id), [22]);
    assert.equal(calls.bulkCreate[0].rows[0].type, 'review');
});

test('notifyAdmins skips bulkCreate when there are no recipients', async () => {
    const { notifyAdmins, calls } = loadNotifyAdmins({ admins: [] });

    await notifyAdmins({ type: 'payment', title: 'Payment', message: 'A payment arrived.' });

    assert.equal(calls.findAll.length, 1);
    assert.equal(calls.bulkCreate.length, 0);
});
