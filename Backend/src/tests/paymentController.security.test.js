'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();

const state = {
    transactionCalls: 0,
    paymentCreateCalls: 0,
    paymentUpdateCalls: 0,
    rollbackCalls: 0
};

function resetState() {
    state.transactionCalls = 0;
    state.paymentCreateCalls = 0;
    state.paymentUpdateCalls = 0;
    state.rollbackCalls = 0;
}

const transaction = {
    LOCK: { UPDATE: 'UPDATE' },
    finished: undefined,

    async rollback() {
        state.rollbackCalls += 1;
        this.finished = 'rollback';
    },

    async commit() {
        this.finished = 'commit';
    }
};

const models = {
    Payment: {
        sequelize: {
            async transaction() {
                state.transactionCalls += 1;
                transaction.finished = undefined;
                return transaction;
            }
        },

        async create() {
            state.paymentCreateCalls += 1;
            throw new Error('Payment must not be created');
        },

        async findByPk() {
            throw new Error('Payment must not be updated');
        },

        async findOne() {
            return null;
        }
    },

    Order: {
        async findByPk() {
            return { id: 1 };
        }
    },

    User: {}
};

const controller = proxyquire(
    '../controllers/paymentController',
    {
        '../models': models,
        '../services/auditLogService': {
            async recordAuditLog() {}
        }
    }
);

function makeResponse() {
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

test('createPayment rejects invalid payment amount before creating a payment', async () => {
    resetState();

    const req = {
        body: {
            payment_reference: 'SECURITY-TEST-001',
            order_id: 1,
            payment_method: 'cash',
            amount: -100,
            payment_status: 'paid'
        },
        user: { id: 1 }
    };

    const res = makeResponse();

    await controller.createPayment(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(state.paymentCreateCalls, 0);
    assert.equal(state.transactionCalls, 0);
});

test('createPayment rejects an invalid payment method', async () => {
    resetState();

    const req = {
        body: {
            payment_reference: 'SECURITY-TEST-002',
            order_id: 1,
            payment_method: 'bitcoin',
            amount: 100,
            payment_status: 'paid'
        },
        user: { id: 1 }
    };

    const res = makeResponse();

    await controller.createPayment(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(state.paymentCreateCalls, 0);
    assert.equal(state.transactionCalls, 0);
});

test('createPayment rejects client-supplied paid status', async () => {
    resetState();

    const req = {
        body: {
            payment_reference: 'SECURITY-PAID-001',
            order_id: 1,
            payment_method: 'card',
            amount: 100,
            payment_status: 'paid'
        },
        user: { id: 1 }
    };

    const res = makeResponse();

    await controller.createPayment(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(state.paymentCreateCalls, 0);
    assert.equal(state.transactionCalls, 0);
});


test('updatePayment rejects client-supplied paid status', async () => {
    resetState();

    const req = {
        params: { id: '1' },
        body: { payment_status: 'paid' },
        user: { id: 1 }
    };

    const res = makeResponse();

    await controller.updatePayment(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(state.transactionCalls, 0);
    assert.equal(state.paymentUpdateCalls, 0);
});

test('updatePayment rejects client-supplied payment amount changes', async () => {
    resetState();

    const req = {
        params: { id: '1' },
        body: { amount: 1 },
        user: { id: 1 }
    };

    const res = makeResponse();

    await controller.updatePayment(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(state.transactionCalls, 0);
    assert.equal(state.paymentUpdateCalls, 0);
});


test('updatePaymentStatus rejects client-supplied paid status', async () => {
    resetState();

    const req = {
        params: { id: '1' },
        body: { payment_status: 'paid' },
        user: { id: 1 },
        ip: '127.0.0.1',
        get() {
            return 'security-test';
        }
    };

    const res = makeResponse();

    await controller.updatePaymentStatus(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(state.transactionCalls, 0);
    assert.equal(state.rollbackCalls, 0);
});
