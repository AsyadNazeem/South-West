'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();

function response() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
}

function loadController({ roles = [], targetUser = null, preferenceRows = [], count = 0, notificationRows = [] } = {}) {
    const calls = { count: [], list: [], findNotification: [], findUsers: [], findPreferences: [], findOrCreate: [] };
    const notification = {
        id: 44,
        update: async values => Object.assign(notification, values),
        toJSON: () => ({ user_id: 7, email: 'target@example.com', new_orders: true })
    };
    const preference = {
        id: 8,
        update: async values => Object.assign(preference, values),
        get: () => ({ user_id: 8, new_orders: true, payments: true, deliveries: true, reviews: true, customer_requests: true })
    };
    const controller = proxyquire('../controllers/adminNotificationController', {
        '../models': {
            User: {
                async findByPk(id, options) {
                    if (options?.include) return { roles: roles.map(name => ({ name })) };
                    return targetUser || (String(id) === '8' ? { id: 8, email: 'target@example.com' } : null);
                },
                async findAndCountAll(options) {
                    calls.findUsers.push(options);
                    return { rows: [{ id: 8, email: 'target@example.com' }], count: 1 };
                }
            },
            Role: {},
            AdminNotification: {
                async count(options) { calls.count.push(options); return count; },
                async findAndCountAll(options) { calls.list.push(options); return { rows: notificationRows, count: notificationRows.length }; },
                async findOne(options) { calls.findNotification.push(options); return notification; }
            },
            AdminNotificationPreference: {
                async findAll(options) { calls.findPreferences.push(options); return preferenceRows; },
                async findOrCreate(options) { calls.findOrCreate.push(options); return [preference, true]; }
            }
        },
        '../services/auditLogService': { recordAuditLog: async () => {} }
    });
    return { controller, calls };
}

test('only Super Admin can view or update other users notification preferences', async () => {
    for (const role of ['Admin', 'Manager', 'Staff', 'Sales']) {
        const { controller, calls } = loadController({ roles: [role] });
        const req = { user: { id: 7 }, query: {}, body: { user_id: 8, new_orders: true, payments: true, deliveries: true, reviews: true, customer_requests: true } };
        const viewRes = response();
        const updateRes = response();

        await controller.preferences(req, viewRes);
        await controller.updatePreferences(req, updateRes);

        assert.equal(viewRes.statusCode, 403, `${role} must not view other users' preferences`);
        assert.equal(updateRes.statusCode, 403, `${role} must not update other users' preferences`);
        assert.equal(calls.findUsers.length, 0);
        assert.equal(calls.findOrCreate.length, 0);
    }
});

test('Super Admin can view and update notification preferences', async () => {
    const { controller, calls } = loadController({ roles: ['Super Admin'] });
    const req = {
        user: { id: 7 }, query: { page: '1', pageSize: '25' },
        body: { user_id: 8, new_orders: false, payments: true, deliveries: true, reviews: true, customer_requests: true },
        ip: '127.0.0.1', id: 'test', get: () => 'node-test'
    };
    const viewRes = response();
    const updateRes = response();

    await controller.preferences(req, viewRes);
    await controller.updatePreferences(req, updateRes);

    assert.equal(viewRes.statusCode, 200);
    assert.equal(viewRes.body.data[0].email, 'target@example.com');
    assert.equal(calls.findUsers.length, 1);
    assert.equal(updateRes.statusCode, 200);
    assert.equal(calls.findOrCreate.length, 1);
});

test('users with notification permission can access only their own notification records', async () => {
    const ownNotification = { id: 44, is_read: false, update: async values => Object.assign(ownNotification, values) };
    const { controller, calls } = loadController({ count: 3, notificationRows: [ownNotification] });
    const req = { user: { id: 7 }, query: {}, params: { id: '44' } };
    const countRes = response();
    const listRes = response();
    const readRes = response();
    const dismissRes = response();

    await controller.unreadCount(req, countRes);
    await controller.list(req, listRes);
    await controller.markRead(req, readRes);
    await controller.dismiss(req, dismissRes);

    assert.equal(countRes.body.count, 3);
    assert.equal(calls.count[0].where.user_id, 7);
    assert.equal(calls.list[0].where.user_id, 7);
    assert.equal(calls.findNotification[0].where.user_id, 7);
    assert.equal(calls.findNotification[1].where.user_id, 7);
    assert.equal(readRes.statusCode, 200);
    assert.equal(dismissRes.statusCode, 200);
});

test('notification routes require authentication and notifications.view for own and preference endpoints', () => {
    const registered = [];
    const router = {
        get: (...args) => registered.push(['get', ...args]),
        post: (...args) => registered.push(['post', ...args]),
        put: (...args) => registered.push(['put', ...args]),
        patch: (...args) => registered.push(['patch', ...args]),
        delete: (...args) => registered.push(['delete', ...args])
    };
    const authenticate = function authenticate() {};
    const requirePermission = name => Object.assign(function permissionGuard() {}, { permissionName: name });
    proxyquire('../routes/notificationRoutes', {
        express: { Router: () => router },
        '../middleware/authMiddleware': authenticate,
        '../middleware/requirePermission': { requirePermission },
        '../controllers/notificationController': Object.fromEntries([
            'getNotifications', 'getNotificationById', 'createNotification', 'updateNotification',
            'deleteNotification', 'getMyNotifications', 'getMyNotificationById', 'markMyNotificationRead'
        ].map(key => [key, () => {}])),
        '../controllers/adminNotificationController': Object.fromEntries(
            ['list', 'unreadCount', 'markRead', 'dismiss', 'preferences', 'updatePreferences'].map(key => [key, () => {}])
        )
    });

    const protectedPaths = [
        '/admin/unread-count', '/admin/mine', '/admin/mine/:id/read',
        '/admin/mine/:id/dismiss', '/admin/preferences'
    ];
    for (const path of protectedPaths) {
        const route = registered.find(entry => entry[1] === path);
        assert.ok(route, `route ${path} should be registered`);
        const handlers = route.slice(2);
        assert.equal(handlers[0], authenticate);
        assert.ok(handlers.some(handler => handler.permissionName === 'notifications.view'));
    }
    const updateRoute = registered.find(entry => entry[1] === '/admin/preferences' && entry[0] === 'put');
    assert.ok(updateRoute.slice(2).some(handler => handler.permissionName === 'notifications.view'));
});
