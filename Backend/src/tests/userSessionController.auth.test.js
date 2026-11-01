'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();

test('Admin session revocation: revokes once and records the audit atomically', async () => {
    const calls = {
        sessionLookup: 0,
        sessionUpdate: 0,
        transaction: 0,
        audit: 0
    };

    const session = {
        id: 55,
        user_id: 20,
        revoked_at: null,

        async update(values, options = {}) {
            calls.sessionUpdate++;
            this.revoked_at = values.revoked_at;
            this.lastUpdateTransaction = options.transaction || null;
        }
    };

    const transaction = {
        LOCK: { UPDATE: 'UPDATE' }
    };

    const controller = proxyquire(
        '../controllers/userSessionController',
        {
            '../models': {
                User: {
                    async findByPk() {
                        return {
                            id: 1,
                            roles: [{ name: 'Admin' }]
                        };
                    }
                },
                UserSession: {
                    async findByPk() {
                        calls.sessionLookup++;
                        return session;
                    }
                },
                Role: {},
                sequelize: {
                    async transaction(callback) {
                        calls.transaction++;
                        return callback(transaction);
                    }
                }
            },
            '../services/auditLogService': {
                async recordAuditLog() {
                    calls.audit++;
                }
            }
        }
    );

    const req = {
        params: { id: '55' },
        user: { id: 1 },
        permissions: new Set(['user_sessions.revoke']),
        ip: '127.0.0.1',
        id: 'auth-test-001',
        get() {
            return 'authentication-test';
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

    await controller.revokeUserSession(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.message, 'Session revoked successfully');
    assert.ok(session.revoked_at instanceof Date);
    assert.equal(calls.transaction, 1);
    assert.equal(calls.sessionUpdate, 1);
    assert.equal(calls.audit, 1);
    assert.equal(session.lastUpdateTransaction, transaction);
});
