'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    redactSensitiveValues
} = require('../src/services/auditLogService');

test('redacts sensitive fields and preserves ordinary audit data', () => {
    const input = {
        email: 'staff@example.com',
        password: 'example-password',
        password_hash: 'example-hash',
        password_confirmation: 'example-confirmation',
        token: 'example-token',
        accessToken: 'example-access-token',
        refresh_token_hash: 'example-refresh-hash',
        newPassword: 'dummy-password',
        passwordHash: 'dummy-hash',
        api_key: 'dummy-api-key',
        sessionId: 'dummy-session-id',
        authorization: 'Bearer example-token',
        private_key: 'private-key',
        details: {
            client_secret: 'example-secret',
            role_name: 'Staff'
        }
    };

    const result = redactSensitiveValues(input);

    assert.equal(result.email, 'staff@example.com');
    assert.equal(result.password, '[REDACTED]');
    assert.equal(result.password_hash, '[REDACTED]');
    assert.equal(result.password_confirmation, '[REDACTED]');
    assert.equal(result.token, '[REDACTED]');
    assert.equal(result.accessToken, '[REDACTED]');
    assert.equal(result.refresh_token_hash, '[REDACTED]');
    assert.equal(result.newPassword, '[REDACTED]');
    assert.equal(result.passwordHash, '[REDACTED]');
    assert.equal(result.api_key, '[REDACTED]');
    assert.equal(result.sessionId, '[REDACTED]');
    assert.equal(result.authorization, '[REDACTED]');
    assert.equal(result.private_key, '[REDACTED]');
    assert.equal(result.details.client_secret, '[REDACTED]');
    assert.equal(result.details.role_name, 'Staff');

    // Redaction must not mutate the caller's object.
    assert.equal(input.password, 'example-password');
});

test('redacts sensitive fields recursively inside arrays', () => {
    const input = {
        events: [
            {
                refreshTokenHash: 'secret-hash',
                description: 'Session revoked'
            },
            {
                credentials: {
                    clientSecret: 'secret',
                    email: 'staff@example.com'
                }
            }
        ]
    };

    const result = redactSensitiveValues(input);

    assert.equal(result.events[0].refreshTokenHash, '[REDACTED]');
    assert.equal(result.events[0].description, 'Session revoked');
    assert.equal(result.events[1].credentials.clientSecret, '[REDACTED]');
    assert.equal(result.events[1].credentials.email, 'staff@example.com');
});

test('preserves nulls, primitives and empty values', () => {
    assert.equal(redactSensitiveValues(null), null);
    assert.equal(redactSensitiveValues('ordinary text'), 'ordinary text');
    assert.equal(redactSensitiveValues(0), 0);
    assert.deepEqual(redactSensitiveValues([]), []);
    assert.deepEqual(redactSensitiveValues({}), {});
});


test('redacts token hashes and sensitive naming variations', () => {
    const input = {
        access_token_hash: 'access-hash',
        accessTokenHash: 'access-hash-camel',
        refresh_token_hash: 'refresh-hash',
        passwordResetToken: 'reset-token',
        apiKey: 'api-key',
        clientSecret: 'client-secret',
        ordinaryField: 'keep-this',
        tokenizedDescription: 'must-not-leak'
    };

    const result = redactSensitiveValues(input);

    assert.equal(result.access_token_hash, '[REDACTED]');
    assert.equal(result.accessTokenHash, '[REDACTED]');
    assert.equal(result.refresh_token_hash, '[REDACTED]');
    assert.equal(result.passwordResetToken, '[REDACTED]');
    assert.equal(result.apiKey, '[REDACTED]');
    assert.equal(result.clientSecret, '[REDACTED]');
    assert.equal(result.ordinaryField, 'keep-this');
    assert.equal(result.tokenizedDescription, '[REDACTED]');
});

test('redacts sensitive fields inside nested objects and arrays', () => {
    const input = {
        metadata: {
            credentials: {
                privateKeyFingerprint: 'private-value'
            },
            sessions: [
                { session_id: 'session-value' },
                { card_number: 'card-value' },
                { safeLabel: 'visible' }
            ]
        }
    };

    const result = redactSensitiveValues(input);

    assert.equal(
        result.metadata.credentials.privateKeyFingerprint,
        '[REDACTED]'
    );
    assert.equal(
        result.metadata.sessions[0].session_id,
        '[REDACTED]'
    );
    assert.equal(
        result.metadata.sessions[1].card_number,
        '[REDACTED]'
    );
    assert.equal(result.metadata.sessions[2].safeLabel, 'visible');
});
