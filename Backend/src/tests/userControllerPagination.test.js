'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();
const { Op } = require('sequelize');

function loadController() {
    const calls = [];
    const User = {
        rawAttributes: { email: {}, is_active: {} },
        async findAndCountAll(options) {
            calls.push(options);
            return { rows: [{ id: 22, email: 'inactive@example.com', is_active: false }], count: 11 };
        }
    };
    const controller = proxyquire('../controllers/userController', {
        '../models': { sequelize: {}, User, Role: {}, UserRole: {}, UserSession: {} },
        '../services/auditLogService': { recordAuditLog: async () => {} },
        bcryptjs: { hash: async () => 'unused' }
    });
    return { controller, calls };
}

function response() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
}

test('admin user list applies active status and search before pagination', async () => {
    const { controller, calls } = loadController();
    const req = { query: { page: '2', pageSize: '10', search: 'inactive', status: 'inactive' } };
    const res = response();

    await controller.getUsers(req, res);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].where.is_active, false);
    assert.ok(calls[0].where[Op.or].length > 0);
    assert.equal(calls[0].limit, 10);
    assert.equal(calls[0].offset, 10);
    assert.equal(calls[0].distinct, true);
    assert.deepEqual(res.body.pagination, { page: 2, pageSize: 10, total: 11, totalPages: 2 });
});
