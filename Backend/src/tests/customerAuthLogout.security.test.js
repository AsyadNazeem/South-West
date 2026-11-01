'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const proxyquire = require('proxyquire').noCallThru();

function createResponse() {
    return {
        statusCode: null,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
    };
}

function createLogoutController({
    session = { customer_id: 25 },
    findError = null,
    updateError = null,
} = {}) {
    const calls = {
        find: [],
        update: [],
        audit: [],
    };

    const controller = proxyquire(
        '../controllers/customerAuthController',
        {
            '../models': {
                Customer: {},
                CustomerSession: {
                    async findOne(options) {
                        calls.find.push(options);
                        if (findError) throw findError;
                        return session;
                    },
                    async update(values, options) {
                        calls.update.push({ values, options });
                        if (updateError) throw updateError;
                        return [1];
                    },
                },
                CustomerEmailVerification: {},
                sequelize: {},
            },
            '../services/emailService': {
                async sendVerificationCode() {},
            },
            '../services/auditLogService': {
                async recordAuditLog(entry) {
                    calls.audit.push(entry);
                },
            },
            sequelize: {
                Op: {},
            },
        }
    );

    return { controller, calls };
}

function createRequest(options = {}) {
    const customer = Object.hasOwn(options, 'customer')
        ? options.customer
        : { id: 25 };

    const authorization = Object.hasOwn(options, 'authorization')
        ? options.authorization
        : 'Bearer customer-test-token';

    return {
        customer,
        headers: authorization === undefined
            ? {}
            : { authorization },
        ip: '127.0.0.1',
        id: 'logout-security-test',
        get() {
            return 'logout-test-agent';
        },
    };
}

function expectedTokenHash(token) {
    return crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');
}

test('Customer logout: revokes only the authenticated customer session', async () => {
    const { controller, calls } = createLogoutController();
    const res = createResponse();

    await controller.logout(createRequest(), res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.message, 'Logout successful.');

    assert.equal(calls.find.length, 1);
    assert.equal(calls.update.length, 1);

    const expectedHash = expectedTokenHash('customer-test-token');

    assert.deepEqual(calls.find[0].where, {
        token_hash: expectedHash,
        customer_id: 25,
        revoked_at: null,
    });

    assert.deepEqual(calls.update[0].options.where, {
        token_hash: expectedHash,
        customer_id: 25,
        revoked_at: null,
    });

    assert.ok(calls.update[0].values.revoked_at instanceof Date);

    assert.equal(
        calls.audit[0].action,
        'CUSTOMER_LOGOUT_SUCCESS'
    );
    assert.equal(calls.audit[0].entityId, 25);
});

test('Customer logout: rejects missing customer authentication context', async () => {
    const { controller, calls } = createLogoutController();
    const res = createResponse();

    await controller.logout(
        createRequest({ customer: null }),
        res
    );

    assert.equal(res.statusCode, 401);
    assert.equal(calls.find.length, 0);
    assert.equal(calls.update.length, 0);
});

test('Customer logout: rejects missing bearer token', async () => {
    const { controller, calls } = createLogoutController();
    const res = createResponse();

    await controller.logout(
        createRequest({ authorization: undefined }),
        res
    );

    assert.equal(res.statusCode, 401);
    assert.equal(calls.find.length, 0);
    assert.equal(calls.update.length, 0);
});

test('Customer logout: rejects empty bearer token', async () => {
    const { controller, calls } = createLogoutController();
    const res = createResponse();

    await controller.logout(
        createRequest({ authorization: 'Bearer   ' }),
        res
    );

    assert.equal(res.statusCode, 401);
    assert.equal(calls.find.length, 0);
    assert.equal(calls.update.length, 0);
});

test('Customer logout: handles an already revoked or missing session generically', async () => {
    const { controller, calls } = createLogoutController({
        session: null,
    });
    const res = createResponse();

    await controller.logout(createRequest(), res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.message, 'Logout successful.');
    assert.equal(calls.update.length, 1);
    assert.equal(
        calls.audit[0].action,
        'CUSTOMER_LOGOUT_FAILED'
    );
});

test('Customer logout: returns 500 when session lookup fails', async () => {
    const { controller, calls } = createLogoutController({
        findError: new Error('Database lookup failure'),
    });
    const res = createResponse();

    await controller.logout(createRequest(), res);

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.message, 'Unable to log out.');
    assert.equal(calls.update.length, 0);
});

test('Customer logout: returns 500 when session revocation fails', async () => {
    const { controller, calls } = createLogoutController({
        updateError: new Error('Database update failure'),
    });
    const res = createResponse();

    await controller.logout(createRequest(), res);

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.message, 'Unable to log out.');
    assert.equal(calls.update.length, 1);
});
