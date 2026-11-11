'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();

function setup(initialCodes = []) {
    process.env.CUSTOMER_VERIFICATION_SECRET = 'customer-registration-test-secret';
    const customer = { id: 9, email: 'pending@example.test', is_active: true, password_hash: 'hash', email_verified_at: null };
    const codes = [...initialCodes];
    const delivered = [];
    let lockTail = Promise.resolve();
    const controller = proxyquire('../controllers/customerAuthController', {
        '../models': {
            Customer: {
                async findAll() { return [customer]; },
                async findByPk(id, { transaction, lock }) {
                    assert.equal(lock, transaction.LOCK.UPDATE);
                    await transaction.lockCustomer();
                    return id === customer.id ? customer : null;
                },
            },
            CustomerSession: {},
            CustomerEmailVerification: {
                async findOne({ where }) {
                    return codes.filter(code => code.customer_id === where.customer_id && code.purpose === where.purpose)
                        .sort((a, b) => b.created_at - a.created_at)[0] || null;
                },
                async update(values, { where }) {
                    codes.filter(code => code.customer_id === where.customer_id && code.purpose === where.purpose && code.consumed_at === null)
                        .forEach(code => Object.assign(code, values));
                },
                async create(values) {
                    const code = { ...values, created_at: new Date(), async update(next) { Object.assign(this, next); } };
                    codes.push(code);
                    return code;
                },
            },
            CustomerPasswordResetToken: {},
            sequelize: {
                async transaction() {
                    let release;
                    return {
                        LOCK: { UPDATE: 'UPDATE' },
                        async lockCustomer() {
                            const previous = lockTail;
                            lockTail = new Promise(resolve => { release = resolve; });
                            await previous;
                        },
                        async commit() { release?.(); },
                        async rollback() { release?.(); },
                    };
                },
            },
        },
        'sequelize': require('sequelize'),
        '../services/emailService': {
            async sendVerificationCode(email, code, purpose) { delivered.push({ email, code, purpose }); },
            async sendCustomerPasswordReset() {},
        },
        '../services/auditLogService': { async recordAuditLog() {} },
    });
    const response = () => ({ statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
    const request = () => ({ body: { email: customer.email }, ip: '127.0.0.1', get() { return 'test'; } });
    return { controller, codes, delivered, response, request };
}

test('consumed and expired latest registration OTP still enforces the 60-second cooldown', async () => {
    const ctx = setup([{ customer_id: 9, purpose: 'registration', created_at: new Date(), expires_at: new Date(Date.now() - 1000), consumed_at: new Date() }]);
    const response = ctx.response();
    await ctx.controller.resendRegistrationCode(ctx.request(), response);
    assert.equal(response.statusCode, 200);
    assert.equal(ctx.codes.length, 1);
    assert.equal(ctx.delivered.length, 0);
    assert.match(response.body.message, /If registration is pending/);
});

test('concurrent registration OTP resend requests issue at most one code', async () => {
    const ctx = setup();
    const first = ctx.response();
    const second = ctx.response();
    await Promise.all([
        ctx.controller.resendRegistrationCode(ctx.request(), first),
        ctx.controller.resendRegistrationCode(ctx.request(), second),
    ]);
    assert.equal(ctx.codes.length, 1);
    assert.equal(ctx.delivered.length, 1);
    assert.equal(first.body.message, second.body.message);
});

test('registration OTP can be resent after the latest code is older than cooldown', async () => {
    const ctx = setup([{ customer_id: 9, purpose: 'registration', created_at: new Date(Date.now() - 61_000), expires_at: new Date(Date.now() - 1), consumed_at: new Date() }]);
    await ctx.controller.resendRegistrationCode(ctx.request(), ctx.response());
    assert.equal(ctx.codes.length, 2);
    assert.equal(ctx.delivered.length, 1);
});
