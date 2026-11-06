'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const proxyquire = require('proxyquire').noCallThru();
const { Op } = require('sequelize');

const SECRET = 'test-customer-verification-secret';
const CUSTOMER_ID = 20;
const CODE = '123456';
const PASSWORD = 'NewSecurePass123';

process.env.CUSTOMER_VERIFICATION_SECRET = SECRET;

function hashCode(code) {
    return crypto.createHmac('sha256', SECRET).update(code).digest('hex');
}

function createResponse() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.body = data;
            return this;
        },
    };
}

function createVerification(overrides = {}) {
    return {
        id: 10,
        customer_id: CUSTOMER_ID,
        email: 'customer@example.com',
        purpose: 'password_change',
        code_hash: hashCode(CODE),
        attempts: 0,
        expires_at: new Date(Date.now() + 5 * 60 * 1000),
        consumed_at: null,
        update: async function (values) {
            Object.assign(this, values);
            this.updateCalls = (this.updateCalls || 0) + 1;
        },
        ...overrides,
    };
}

function createCustomer(overrides = {}) {
    return {
        id: CUSTOMER_ID,
        email: 'customer@example.com',
        is_active: true,
        password_hash: 'old-password-hash',
        update: async function (values) {
            Object.assign(this, values);
            this.updateCalled = true;
        },
        ...overrides,
    };
}

function loadController(options = {}) {
    const state = {
        verificationFindCalls: [],
        verificationCreateCalls: [],
        verificationUpdateCalls: [],
        customerFindCalls: [],
        sessionUpdateCalls: [],
        bcryptCalls: [],
        emailCalls: [],
        commitCalls: 0,
        rollbackCalls: 0,
        transactionCalls: 0,
    };

    const verification = options.verification === undefined
        ? createVerification()
        : options.verification;

    const customer = options.customer === undefined
        ? createCustomer()
        : options.customer;

    const transaction = {
        LOCK: { UPDATE: 'UPDATE' },
        commit: async () => {
            state.commitCalls += 1;
        },
        rollback: async () => {
            state.rollbackCalls += 1;
        },
    };

    const db = {
        Customer: {
            findByPk: async (...args) => {
                state.customerFindCalls.push(args);

                if (typeof options.findCustomer === 'function') {
                    return options.findCustomer(...args);
                }

                return customer;
            },
        },

        CustomerSession: {
            update: async (...args) => {
                state.sessionUpdateCalls.push(args);

                if (options.sessionUpdateError) {
                    throw new Error('Simulated session revocation failure');
                }

                return [1];
            },
        },

        CustomerEmailVerification: {
            findOne: async (...args) => {
                state.verificationFindCalls.push(args);

                if (typeof options.findVerification === 'function') {
                    return options.findVerification(...args);
                }

                return verification;
            },

            create: async (values, queryOptions) => {
                state.verificationCreateCalls.push(values);
                state.verificationCreateOptions = queryOptions;

                if (options.createError) {
                    throw new Error('Simulated verification creation failure');
                }

                const created = createVerification(values);

                return {
                    ...created,
                    update: async (updateValues) => {
                        Object.assign(created, updateValues);
                        state.verificationUpdateCalls.push(updateValues);
                    },
                };
            },

            update: async (...args) => {
                state.verificationUpdateCalls.push(args);
                return [1];
            },
        },

        sequelize: {
            transaction: async () => {
                state.transactionCalls += 1;
                return transaction;
            },
        },
    };

    const controller = proxyquire(
        '../controllers/customerPasswordChangeController',
        {
            '../models': db,

            'bcryptjs': {
                hash: async (...args) => {
                    state.bcryptCalls.push(args);

                    if (options.bcryptError) {
                        throw new Error('Simulated password hashing failure');
                    }

                    return 'new-mocked-password-hash';
                },
            },

            'sequelize': { Op },

            '../services/emailService': {
                sendVerificationCode: async (...args) => {
                    state.emailCalls.push(args);

                    if (options.emailError) {
                        throw new Error('Simulated email delivery failure');
                    }
                },
            },

            '../services/auditLogService': {
                recordAuditLog: async () => {},
            },
        }
    );

    return {
        controller,
        state,
        verification,
        customer,
    };
}

function createRequest(body = {}, customer = createCustomer()) {
    return {
        body,
        customer,
        ip: '127.0.0.1',
        id: 'security-test-request',
        get(name) {
            return name.toLowerCase() === 'user-agent' ? 'security-test-agent' : undefined;
        },
    };
}

test('changePassword rejects unauthenticated requests', async () => {
    const { controller, state } = loadController();
    const res = createResponse();

    await controller.changePassword(
        createRequest(
            { code: CODE, newPassword: PASSWORD },
            null
        ),
        res
    );

    assert.equal(res.statusCode, 401);
    assert.equal(state.transactionCalls, 0);
});

test('changePassword rejects malformed verification codes', async () => {
    const { controller, state } = loadController();
    const res = createResponse();

    await controller.changePassword(
        createRequest({ code: '12345', newPassword: PASSWORD }),
        res
    );

    assert.equal(res.statusCode, 400);
    assert.equal(state.transactionCalls, 0);
});

test('changePassword rejects passwords exceeding 72 UTF-8 bytes', async () => {
    const { controller, state } = loadController();
    const res = createResponse();

    await controller.changePassword(
        createRequest({
            code: CODE,
            newPassword: 'é'.repeat(37),
        }),
        res
    );

    assert.equal(res.statusCode, 400);
    assert.equal(state.transactionCalls, 0);
});

test('changePassword rejects missing or expired verification codes', async () => {
    const { controller, state } = loadController({
        verification: null,
    });

    const res = createResponse();

    await controller.changePassword(
        createRequest({ code: CODE, newPassword: PASSWORD }),
        res
    );

    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /invalid or expired/i);
    assert.equal(state.rollbackCalls, 1);

    const query = state.verificationFindCalls[0][0];
    assert.equal(query.where.consumed_at, null);
    assert.equal(query.where.purpose, 'password_change');
    assert.ok(query.where.expires_at[Op.gt] instanceof Date);
});

test('changePassword increments attempts for an incorrect code', async () => {
    const verification = createVerification({
        attempts: 2,
    });

    const { controller, state } = loadController({ verification });
    const res = createResponse();

    await controller.changePassword(
        createRequest({ code: '999999', newPassword: PASSWORD }),
        res
    );

    assert.equal(res.statusCode, 400);
    assert.equal(verification.attempts, 3);
    assert.equal(verification.consumed_at, null);
    assert.equal(verification.updateCalls, 1);
    assert.equal(state.commitCalls, 1);
    assert.equal(state.rollbackCalls, 0);
});

test('changePassword consumes the code and returns 429 on the fifth incorrect attempt', async () => {
    const verification = createVerification({
        attempts: 4,
    });

    const { controller, state } = loadController({ verification });
    const res = createResponse();

    await controller.changePassword(
        createRequest({ code: '999999', newPassword: PASSWORD }),
        res
    );

    assert.equal(res.statusCode, 429);
    assert.equal(verification.attempts, 5);
    assert.ok(verification.consumed_at instanceof Date);
    assert.equal(state.commitCalls, 1);
    assert.equal(state.customerFindCalls.length, 0);
    assert.equal(state.sessionUpdateCalls.length, 0);
});

test('changePassword consumes a code that already reached the attempt limit', async () => {
    const verification = createVerification({
        attempts: 5,
    });

    const { controller, state } = loadController({ verification });
    const res = createResponse();

    await controller.changePassword(
        createRequest({ code: CODE, newPassword: PASSWORD }),
        res
    );

    assert.equal(res.statusCode, 429);
    assert.ok(verification.consumed_at instanceof Date);
    assert.equal(state.commitCalls, 1);
    assert.equal(state.customerFindCalls.length, 0);
});

test('changePassword rejects a consumed code when no usable verification exists', async () => {
    const { controller, state } = loadController({
        verification: null,
    });

    const res = createResponse();

    await controller.changePassword(
        createRequest({ code: CODE, newPassword: PASSWORD }),
        res
    );

    assert.equal(res.statusCode, 400);
    assert.equal(state.customerFindCalls.length, 0);
    assert.equal(state.sessionUpdateCalls.length, 0);
});

test('changePassword rejects inactive customers and rolls back', async () => {
    const customer = createCustomer({
        is_active: false,
    });

    const { controller, state } = loadController({ customer });
    const res = createResponse();

    await controller.changePassword(
        createRequest({ code: CODE, newPassword: PASSWORD }),
        res
    );

    assert.equal(res.statusCode, 400);
    assert.equal(state.rollbackCalls, 1);
    assert.equal(state.commitCalls, 0);
    assert.equal(state.sessionUpdateCalls.length, 0);
});

test('changePassword rejects verification codes for a different email address', async () => {
    const verification = createVerification({
        email: 'old@example.com',
    });

    const { controller, state } = loadController({ verification });
    const res = createResponse();

    await controller.changePassword(
        createRequest({ code: CODE, newPassword: PASSWORD }),
        res
    );

    assert.equal(res.statusCode, 400);
    assert.equal(state.rollbackCalls, 1);
    assert.equal(state.sessionUpdateCalls.length, 0);
});

test('changePassword updates the password, consumes the code and revokes all active sessions', async () => {
    const verification = createVerification();
    const customer = createCustomer();

    const { controller, state } = loadController({
        verification,
        customer,
    });

    const res = createResponse();

    await controller.changePassword(
        createRequest({ code: CODE, newPassword: PASSWORD }),
        res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.requiresLogin, true);

    assert.equal(customer.password_hash, 'new-mocked-password-hash');
    assert.equal(customer.updateCalled, true);

    assert.ok(verification.consumed_at instanceof Date);

    assert.equal(state.bcryptCalls.length, 1);
    assert.equal(state.bcryptCalls[0][0], PASSWORD);
    assert.equal(state.bcryptCalls[0][1], 12);

    assert.equal(state.sessionUpdateCalls.length, 1);
    assert.deepEqual(state.sessionUpdateCalls[0][0], {
        revoked_at: state.sessionUpdateCalls[0][0].revoked_at,
    });
    assert.deepEqual(state.sessionUpdateCalls[0][1].where, {
        customer_id: CUSTOMER_ID,
        revoked_at: null,
    });

    assert.equal(state.verificationFindCalls[0][0].lock, 'UPDATE');
    assert.equal(state.customerFindCalls[0][1].lock, 'UPDATE');
    assert.equal(state.commitCalls, 1);
    assert.equal(state.rollbackCalls, 0);
});

test('changePassword rolls back when session revocation fails', async () => {
    const verification = createVerification();
    const customer = createCustomer();

    const { controller, state } = loadController({
        verification,
        customer,
        sessionUpdateError: true,
    });

    const res = createResponse();

    await controller.changePassword(
        createRequest({ code: CODE, newPassword: PASSWORD }),
        res
    );

    assert.equal(res.statusCode, 500);
    assert.equal(state.commitCalls, 0);
    assert.equal(state.rollbackCalls, 1);
});

test('changePassword rolls back when password hashing fails', async () => {
    const { controller, state } = loadController({
        bcryptError: true,
    });

    const res = createResponse();

    await controller.changePassword(
        createRequest({ code: CODE, newPassword: PASSWORD }),
        res
    );

    assert.equal(res.statusCode, 500);
    assert.equal(state.commitCalls, 0);
    assert.equal(state.rollbackCalls, 1);
});

test('requestCode rejects missing or inactive customers', async () => {
    const { controller, state } = loadController();
    const res = createResponse();

    await controller.requestCode(
        createRequest({}, {
            id: CUSTOMER_ID,
            is_active: false,
            email: 'customer@example.com',
        }),
        res
    );

    assert.equal(res.statusCode, 400);
    assert.equal(state.verificationCreateCalls.length, 0);
});

test('requestCode consumes the new verification record if email delivery fails', async () => {
    const { controller, state } = loadController({
        emailError: true,
    });

    const res = createResponse();

    await controller.requestCode(
        createRequest({}, {
            id: CUSTOMER_ID,
            is_active: true,
            email: ' Customer@Example.com ',
        }),
        res
    );

    assert.equal(res.statusCode, 500);
    assert.equal(state.verificationCreateCalls.length, 1);
    assert.equal(state.emailCalls.length, 1);

    assert.equal(
        state.verificationCreateCalls[0].email,
        'customer@example.com'
    );

    assert.equal(
        state.verificationCreateCalls[0].purpose,
        'password_change'
    );

    // First update invalidates previous codes.
    assert.equal(state.verificationUpdateCalls.length, 2);

    assert.ok(
        state.verificationUpdateCalls[0][0].consumed_at instanceof Date
    );

    assert.equal(
        state.verificationUpdateCalls[0][1].where.purpose,
        'password_change'
    );

    // Second update consumes the newly created code after email failure.
    assert.ok(
        state.verificationUpdateCalls[1].consumed_at instanceof Date
    );
});

test('requestCode locks the customer and performs OTP invalidation and creation in one transaction', async () => {
    const { controller, state } = loadController();
    const res = createResponse();

    await controller.requestCode(
        createRequest({}, {
            id: CUSTOMER_ID,
            is_active: true,
            email: ' Customer@Example.com ',
        }),
        res
    );

    assert.equal(res.statusCode, 200);

    const customerLookup = state.customerFindCalls[0];
    assert.equal(customerLookup[0], CUSTOMER_ID);
    assert.equal(customerLookup[1].lock, 'UPDATE');

    const transaction = customerLookup[1].transaction;

    assert.ok(transaction);

    const invalidation = state.verificationUpdateCalls[0];
    assert.equal(invalidation[1].transaction, transaction);
    assert.equal(invalidation[1].where.customer_id, CUSTOMER_ID);
    assert.equal(invalidation[1].where.purpose, 'password_change');

    assert.equal(
        state.verificationCreateOptions.transaction,
        transaction
    );

    assert.equal(state.verificationCreateCalls.length, 1);
    assert.equal(state.emailCalls.length, 1);
    assert.equal(state.commitCalls, 1);
    assert.equal(state.rollbackCalls, 0);
});

test('requestCode rolls back when creating the new verification record fails', async () => {
    const { controller, state } = loadController({
        createError: true,
    });

    const res = createResponse();

    await controller.requestCode(
        createRequest({}, {
            id: CUSTOMER_ID,
            is_active: true,
            email: 'customer@example.com',
        }),
        res
    );

    assert.equal(res.statusCode, 500);
    assert.equal(state.transactionCalls, 1);
    assert.equal(state.commitCalls, 0);
    assert.equal(state.rollbackCalls, 1);

    assert.equal(state.verificationCreateCalls.length, 1);
    assert.equal(state.emailCalls.length, 0);

    const transaction = state.customerFindCalls[0][1].transaction;
    assert.equal(
        state.verificationUpdateCalls[0][1].transaction,
        transaction
    );
});
