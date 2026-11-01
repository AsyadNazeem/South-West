'use strict';

const test = require('node:test');
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

function createRequest(body = {}) {
    return {
        body,
        ip: '127.0.0.1',
        id: 'customer-auth-security-test',
        get() {
            return 'customer-auth-security-test';
        }
    };
}

function loadController({
    customers = [],
    emailError = null
} = {}) {
    process.env.CUSTOMER_VERIFICATION_SECRET =
        'customer-verification-test-secret';

    const verificationCalls = {
        invalidatedPrevious: [],
        created: [],
        consumedAfterFailure: []
    };

    const controller = proxyquire(
        '../controllers/customerAuthController',
        {
            '../models': {
                Customer: {
                    async findAll() {
                        return customers;
                    }
                },
                CustomerEmailVerification: {
                    async update(values, options) {
                        verificationCalls.invalidatedPrevious.push({
                            values,
                            options
                        });
                    },
                    async create(values) {
                        verificationCalls.created.push(values);

                        return {
                            async update(values) {
                                verificationCalls.consumedAfterFailure.push(
                                    values
                                );
                            }
                        };
                    }
                },
                CustomerSession: {},
                sequelize: {}
            },
            '../services/emailService': {
                async sendVerificationCode() {
                    if (emailError) {
                        throw emailError;
                    }
                }
            },
            '../services/auditLogService': {
                async recordAuditLog() {}
            }
        }
    );

    return { controller, verificationCalls };
}

const eligibleCustomer = {
    id: 42,
    customer_code: 'SW-CUS-0042',
    email: 'customer@example.com',
    is_active: true,
    password_hash: null,
    email_verified_at: null
};

test('activation returns the same public response for an ineligible account', async () => {
    const { controller } = loadController({
        customers: []
    });

    const res = createResponse();

    await controller.activate(
        createRequest({
            customer_code: 'SW-CUS-9999',
            email: 'unknown@example.com'
        }),
        res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(
        res.body.message,
        'If the account is eligible, a verification code has been sent to its registered email.'
    );
});

test('activation returns the same public response for an eligible account', async () => {
    const { controller } = loadController({
        customers: [eligibleCustomer]
    });

    const res = createResponse();

    await controller.activate(
        createRequest({
            customer_code: eligibleCustomer.customer_code,
            email: eligibleCustomer.email
        }),
        res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(
        res.body.message,
        'If the account is eligible, a verification code has been sent to its registered email.'
    );
});

test('failed verification email delivery consumes the newly created code', async () => {
    const { controller, verificationCalls } = loadController({
        customers: [eligibleCustomer],
        emailError: new Error('Simulated email delivery failure')
    });

    const res = createResponse();

    await controller.activate(
        createRequest({
            customer_code: eligibleCustomer.customer_code,
            email: eligibleCustomer.email
        }),
        res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(
        res.body.message,
        'If the account is eligible, a verification code has been sent to its registered email.'
    );
    assert.equal(verificationCalls.created.length, 1);

    assert.deepEqual(
        verificationCalls.consumedAfterFailure,
        [{ consumed_at: verificationCalls.consumedAfterFailure[0]?.consumed_at }]
    );

    assert.ok(
        verificationCalls.consumedAfterFailure[0]?.consumed_at instanceof Date
    );
});
