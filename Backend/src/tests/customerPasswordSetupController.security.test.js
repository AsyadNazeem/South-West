'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();

const TOKEN = 'a'.repeat(64);
const PASSWORD = 'SecurePass123';

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

function createSetupToken(overrides = {}) {
    return {
        id: 10,
        customer_id: 20,
        token_hash: `hashed:${TOKEN}`,
        expires_at: new Date(Date.now() + 5 * 60 * 1000),
        used_at: null,
        save: async function () {
            this.saveCalled = true;
        },
        ...overrides,
    };
}

function createCustomer(overrides = {}) {
    return {
        id: 20,
        customer_code: 'CUS-00020',
        password_hash: null,
        email_verified_at: null,
        save: async function () {
            this.saveCalled = true;
        },
        ...overrides,
    };
}

function loadController(options = {}) {
    const state = {
        findOneCalls: [],
        findByPkCalls: [],
        tokenUpdateCalls: [],
        transactionCalls: 0,
        commitCalls: 0,
        rollbackCalls: 0,
        bcryptCalls: [],
    };

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
                state.findByPkCalls.push(args);
                return options.customer === undefined
                    ? createCustomer()
                    : options.customer;
            },
        },
        CustomerPasswordSetupToken: {
            findOne: async (query) => {
                state.findOneCalls.push(query);

                if (typeof options.findOne === 'function') {
                    return options.findOne(query);
                }

                return options.setupToken === undefined
                    ? createSetupToken()
                    : options.setupToken;
            },
            update: async (...args) => {
                state.tokenUpdateCalls.push(args);
                return [1];
            },
        },
        sequelize: {
            transaction: async (callback) => {
                state.transactionCalls += 1;

                if (typeof callback === 'function') {
                    try {
                        const result = await callback(transaction);
                        state.commitCalls += 1;
                        return result;
                    } catch (error) {
                        state.rollbackCalls += 1;
                        throw error;
                    }
                }

                return transaction;
            },
        },
    };

    const controller = proxyquire(
        '../controllers/customerPasswordSetupController',
        {
            bcryptjs: {
                hash: async (...args) => {
                    state.bcryptCalls.push(args);
                    return 'mocked-password-hash';
                },
            },
            '../models': db,
            '../services/customerPasswordSetupService': {
                hashToken: (token) => `hashed:${token}`,
                TOKEN_EXPIRY_MINUTES: 10,
            },
        }
    );

    return { controller, state };
}

test('validatePasswordSetup rejects malformed tokens without querying the database', async () => {
    const { controller, state } = loadController();
    const req = { body: { token: 'short-token' } };
    const res = createResponse();

    await controller.validatePasswordSetup(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(
        res.body.message,
        'This password setup link is invalid or expired.'
    );
    assert.equal(state.findOneCalls.length, 0);
});

test('validatePasswordSetup rejects expired invitations', async () => {
    const { controller } = loadController({
        setupToken: createSetupToken({
            expires_at: new Date(Date.now() - 1000),
            customer: createCustomer(),
        }),
    });

    const res = createResponse();

    await controller.validatePasswordSetup(
        { body: { token: TOKEN } },
        res
    );

    assert.equal(res.statusCode, 400);
    assert.equal(
        res.body.message,
        'This password setup link is invalid or expired.'
    );
});

test('validatePasswordSetup rejects customers who already have a password', async () => {
    const { controller } = loadController({
        setupToken: createSetupToken({
            customer: createCustomer({
                password_hash: 'existing-password-hash',
            }),
        }),
    });

    const res = createResponse();

    await controller.validatePasswordSetup(
        { body: { token: TOKEN } },
        res
    );

    assert.equal(res.statusCode, 400);
});

test('validatePasswordSetup accepts a valid invitation', async () => {
    const { controller, state } = loadController({
        setupToken: createSetupToken({
            customer: createCustomer(),
        }),
    });

    const res = createResponse();

    await controller.validatePasswordSetup(
        { body: { token: TOKEN } },
        res
    );

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
        valid: true,
        customerCode: 'CUS-00020',
        expiresInMinutes: 10,
    });

    assert.equal(state.findOneCalls.length, 1);
    assert.equal(
        state.findOneCalls[0].where.token_hash,
        `hashed:${TOKEN}`
    );
    assert.equal(state.findOneCalls[0].where.used_at, null);
    assert.equal(state.findOneCalls[0].include[0].required, true);
    assert.equal(state.findOneCalls[0].include[0].as, 'customer');
});

test('setCustomerPassword rejects passwords exceeding 72 UTF-8 bytes', async () => {
    const { controller, state } = loadController();
    const res = createResponse();

    await controller.setCustomerPassword(
        {
            body: {
                token: TOKEN,
                password: 'é'.repeat(37),
                confirmPassword: 'é'.repeat(37),
            },
        },
        res
    );

    assert.equal(res.statusCode, 400);
    assert.equal(state.transactionCalls, 0);
    assert.equal(state.bcryptCalls.length, 0);
});

test('setCustomerPassword rejects mismatched passwords', async () => {
    const { controller, state } = loadController();
    const res = createResponse();

    await controller.setCustomerPassword(
        {
            body: {
                token: TOKEN,
                password: PASSWORD,
                confirmPassword: 'DifferentPass123',
            },
        },
        res
    );

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, 'Passwords do not match.');
    assert.equal(state.transactionCalls, 0);
});

test('setCustomerPassword rejects expired invitations', async () => {
    const { controller, state } = loadController({
        setupToken: createSetupToken({
            expires_at: new Date(Date.now() - 1000),
        }),
    });

    const res = createResponse();

    await controller.setCustomerPassword(
        {
            body: {
                token: TOKEN,
                password: PASSWORD,
                confirmPassword: PASSWORD,
            },
        },
        res
    );

    assert.equal(res.statusCode, 400);
    assert.equal(state.findByPkCalls.length, 0);
    assert.equal(state.tokenUpdateCalls.length, 0);
});

test('setCustomerPassword rejects invitations for customers who already have a password', async () => {
    const { controller, state } = loadController({
        customer: createCustomer({
            password_hash: 'existing-password-hash',
        }),
    });

    const res = createResponse();

    await controller.setCustomerPassword(
        {
            body: {
                token: TOKEN,
                password: PASSWORD,
                confirmPassword: PASSWORD,
            },
        },
        res
    );

    assert.equal(res.statusCode, 400);
    assert.equal(state.tokenUpdateCalls.length, 0);
});

test('setCustomerPassword saves the password, consumes the token and invalidates other invitations', async () => {
    const setupToken = createSetupToken();
    const customer = createCustomer();

    const { controller, state } = loadController({
        setupToken,
        customer,
    });

    const res = createResponse();

    await controller.setCustomerPassword(
        {
            body: {
                token: TOKEN,
                password: PASSWORD,
                confirmPassword: PASSWORD,
            },
        },
        res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(
        res.body.message,
        'Password created successfully. You can now log in.'
    );

    assert.equal(customer.password_hash, 'mocked-password-hash');
    assert.ok(customer.email_verified_at instanceof Date);
    assert.equal(customer.saveCalled, true);

    assert.ok(setupToken.used_at instanceof Date);
    assert.equal(setupToken.saveCalled, true);

    assert.equal(state.bcryptCalls.length, 1);
    assert.equal(state.bcryptCalls[0][0], PASSWORD);
    assert.equal(state.bcryptCalls[0][1], 12);

    assert.equal(state.findOneCalls[0].lock, 'UPDATE');
    assert.equal(state.findOneCalls[0].transaction.LOCK.UPDATE, 'UPDATE');
    assert.equal(state.findByPkCalls[0][1].lock, 'UPDATE');

    assert.equal(state.tokenUpdateCalls.length, 1);
    assert.deepEqual(state.tokenUpdateCalls[0][0], {
        used_at: state.tokenUpdateCalls[0][0].used_at,
    });
    assert.deepEqual(state.tokenUpdateCalls[0][1].where, {
        customer_id: customer.id,
        used_at: null,
    });
});

test('setCustomerPassword does not overwrite an existing email verification date', async () => {
    const existingVerificationDate = new Date('2026-01-01T00:00:00.000Z');
    const customer = createCustomer({
        email_verified_at: existingVerificationDate,
    });

    const { controller } = loadController({
        customer,
        setupToken: createSetupToken(),
    });

    const res = createResponse();

    await controller.setCustomerPassword(
        {
            body: {
                token: TOKEN,
                password: PASSWORD,
                confirmPassword: PASSWORD,
            },
        },
        res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(customer.email_verified_at, existingVerificationDate);
});

test('setCustomerPassword rejects a token that has already been used', async () => {
    const { controller, state } = loadController({
        setupToken: null,
    });

    const res = createResponse();

    await controller.setCustomerPassword(
        {
            body: {
                token: TOKEN,
                password: PASSWORD,
                confirmPassword: PASSWORD,
            },
        },
        res
    );

    assert.equal(res.statusCode, 400);
    assert.equal(state.findByPkCalls.length, 0);
    assert.equal(state.tokenUpdateCalls.length, 0);
});


test('setCustomerPassword rolls back when saving the customer fails', async () => {
    const customer = createCustomer({
        save: async () => {
            throw new Error('Simulated customer save failure');
        },
    });

    const setupToken = createSetupToken();

    const { controller, state } = loadController({
        customer,
        setupToken,
    });

    const res = createResponse();

    await controller.setCustomerPassword(
        {
            body: {
                token: TOKEN,
                password: PASSWORD,
                confirmPassword: PASSWORD,
            },
        },
        res
    );

    assert.equal(res.statusCode, 500);
    assert.equal(
        res.body.message,
        'Unable to set your password. Please try again.'
    );

    assert.equal(state.transactionCalls, 1);
    assert.equal(state.commitCalls, 0);
    assert.equal(state.rollbackCalls, 1);
    assert.equal(setupToken.saveCalled, undefined);
    assert.equal(state.tokenUpdateCalls.length, 0);
});
