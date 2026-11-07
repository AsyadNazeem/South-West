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

function createRequest(authorization, activityAt) {
    const headers = {};

    if (authorization !== undefined) {
        headers.authorization = authorization;
    }

    if (activityAt !== undefined) {
        headers['x-user-activity-at'] = String(activityAt);
    }

    return { headers };
}

function createAdminMiddleware({
    decoded = { userId: 10 },
    verifyError = null,
    session = {
        id: 1,
        updated_at: new Date(),
        async update(values) {
            Object.assign(this, values);
        }
    },
    user = { id: 10, is_active: true }
} = {}) {
    const calls = {
        verify: 0,
        session: 0,
        user: 0,
        activityUpdate: 0,
        activitySql: null,
        activityQueryOptions: null
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
            sequelize: {
                LOCK: { UPDATE: 'UPDATE' },
                async transaction(callback) {
                    return callback({
                        LOCK: this.LOCK
                    });
                },
                async query(sql, options) {
                    calls.activityUpdate++;
                    calls.activitySql = sql;
                    calls.activityQueryOptions = options;

                    assert.match(sql, /NOW\(\)/i);
                    session.updated_at = new Date();

                    return [[], {}];
                }
            },
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

// ADMIN INACTIVITY

test('Admin auth: server-observed activity refreshes session activity', async () => {
    const now = Date.now();

    const session = {
        id: 1,
        updated_at: new Date(now - 60 * 1000),
        async update(values) {
            Object.assign(this, values);
        }
    };

    const { middleware, calls } = createAdminMiddleware({ session });
    const res = createResponse();
    let nextCalled = false;

    await middleware(
        createRequest('Bearer valid-token'),
        res,
        () => { nextCalled = true; }
    );

    assert.equal(nextCalled, true);
    assert.equal(calls.activityUpdate, 1);
    assert.match(calls.activitySql, /UPDATE user_sessions/i);
    assert.ok(calls.activityQueryOptions.transaction);
    assert.equal(
        calls.activityQueryOptions.replacements.sessionId,
        session.id
    );
    assert.ok(new Date(session.updated_at).getTime() >= now);
    assert.ok(new Date(session.updated_at).getTime() <= Date.now());
});

test('Admin auth: client timestamps cannot revive an inactive session', async () => {
    const session = {
        id: 1,
        updated_at: new Date(Date.now() - 16 * 60 * 1000),
        async update(values) {
            Object.assign(this, values);
        }
    };

    const { middleware } = createAdminMiddleware({ session });
    const res = createResponse();

    await middleware(
        createRequest('Bearer valid-token', Date.now()),
        res,
        () => assert.fail('next should not run')
    );

    assert.equal(res.statusCode, 401);
    assert.match(res.body.message, /inactivity/i);
    assert.ok(session.revoked_at instanceof Date);
});

test('Admin auth: revokes an inactive session in the database', async () => {
    const session = {
        id: 1,
        updated_at: new Date(Date.now() - 16 * 60 * 1000),
        async update(values) {
            Object.assign(this, values);
        }
    };

    const { middleware, calls } = createAdminMiddleware({ session });
    const res = createResponse();

    await middleware(
        createRequest('Bearer valid-token'),
        res,
        () => assert.fail('next should not run')
    );

    assert.equal(res.statusCode, 401);
    assert.ok(session.revoked_at instanceof Date);
    assert.equal(calls.user, 0);
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
