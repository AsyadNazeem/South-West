'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();

function createHarness(authorization) {
    const calls = {
        auth: 0,
        next: 0,
    };

    const customerAuth = (req, res, next) => {
        calls.auth += 1;
        return next();
    };

    const middleware = proxyquire(
        '../middleware/optionalCustomerAuthMiddleware',
        {
            '../middleware/customerAuthMiddleware': customerAuth,
        }
    );

    const req = {
        headers: {},
    };

    if (authorization !== undefined) {
        req.headers.authorization = authorization;
    }

    const res = {};

    const next = () => {
        calls.next += 1;
    };

    return { middleware, req, res, next, calls };
}

test('allows guest requests without an Authorization header', () => {
    const h = createHarness();

    h.middleware(h.req, h.res, h.next);

    assert.equal(h.calls.auth, 0);
    assert.equal(h.calls.next, 1);
});

test('passes requests with an Authorization header to customer authentication', () => {
    const h = createHarness('Bearer valid-customer-token');

    h.middleware(h.req, h.res, h.next);

    assert.equal(h.calls.auth, 1);
    assert.equal(h.calls.next, 1);
});

test('does not bypass authentication when an invalid token is supplied', () => {
    let authenticationRejected = false;

    const customerAuth = (req, res, next) => {
        authenticationRejected = true;
        return res.status(401).json({
            message: 'Invalid or expired customer token.',
        });
    };

    const middleware = proxyquire(
        '../middleware/optionalCustomerAuthMiddleware',
        {
            '../middleware/customerAuthMiddleware': customerAuth,
        }
    );

    const req = {
        headers: {
            authorization: 'Bearer invalid-token',
        },
    };

    const res = {
        statusCode: 200,
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

    middleware(req, res, () => {
        assert.fail('Invalid token must not continue as a guest.');
    });

    assert.equal(authenticationRejected, true);
    assert.equal(res.statusCode, 401);
    assert.equal(
        res.body.message,
        'Invalid or expired customer token.'
    );
});

test('passes malformed Authorization headers to customer authentication', () => {
    const h = createHarness('InvalidHeader');

    h.middleware(h.req, h.res, h.next);

    assert.equal(h.calls.auth, 1);
    assert.equal(h.calls.next, 1);
});
