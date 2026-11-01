'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();

function setup({
    requesterRole = 'Admin',
    requestedRole = 'Admin',
    previousRole = 'Staff'
} = {}) {
    const calls = {
        userCreate: 0,
        userRoleCreate: 0,
        userRoleDestroy: 0,
        audit: 0,
        transaction: 0,
        commit: 0,
        rollback: 0
    };

    const transaction = {
        async commit() {
            calls.commit++;
        },
        async rollback() {
            calls.rollback++;
        }
    };

    const requesterAssignment = {
        role: { name: requesterRole }
    };

    const previousAssignment = {
        role_id: 2,
        role: { name: previousRole }
    };

    const User = {
        async findOne() {
            return null;
        },
        async findByPk(id) {
            if (String(id) === '20') {
                return { id: 20 };
            }

            return {
                id: 30,
                email: 'new-user@example.com',
                is_active: true,
                created_at: new Date(),
                roles: [{ id: 1, name: requestedRole }]
            };
        },
        async create(values) {
            calls.userCreate++;
            return { id: 30, ...values };
        }
    };

    const UserRole = {
        async findOne(options) {
            if (options?.where?.user_id === 10) {
                return requesterAssignment;
            }

            return previousAssignment;
        },
        async create() {
            calls.userRoleCreate++;
        },
        async destroy() {
            calls.userRoleDestroy++;
        }
    };

    const Role = {
        async findByPk(id) {
            return {
                id: Number(id),
                name: requestedRole
            };
        }
    };

    const sequelize = {
        async transaction(callback) {
            calls.transaction++;

            if (typeof callback === 'function') {
                return callback(transaction);
            }

            return transaction;
        }
    };

    const controller = proxyquire(
        '../controllers/userController',
        {
            '../models': {
                sequelize,
                User,
                UserRole,
                Role,
                UserSession: {}
            },
            '../services/auditLogService': {
                async recordAuditLog() {
                    calls.audit++;
                }
            },
            'bcryptjs': {
                async hash() {
                    return 'test-password-hash';
                }
            }
        }
    );

    const req = {
        user: { id: 10 },
        params: { id: '20' },
        body: {
            email: 'new-user@example.com',
            password: 'TestPassword123!',
            role_id: 1
        },
        ip: '127.0.0.1',
        id: 'admin-authorization-test',
        get() {
            return 'test-agent';
        }
    };

    const res = {
        statusCode: null,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        }
    };

    return { controller, req, res, calls };
}

test('Admin can create another Admin account', async () => {
    const { controller, req, res, calls } = setup();

    await controller.createUser(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(calls.userCreate, 1);
    assert.equal(calls.userRoleCreate, 1);
    assert.equal(calls.audit, 1);
    assert.equal(calls.commit, 1);
});

test('Manager cannot create an Admin account', async () => {
    const { controller, req, res, calls } = setup({
        requesterRole: 'Manager'
    });

    await controller.createUser(req, res);

    assert.equal(res.statusCode, 403);
    assert.equal(calls.userCreate, 0);
    assert.equal(calls.userRoleCreate, 0);
    assert.equal(calls.transaction, 0);
});

test('Staff cannot create an Admin account', async () => {
    const { controller, req, res, calls } = setup({
        requesterRole: 'Staff'
    });

    await controller.createUser(req, res);

    assert.equal(res.statusCode, 403);
    assert.equal(calls.userCreate, 0);
    assert.equal(calls.userRoleCreate, 0);
    assert.equal(calls.transaction, 0);
});

test('Admin can promote another user to Admin', async () => {
    const { controller, req, res, calls } = setup();

    req.body = { role_id: 1 };

    await controller.updateUserRole(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(calls.userRoleDestroy, 1);
    assert.equal(calls.userRoleCreate, 1);
    assert.equal(calls.audit, 1);
    assert.equal(calls.transaction, 1);
});

test('Manager cannot promote another user to Admin', async () => {
    const { controller, req, res, calls } = setup({
        requesterRole: 'Manager'
    });

    req.body = { role_id: 1 };

    await controller.updateUserRole(req, res);

    assert.equal(res.statusCode, 403);
    assert.equal(calls.userRoleDestroy, 0);
    assert.equal(calls.userRoleCreate, 0);
    assert.equal(calls.transaction, 0);
});

test('Staff cannot promote another user to Admin', async () => {
    const { controller, req, res, calls } = setup({
        requesterRole: 'Staff'
    });

    req.body = { role_id: 1 };

    await controller.updateUserRole(req, res);

    assert.equal(res.statusCode, 403);
    assert.equal(calls.userRoleDestroy, 0);
    assert.equal(calls.userRoleCreate, 0);
    assert.equal(calls.transaction, 0);
});

test('Manager can still create a non-Admin account', async () => {
    const { controller, req, res, calls } = setup({
        requesterRole: 'Manager',
        requestedRole: 'Staff'
    });

    await controller.createUser(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(calls.userCreate, 1);
    assert.equal(calls.userRoleCreate, 1);
    assert.equal(calls.commit, 1);
});

test('Public Admin registration route is removed', () => {
    const fs = require('node:fs');
    const path = require('node:path');

    const routesPath = path.join(
        __dirname,
        '../routes/authRoutes.js'
    );

    const source = fs.readFileSync(routesPath, 'utf8');

    assert.doesNotMatch(source, /router\.post\(\s*['"]\/register['"]/);
});
