'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

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

function createRequest(body) {
    return {
        body,
        headers: {},
        ip: '127.0.0.1',
        id: 'login-test-001',
        get() {
            return 'authentication-test';
        }
    };
}

function loadAdminController(login) {
    return proxyquire('../controllers/authController', {
        '../services/authService': { login },
        '../services/auditLogService': {
            async recordAuditLog() {}
        }
    });
}

function loadCustomerController({
    customer,
    customers,
    passwordMatches = true,
    sessionError = null,
    onSessionCreate = null
}) {
    const secret = 'customer-login-test-secret-at-least-32-characters';

    process.env.CUSTOMER_JWT_SECRET = secret;

    const sessionCalls = [];

    const controller = proxyquire(
        '../controllers/customerAuthController',
        {
            '../models': {
                Customer: {
                    async findAll() {
                        return customers || (customer ? [customer] : []);
                    }
                },
                CustomerSession: {
                    async create(values) {
                        sessionCalls.push(values);

                        if (sessionError) {
                            throw sessionError;
                        }

                        if (onSessionCreate) {
                            await onSessionCreate(values);
                        }
                    }
                },
                CustomerEmailVerification: {},
                sequelize: {}
            },
            '../services/emailService': {
                async sendVerificationCode() {}
            },
            '../services/auditLogService': {
                async recordAuditLog() {}
            },
            'bcryptjs': {
                async compare() {
                    return passwordMatches;
                }
            }
        }
    );

    return { controller, sessionCalls, secret };
}

// ADMIN LOGIN TESTS

test('Admin login: rejects missing credentials', async () => {
    let serviceCalled = false;

    const controller = loadAdminController(async () => {
        serviceCalled = true;
    });

    const res = createResponse();

    await controller.login(createRequest({ email: '', password: '' }), res);

    assert.equal(res.statusCode, 400);
    assert.equal(serviceCalled, false);
});

test('Admin login: normalises email and accepts valid credentials', async () => {
    let receivedEmail;
    let receivedPassword;

    const controller = loadAdminController(async (email, password) => {
        receivedEmail = email;
        receivedPassword = password;

        return {
            token: 'test-admin-token',
            user: { id: 10, email: 'admin@example.com' }
        };
    });

    const res = createResponse();

    await controller.login(
        createRequest({
            email: '  ADMIN@EXAMPLE.COM ',
            password: 'CorrectPassword123'
        }),
        res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(receivedEmail, 'admin@example.com');
    assert.equal(receivedPassword, 'CorrectPassword123');
    assert.equal(res.body.data.token, 'test-admin-token');
});

test('Admin login: rejects passwords exceeding 72 UTF-8 bytes', async () => {
    let serviceCalled = false;

    const controller = loadAdminController(async () => {
        serviceCalled = true;
    });

    const res = createResponse();

    await controller.login(
        createRequest({
            email: 'admin@example.com',
            password: 'é'.repeat(37)
        }),
        res
    );

    assert.equal(res.statusCode, 401);
    assert.equal(serviceCalled, false);
});

test('Admin login: returns generic 401 for invalid credentials', async () => {
    const controller = loadAdminController(async () => {
        throw new Error('Invalid email or password');
    });

    const res = createResponse();

    await controller.login(
        createRequest({
            email: 'admin@example.com',
            password: 'WrongPassword123'
        }),
        res
    );

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.message, 'Invalid email or password');
});

test('Admin login: hides unexpected internal errors', async () => {
    const controller = loadAdminController(async () => {
        throw new Error('Sensitive database connection details');
    });

    const res = createResponse();

    await controller.login(
        createRequest({
            email: 'admin@example.com',
            password: 'CorrectPassword123'
        }),
        res
    );

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.message, 'Unable to log in');
    assert.equal(
        JSON.stringify(res.body).includes('Sensitive database'),
        false
    );
});

// CUSTOMER LOGIN TESTS

const verifiedCustomer = () => ({
    id: 25,
    email: 'customer@example.com',
    phone: '+94771234567',
    password_hash: 'mock-password-hash',
    is_active: true,
    email_verified_at: new Date(),
    phone_verified_at: new Date(),

    toJSON() {
        return {
            id: this.id,
            email: this.email,
            phone: this.phone,
            password_hash: this.password_hash,
            is_active: this.is_active
        };
    }
});

test('Customer login: rejects missing credentials', async () => {
    const { controller, sessionCalls } = loadCustomerController({
        customer: verifiedCustomer()
    });

    const res = createResponse();

    await controller.login(
        createRequest({ identifier: '', password: '' }),
        res
    );

    assert.equal(res.statusCode, 400);
    assert.equal(sessionCalls.length, 0);
});

test('Customer login: accepts verified customer and creates hashed-token session', async () => {
    const customer = verifiedCustomer();

    const { controller, sessionCalls, secret } = loadCustomerController({
        customer
    });

    const res = createResponse();

    await controller.login(
        createRequest({
            identifier: ' CUSTOMER@EXAMPLE.COM ',
            password: 'CorrectPassword123'
        }),
        res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.message, 'Login successful.');
    assert.ok(res.body.token);

    assert.equal(sessionCalls.length, 1);

    const savedSession = sessionCalls[0];

    assert.equal(savedSession.customer_id, customer.id);
    assert.equal(savedSession.revoked_at, null);
    assert.equal(savedSession.token_hash.length, 64);

    assert.equal(
        savedSession.token_hash,
        crypto.createHash('sha256')
            .update(res.body.token)
            .digest('hex')
    );

    const decoded = jwt.verify(res.body.token, secret, {
        algorithms: ['HS256'],
        issuer: 'south-west-api',
        audience: 'south-west-customers'
    });

    assert.equal(decoded.customerId, customer.id);
    assert.equal(decoded.type, 'customer');
    assert.equal(decoded.sessionId, savedSession.session_uuid);

    assert.equal(res.body.customer.password_hash, undefined);
    assert.equal(
        JSON.stringify(res.body).includes('mock-password-hash'),
        false
    );
});

test('Customer login: rejects inactive customer without creating a session', async () => {
    const customer = verifiedCustomer();
    customer.is_active = false;

    const { controller, sessionCalls } = loadCustomerController({ customer });
    const res = createResponse();

    await controller.login(
        createRequest({
            identifier: customer.email,
            password: 'CorrectPassword123'
        }),
        res
    );

    assert.equal(res.statusCode, 401);
    assert.equal(sessionCalls.length, 0);
});

test('Customer login: rejects customer with unverified email', async () => {
    const customer = verifiedCustomer();
    customer.email_verified_at = null;

    const { controller, sessionCalls } = loadCustomerController({ customer });
    const res = createResponse();

    await controller.login(
        createRequest({
            identifier: customer.email,
            password: 'CorrectPassword123'
        }),
        res
    );

    assert.equal(res.statusCode, 401);
    assert.equal(sessionCalls.length, 0);
});

test('Customer login: rejects unverified phone login', async () => {
    const customer = verifiedCustomer();
    customer.phone_verified_at = null;

    const { controller, sessionCalls } = loadCustomerController({ customer });
    const res = createResponse();

    await controller.login(
        createRequest({
            identifier: customer.phone,
            password: 'CorrectPassword123'
        }),
        res
    );

    assert.equal(res.statusCode, 401);
    assert.match(res.body.message, /Verify your phone number/);
    assert.equal(sessionCalls.length, 0);
});

test('Customer login: rejects incorrect password without creating a session', async () => {
    const customer = verifiedCustomer();

    const { controller, sessionCalls } = loadCustomerController({
        customer,
        passwordMatches: false
    });

    const res = createResponse();

    await controller.login(
        createRequest({
            identifier: customer.email,
            password: 'WrongPassword123'
        }),
        res
    );

    assert.equal(res.statusCode, 401);
    assert.equal(sessionCalls.length, 0);
});

test('Customer login: returns generic error when session creation fails', async () => {
    const customer = verifiedCustomer();

    const { controller } = loadCustomerController({
        customer,
        sessionError: new Error('Sensitive database failure')
    });

    const res = createResponse();

    await controller.login(
        createRequest({
            identifier: customer.email,
            password: 'CorrectPassword123'
        }),
        res
    );

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.message, 'Unable to log in.');
    assert.equal(
        JSON.stringify(res.body).includes('Sensitive database'),
        false
    );
});
