'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();

test('notification audit snapshot stores title and message lengths without content', async () => {
    const auditEvents = [];
    const transaction = { id: 'transaction' };
    const created = {
        id: 15,
        customer_id: 23,
        type: 'order_update',
        title: 'Private notification title',
        message: 'Private notification message',
        reference_type: 'order',
        reference_id: 91,
        is_read: false,
        read_at: null,
        get() { return { ...this }; }
    };
    const controller = proxyquire('../controllers/notificationController', {
        '../models': {
            sequelize: { transaction: async callback => callback(transaction) },
            Notification: { create: async () => created, findByPk: async () => created },
            Customer: { findByPk: async () => ({ id: 23 }) }
        },
        '../services/auditLogService': {
            recordAuditLog: async event => auditEvents.push(event)
        }
    });
    const req = {
        user: { id: 7 },
        ip: '127.0.0.1',
        id: 'request-1',
        get: () => 'test-agent',
        body: {
            customer_id: 23,
            type: 'order_update',
            title: created.title,
            message: created.message,
            reference_type: 'order',
            reference_id: 91
        }
    };
    const res = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };

    await controller.createNotification(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(auditEvents.length, 1);
    const snapshot = auditEvents[0].newValues;
    assert.equal(snapshot.title_length, created.title.length);
    assert.equal(snapshot.message_length, created.message.length);
    assert.equal(Object.hasOwn(snapshot, 'title'), false);
    assert.equal(Object.hasOwn(snapshot, 'message'), false);
    assert.equal(JSON.stringify(snapshot).includes(created.title), false);
    assert.equal(JSON.stringify(snapshot).includes(created.message), false);
});
