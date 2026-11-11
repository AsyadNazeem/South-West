'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();

function setup({ dismissed = false, alreadyRead = false, alreadyDismissed = false, auditError = null, missingColumn = false } = {}) {
    const events = [];
    const notification = {
        id: 41, type: 'order', title: 'PRIVATE TITLE', message: 'PRIVATE MESSAGE',
        reference_type: 'order', reference_id: 902, is_read: alreadyRead,
        ...(dismissed ? { is_dismissed: alreadyDismissed } : {}),
        async update(values) { if (missingColumn && Object.hasOwn(values, 'is_dismissed')) { const error = new Error("Unknown column 'is_dismissed'"); error.original = { code: 'ER_BAD_FIELD_ERROR', message: error.message }; throw error; } Object.assign(this, values); }
    };
    const AdminNotification = { findOne: async options => { setup.lastOptions = options; if (missingColumn && options.attributes.includes('is_dismissed')) { const error = new Error("Unknown column 'is_dismissed'"); error.original = { code: 'ER_BAD_FIELD_ERROR', message: error.message }; throw error; } return notification; } };
    const controller = proxyquire('../controllers/adminNotificationController', {
        '../models': { User: {}, Role: {}, AdminNotification, AdminNotificationPreference: {} },
        '../services/auditLogService': { recordAuditLog: async event => { if (auditError) throw auditError; events.push(event); } }
    });
    return { controller, notification, events };
}

function res() { return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }
const req = { user: { id: 7 }, params: { id: 41 }, ip: '127.0.0.1', get: () => 'test-agent' };

test('marked-read audit captures safe metadata and accurate old/new states', async () => {
    const { controller, events } = setup({ dismissed: true });
    const response = res();
    await controller.markRead(req, response);
    assert.equal(events.length, 1);
    assert.equal(events[0].action, 'ADMIN_NOTIFICATION_MARKED_READ');
    assert.deepEqual(events[0].oldValues, { is_read: false, is_dismissed: false });
    assert.deepEqual(events[0].newValues, { type: 'order', reference_type: 'order', reference_id: 902, is_read: true, is_dismissed: false });
    assert.equal(JSON.stringify(events[0]).includes('PRIVATE'), false);
    assert.ok(setup.lastOptions.attributes.includes('is_dismissed'));
});

test('marking an already-read notification does not record another audit event', async () => {
    const { controller, events, notification } = setup({ dismissed: true, alreadyRead: true });
    const response = res();
    await controller.markRead(req, response);
    assert.equal(events.length, 0);
    assert.equal(response.statusCode, 200);
    assert.equal(notification.is_read, true);
});

test('dismissed audit captures safe metadata and accurate old/new states', async () => {
    const { controller, events } = setup({ dismissed: true });
    const response = res();
    await controller.dismiss(req, response);
    assert.equal(response.statusCode, 200);
    assert.equal(events[0].action, 'ADMIN_NOTIFICATION_DISMISSED');
    assert.deepEqual(events[0].oldValues, { is_read: false, is_dismissed: false });
    assert.deepEqual(events[0].newValues, { type: 'order', reference_type: 'order', reference_id: 902, is_read: false, is_dismissed: true });
    assert.equal(JSON.stringify(events[0]).includes('PRIVATE'), false);
});

test('dismissing an already-dismissed notification does not record another audit event', async () => {
    const { controller, events, notification } = setup({ dismissed: true, alreadyDismissed: true });
    const response = res();
    await controller.dismiss(req, response);
    assert.equal(events.length, 0);
    assert.equal(response.statusCode, 200);
    assert.equal(notification.is_dismissed, true);
});

test('notification actions succeed if audit storage fails', async () => {
    const error = new Error('audit unavailable');
    const read = setup({ dismissed: true, auditError: error });
    await read.controller.markRead(req, res());
    assert.equal(read.notification.is_read, true);
    const dismiss = setup({ dismissed: true, auditError: error });
    const response = res();
    await dismiss.controller.dismiss(req, response);
    assert.equal(response.statusCode, 200);
    assert.equal(dismiss.notification.is_dismissed, true);
});

test('mark-read remains compatible when is_dismissed is absent', async () => {
    const { controller, events } = setup();
    await controller.markRead(req, res());
    assert.deepEqual(events[0].oldValues, { is_read: false, is_dismissed: null });
    assert.equal(events[0].newValues.is_dismissed, null);
});

test('mark-read retries without is_dismissed on older database schemas', async () => {
    const { controller, events } = setup({ missingColumn: true });
    await controller.markRead(req, res());
    assert.deepEqual(events[0].oldValues, { is_read: false, is_dismissed: null });
    assert.equal(events[0].newValues.is_dismissed, null);
});

test('dismiss keeps legacy-schema response when the dismissal column is absent', async () => {
    const { controller, events } = setup({ missingColumn: true });
    const response = res();
    await controller.dismiss(req, response);
    assert.equal(response.statusCode, 503);
    assert.equal(events.length, 0);
    assert.equal(setup.lastOptions.attributes.includes('is_dismissed'), false);
});
