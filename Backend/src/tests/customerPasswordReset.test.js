'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const proxyquire = require('proxyquire').noCallThru();
const { Op } = require('sequelize');

function setup({ customerExists = true, emailFailure = false, customerActive = true, emailVerified = true, transactionCommitError = null } = {}) {
    const now = new Date();
    const customer = customerExists ? {
        id: 12,
        email: 'customer@example.com',
        email_verified_at: emailVerified ? now : null,
        is_active: customerActive,
        password_hash: 'old-hash',
        async update(values) { Object.assign(this, values); },
    } : null;
    const tokens = [];
    const emails = [];
    const sessions = [];
    const activeSessions = [{ customer_id: 12, revoked_at: null }];
    let lockTail = Promise.resolve();
    const lockOrder = [];
    let txId = 0;
    function makeTransaction() {
        let releaseLock;
        let snapshot;
        const tx = {
            id: ++txId,
            LOCK: { UPDATE: 'UPDATE' },
            async lockCustomer() {
                lockOrder.push('customer');
                const previous = lockTail;
                lockTail = new Promise(resolve => { releaseLock = resolve; });
                await previous;
                snapshot = {
                    customer: customer && { ...customer },
                    tokens: tokens.map(token => ({ ...token })),
                    tokenCount: tokens.length,
                    activeSessions: activeSessions.map(session => ({ ...session })),
                };
            },
            async commit() {
                if (transactionCommitError) throw transactionCommitError;
                releaseLock?.();
            },
            async rollback() {
                if (snapshot) {
                    if (customer) Object.assign(customer, snapshot.customer);
                    tokens.length = snapshot.tokenCount;
                    snapshot.tokens.forEach((state, index) => Object.assign(tokens[index], state));
                    activeSessions.splice(0, activeSessions.length, ...snapshot.activeSessions);
                }
                releaseLock?.();
            },
        };
        return tx;
    }
    const controller = proxyquire('../controllers/customerAuthController', {
        '../models': {
            Customer: {
                async findOne(options = {}) { if (options.transaction) await options.transaction.lockCustomer(); return customer; },
                async findByPk(id, options = {}) { if (options.transaction && options.lock) await options.transaction.lockCustomer(); return customer?.id === id ? customer : null; },
            },
            CustomerSession: {
                async update(values, options) { sessions.push({ values, options }); activeSessions.filter(session => session.customer_id === options.where.customer_id && session.revoked_at === null).forEach(session => Object.assign(session, values)); },
            },
            CustomerEmailVerification: {},
            CustomerPasswordResetToken: {
                async findOne({ where, transaction, lock }) {
                    if (transaction && lock) lockOrder.push('reset-token');
                    if (where.token_hash) return tokens.find(token => token.token_hash === where.token_hash && (!where.customer_id || token.customer_id === where.customer_id) && !token.used_at && token.expires_at > where.expires_at[Op.gt]) || null;
                    return tokens.filter(token => token.customer_id === where.customer_id && token.created_at > where.created_at[Op.gt]).sort((a, b) => b.created_at - a.created_at)[0] || null;
                },
                async create(values, options) {
                    const record = { ...values, created_at: new Date(), async update(next) { Object.assign(this, next); } };
                    tokens.push(record);
                    return record;
                },
                async update(values, { where, transaction }) {
                    if (transaction) lockOrder.push('reset-token-update');
                    tokens.filter(token => token.customer_id === where.customer_id && (!where.used_at || token.used_at === where.used_at)).forEach(token => Object.assign(token, values));
                },
            },
            sequelize: { async transaction() { return makeTransaction(); } },
        },
        'sequelize': require('sequelize'),
        '../services/emailService': {
            async sendVerificationCode() {},
            async sendCustomerPasswordReset(email, token) {
                emails.push({ email, token });
                if (emailFailure) throw new Error('provider error');
            },
        },
        '../services/auditLogService': { async recordAuditLog() {} },
    });
    const res = {
        statusCode: null,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
    };
    const req = body => ({ body, ip: '127.0.0.1', get() { return 'test'; } });
    return { controller, customer, tokens, emails, sessions, activeSessions, lockOrder, res, req };
}

test('forgot password returns a generic response and stores only a hash before emailing reset link', async () => {
    const ctx = setup();
    await ctx.controller.forgotPassword(ctx.req({ email: ' CUSTOMER@example.com ' }), ctx.res);
    assert.equal(ctx.res.statusCode, 200);
    assert.equal(ctx.res.body.message, 'If an account exists with this email address, you will receive instructions to reset your password.');
    assert.equal(ctx.tokens.length, 1);
    assert.equal(ctx.emails.length, 1);
    const emittedToken = ctx.emails[0].token;
    assert.equal(ctx.tokens[0].token_hash, crypto.createHash('sha256').update(emittedToken).digest('hex'));
    assert.notEqual(ctx.tokens[0].token_hash, ctx.emails[0].token);
    assert.equal(ctx.tokens[0].expires_at - ctx.tokens[0].created_at <= 20 * 60 * 1000, true);
});

test('forgot password gives the same public response for an unknown email', async () => {
    const ctx = setup({ customerExists: false });
    await ctx.controller.forgotPassword(ctx.req({ email: 'missing@example.com' }), ctx.res);
    assert.equal(ctx.res.statusCode, 200);
    assert.equal(ctx.res.body.message, 'If an account exists with this email address, you will receive instructions to reset your password.');
    assert.equal(ctx.tokens.length, 0);
    assert.equal(ctx.emails.length, 0);
});

test('email failure consumes the reset token and keeps generic response', async () => {
    const ctx = setup({ emailFailure: true });
    await ctx.controller.forgotPassword(ctx.req({ email: 'customer@example.com' }), ctx.res);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(ctx.res.statusCode, 200);
    assert.ok(ctx.tokens[0].used_at instanceof Date);
});

test('new reset request invalidates an older token and account cooldown suppresses repeat mail', async () => {
    const ctx = setup();
    await ctx.controller.forgotPassword(ctx.req({ email: 'customer@example.com' }), ctx.res);
    ctx.tokens[0].created_at = new Date(Date.now() - 2 * 60 * 1000);
    const previousRawToken = ctx.emails[0].token;
    await ctx.controller.forgotPassword(ctx.req({ email: 'customer@example.com' }), ctx.res);
    assert.ok(ctx.tokens[0].used_at instanceof Date);
    assert.equal(ctx.tokens.length, 2);
    assert.equal(ctx.emails.length, 2);
    assert.notEqual(ctx.emails[1].token, previousRawToken);

    await ctx.controller.forgotPassword(ctx.req({ email: 'customer@example.com' }), ctx.res);
    assert.equal(ctx.tokens.length, 2);
    assert.equal(ctx.emails.length, 2);
});

test('reset password updates credentials, consumes token and revokes active sessions', async () => {
    const ctx = setup();
    await ctx.controller.forgotPassword(ctx.req({ email: 'customer@example.com' }), ctx.res);
    const token = ctx.emails[0].token;
    const resetResponse = { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await ctx.controller.resetPassword(ctx.req({ token, newPassword: 'NewPassword456' }), resetResponse);
    assert.equal(resetResponse.statusCode, 200);
    assert.notEqual(ctx.customer.password_hash, 'old-hash');
    assert.ok(ctx.tokens[0].used_at instanceof Date);
    assert.equal(ctx.sessions.length, 1);
    assert.equal(ctx.sessions[0].values.revoked_at instanceof Date, true);
});

test('reset password rejects invalid, expired and reused tokens and weak passwords', async () => {
    const ctx = setup();
    const response = { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await ctx.controller.resetPassword(ctx.req({ token: 'bad', newPassword: 'ValidPassword1' }), response);
    assert.equal(response.statusCode, 400);
    await ctx.controller.resetPassword(ctx.req({ token: 'a'.repeat(43), newPassword: 'short' }), response);
    assert.equal(response.statusCode, 400);
    await ctx.controller.forgotPassword(ctx.req({ email: 'customer@example.com' }), ctx.res);
    ctx.tokens[0].expires_at = new Date(Date.now() - 1);
    await ctx.controller.resetPassword(ctx.req({ token: ctx.emails[0].token, newPassword: 'ValidPassword1' }), response);
    assert.equal(response.statusCode, 400);
});

test('a successfully used reset token cannot be used again', async () => {
    const ctx = setup();
    await ctx.controller.forgotPassword(ctx.req({ email: 'customer@example.com' }), ctx.res);
    const token = ctx.emails[0].token;
    const response = { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await ctx.controller.resetPassword(ctx.req({ token, newPassword: 'FirstPassword456' }), response);
    assert.equal(response.statusCode, 200);
    await ctx.controller.resetPassword(ctx.req({ token, newPassword: 'SecondPassword789' }), response);
    assert.equal(response.statusCode, 400);
});

async function createResetToken(ctx) {
    const token = crypto.randomBytes(32).toString('base64url');
    ctx.tokens.push({
        customer_id: 12,
        token_hash: crypto.createHash('sha256').update(token).digest('hex'),
        expires_at: new Date(Date.now() + 20 * 60 * 1000),
        created_at: new Date(),
        used_at: null,
        async update(values) { Object.assign(this, values); },
    });
    return token;
}

function resetResponse() {
    return { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('reset rejects inactive customers without changing credentials or token state', async () => {
    const ctx = setup({ customerActive: false });
    const token = await createResetToken(ctx);
    const response = resetResponse();
    await ctx.controller.resetPassword(ctx.req({ token, newPassword: 'ValidPassword123' }), response);
    assert.equal(response.statusCode, 400);
    assert.equal(ctx.customer.password_hash, 'old-hash');
    assert.equal(ctx.tokens[0].used_at, null);
    assert.equal(ctx.sessions.length, 0);
});

test('reset rejects unverified customers without changing credentials or token state', async () => {
    const ctx = setup({ emailVerified: false });
    const token = await createResetToken(ctx);
    const response = resetResponse();
    await ctx.controller.resetPassword(ctx.req({ token, newPassword: 'ValidPassword123' }), response);
    assert.equal(response.statusCode, 400);
    assert.equal(ctx.customer.password_hash, 'old-hash');
    assert.equal(ctx.tokens[0].used_at, null);
    assert.equal(ctx.sessions.length, 0);
});

test('forgot and reset flows lock customer before reset tokens and revalidate under lock', async () => {
    const ctx = setup();
    await ctx.controller.forgotPassword(ctx.req({ email: 'customer@example.com' }), ctx.res);
    ctx.lockOrder.length = 0;
    const response = resetResponse();
    await ctx.controller.resetPassword(ctx.req({ token: ctx.emails[0].token, newPassword: 'LockedPassword123' }), response);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(ctx.lockOrder.slice(0, 2), ['customer', 'reset-token']);
});

test('concurrent reset attempts using one token allow only one success', async () => {
    const ctx = setup();
    const token = await createResetToken(ctx);
    const first = resetResponse();
    const second = resetResponse();
    await Promise.all([
        ctx.controller.resetPassword(ctx.req({ token, newPassword: 'FirstPassword123' }), first),
        ctx.controller.resetPassword(ctx.req({ token, newPassword: 'SecondPassword123' }), second),
    ]);
    assert.deepEqual([first.statusCode, second.statusCode].sort(), [200, 400]);
    assert.ok(ctx.tokens[0].used_at instanceof Date);
    assert.equal(ctx.sessions.length, 1);
});

test('transaction commit failure rolls back password, token and session changes', async () => {
    const ctx = setup({ transactionCommitError: new Error('commit failed') });
    const token = await createResetToken(ctx);
    const response = resetResponse();
    await ctx.controller.resetPassword(ctx.req({ token, newPassword: 'RolledBackPassword123' }), response);
    assert.equal(response.statusCode, 500);
    assert.equal(ctx.customer.password_hash, 'old-hash');
    assert.equal(ctx.tokens[0].used_at, null);
    assert.equal(ctx.activeSessions[0].revoked_at, null);
});
