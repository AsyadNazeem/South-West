'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const SECRET = 'south-west-test-secret-at-least-32-characters-long';

process.env.JWT_SECRET = SECRET;
delete process.env.JWT_EXPIRES_IN;

const { generateToken, verifyToken } = require('../utils/jwt');

test('JWT: generates a valid admin token', () => {
    const token = generateToken({ userId: 123 });
    const decoded = verifyToken(token);

    assert.equal(decoded.userId, 123);
    assert.equal(decoded.iss, 'south-west-api');
    assert.equal(decoded.aud, 'south-west-admin');
    assert.equal(decoded.alg, undefined);
    assert.ok(decoded.exp > decoded.iat);
});

test('JWT: rejects a missing user ID', () => {
    assert.throws(
        () => generateToken({}),
        /valid userId is required/
    );

    assert.throws(
        () => generateToken(null),
        /valid userId is required/
    );
});

test('JWT: rejects a token with a modified signature', () => {
    const token = generateToken({ userId: 123 });
    const tamperedToken = `${token.slice(0, -1)}x`;

    assert.throws(
        () => verifyToken(tamperedToken),
        error => error.name === 'JsonWebTokenError'
    );
});

test('JWT: rejects an expired token', () => {
    const token = jwt.sign(
        { userId: 123 },
        SECRET,
        {
            algorithm: 'HS256',
            issuer: 'south-west-api',
            audience: 'south-west-admin',
            expiresIn: '-1s'
        }
    );

    assert.throws(
        () => verifyToken(token),
        error => error.name === 'TokenExpiredError'
    );
});

test('JWT: rejects a token with the wrong issuer', () => {
    const token = jwt.sign(
        { userId: 123 },
        SECRET,
        {
            algorithm: 'HS256',
            issuer: 'untrusted-issuer',
            audience: 'south-west-admin',
            expiresIn: '5m'
        }
    );

    assert.throws(
        () => verifyToken(token),
        error => error.name === 'JsonWebTokenError'
    );
});

test('JWT: rejects a token with the wrong audience', () => {
    const token = jwt.sign(
        { userId: 123 },
        SECRET,
        {
            algorithm: 'HS256',
            issuer: 'south-west-api',
            audience: 'south-west-customers',
            expiresIn: '5m'
        }
    );

    assert.throws(
        () => verifyToken(token),
        error => error.name === 'JsonWebTokenError'
    );
});

test('JWT: rejects an unsupported signing algorithm', () => {
    const token = jwt.sign(
        { userId: 123 },
        SECRET,
        {
            algorithm: 'HS384',
            issuer: 'south-west-api',
            audience: 'south-west-admin',
            expiresIn: '5m'
        }
    );

    assert.throws(
        () => verifyToken(token),
        error => error.name === 'JsonWebTokenError'
    );
});

test('JWT: rejects a weak configured secret', () => {
    const previousSecret = process.env.JWT_SECRET;

    try {
        process.env.JWT_SECRET = 'short-secret';

        assert.throws(
            () => generateToken({ userId: 123 }),
            /JWT_SECRET must be configured/
        );
    } finally {
        process.env.JWT_SECRET = previousSecret;
    }
});
