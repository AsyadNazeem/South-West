'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
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
        }
    };
}

function createRequest(authorization) {
    return {
        headers: authorization === undefined
            ? {}
            : { authorization }
    };
}

function createAdminMiddleware({
    decoded = { userId: 10 },
    verifyError = null,
    session = { id: 1 },
    user = { id: 10, is_active: true }
} = {}) {
    const calls = {
        verify: 0,
        session: 0,
        user: 0
    };

    const middleware = proxyquire('../middleware/authMiddleware', {
        '../utils/jwt': {
            verifyToken(token) {
                calls.verify++;
                if (verifyError) throw verifyError;
                return decoded;
            }
        },
        '../models': {
            User: {
                async findByPk() {
                    calls.user++;
                    return user;
                }
            },
            UserSession: {
                async findOne() {
                    calls.session++;
                    return session;
                }
            }
        },
        '../services/authService': {
            hashSessionToken() {
                return 'test-token-hash';
            }
        }
    });

    return { middleware, calls };
}

function createCustomerMiddleware({
    decoded = {
        type: 'customer',
        customerId: 20,
        sessionId: 'customer-session-1'
    },
    verifyError = null,
    session = {
        customer_id: 20,
        session_uuid: 'customer-session-1'
    },
    customer = { id: 20, is_active: true },
    secret = 'customer-test-secret'
} = {}) {
    if (secret == null) {
        delete process.env.CUSTOMER_JWT_SECRET;
    } else {
        process.env.CUSTOMER_JWT_SECRET = secret;
    }

    const calls = {
        verify: 0,
        session: 0,
        customer: 0
    };

    const middleware = proxyquire(
        '../middleware/customerAuthMiddleware',
        {
            jsonwebtoken: {
                verify() {
                    calls.verify++;
                    if (verifyError) throw verifyError;
                    return decoded;
                }
            },
            '../models': {
                Customer: {
                    async findByPk() {
                        calls.customer++;
                        return customer;
                    }
                },
                CustomerSession: {
                    async findOne() {
                        calls.session++;
                        return session;
                    }
                }
            }
        }
    );

    return { middleware, calls, secret };
}

// ADMIN AUTHENTICATION

test('Admin auth: rejects a missing Authorization header', async () => {
    const { middleware, calls } = createAdminMiddleware();
    const req = createRequest();
    const res = createResponse();

    await middleware(req, res, () => assert.fail('next should not run'));

    assert.equal(res.statusCode, 401);
    assert.equal(calls.verify, 0);
});

test('Admin auth: rejects an invalid JWT', async () => {
    const { middleware } = createAdminMiddleware({
        verifyError: Object.assign(new Error('Invalid token'), {
            name: 'JsonWebTokenError'
        })
    });

    const res = createResponse();

    await middleware(
        createRequest('Bearer invalid-token'),
        res,
        () => assert.fail('next should not run')
    );

    assert.equal(res.statusCode, 401);
});

test('Admin auth: rejects a token without an active database session', async () => {
    const { middleware, calls } = createAdminMiddleware({
        session: null
    });

    const res = createResponse();

    await middleware(
        createRequest('Bearer valid-token'),
        res,
        () => assert.fail('next should not run')
    );

    assert.equal(res.statusCode, 401);
    assert.equal(calls.user, 0);
});

test('Admin auth: rejects an inactive account', async () => {
    const { middleware } = createAdminMiddleware({
        user: { id: 10, is_active: false }
    });

    const res = createResponse();

    await middleware(
        createRequest('Bearer valid-token'),
        res,
        () => assert.fail('next should not run')
    );

    assert.equal(res.statusCode, 403);
});

test('Admin auth: accepts a valid token and active session', async () => {
    const { middleware } = createAdminMiddleware();
    const req = createRequest('Bearer valid-token');
    const res = createResponse();
    let nextCalled = false;

    await middleware(req, res, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(req.user.id, 10);
    assert.equal(req.session.id, 1);
    assert.equal(res.statusCode, null);
});

// CUSTOMER AUTHENTICATION

test('Customer auth: rejects a missing Authorization header', async () => {
    const { middleware, calls } = createCustomerMiddleware();
    const res = createResponse();

    await middleware(
        createRequest(),
        res,
        () => assert.fail('next should not run')
    );

    assert.equal(res.statusCode, 401);
    assert.equal(calls.verify, 0);
});

test('Customer auth: rejects a token without customer identity claims', async () => {
    const { middleware } = createCustomerMiddleware({
        decoded: { userId: 10 }
    });

    const res = createResponse();

    await middleware(
        createRequest('Bearer admin-token'),
        res,
        () => assert.fail('next should not run')
    );

    assert.equal(res.statusCode, 401);
});

test('Customer auth: rejects a session belonging to another customer', async () => {
    const { middleware } = createCustomerMiddleware({
        session: {
            customer_id: 99,
            session_uuid: 'customer-session-1'
        }
    });

    const res = createResponse();

    await middleware(
        createRequest('Bearer customer-token'),
        res,
        () => assert.fail('next should not run')
    );

    assert.equal(res.statusCode, 401);
});

test('Customer auth: rejects a mismatched session ID', async () => {
    const { middleware } = createCustomerMiddleware({
        session: {
            customer_id: 20,
            session_uuid: 'different-session'
        }
    });

    const res = createResponse();

    await middleware(
        createRequest('Bearer customer-token'),
        res,
        () => assert.fail('next should not run')
    );

    assert.equal(res.statusCode, 401);
});

test('Customer auth: rejects an inactive customer', async () => {
    const { middleware } = createCustomerMiddleware({
        customer: { id: 20, is_active: false }
    });

    const res = createResponse();

    await middleware(
        createRequest('Bearer customer-token'),
        res,
        () => assert.fail('next should not run')
    );

    assert.equal(res.statusCode, 401);
});

test('Customer auth: accepts a valid customer session', async () => {
    const { middleware } = createCustomerMiddleware();
    const req = createRequest('Bearer customer-token');
    const res = createResponse();
    let nextCalled = false;

    await middleware(req, res, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(req.customer.id, 20);
    assert.equal(req.customerSession.session_uuid, 'customer-session-1');
    assert.equal(res.statusCode, null);
});

test('Customer auth: returns 500 when its JWT secret is missing', async () => {
    const previousSecret = process.env.CUSTOMER_JWT_SECRET;
    delete process.env.CUSTOMER_JWT_SECRET;

    try {
        const { middleware, calls } = createCustomerMiddleware({
            secret: null
        });

        const res = createResponse();

        await middleware(
            createRequest('Bearer customer-token'),
            res,
            () => assert.fail('next should not run')
        );

        assert.equal(res.statusCode, 500);
        assert.equal(calls.verify, 0);
    } finally {
        if (previousSecret === undefined) {
            delete process.env.CUSTOMER_JWT_SECRET;
        } else {
            process.env.CUSTOMER_JWT_SECRET = previousSecret;
        }
    }
});
