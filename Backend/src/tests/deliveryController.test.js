'use strict';

const { test, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();

const state = {};

function resetState(overrides = {}) {
    Object.assign(state, {
        status: 'pending',
        trackingNumber: null,
        courierName: null,
        dispatchedAt: null,
        deliveredAt: null,
        updateCalls: [],
        historyCalls: [],
        auditCalls: [],
        emailCalls: [],
        commitCalls: 0,
        rollbackCalls: 0,
        emailError: null,
        customerEmail: 'test@example.com',
        orderExists: true,
        deliveryExists: true,
        ...overrides
    });
}

function makeDelivery() {
    const delivery = {
        id: 99,
        delivery_reference: 'TEST-DELIVERY-99',
        order_id: 501,
        delivery_method: 'courier',
        delivery_status: state.status,
        tracking_number: state.trackingNumber,
        courier_name: state.courierName,
        expected_delivery_date: null,
        dispatched_at: state.dispatchedAt,
        delivered_at: state.deliveredAt,
        delivery_charge: '0.00',

        async update(changes) {
            state.updateCalls.push({ ...changes });
            Object.assign(this, changes);
            state.status = this.delivery_status;
            state.trackingNumber = this.tracking_number;
            state.courierName = this.courier_name;
            state.dispatchedAt = this.dispatched_at;
            state.deliveredAt = this.delivered_at;
            return this;
        }
    };

    return delivery;
}

let delivery;

const models = {
    sequelize: {
        async transaction() {
            return {
                LOCK: { UPDATE: 'UPDATE' },
                async commit() {
                    state.commitCalls += 1;
                },
                async rollback() {
                    state.rollbackCalls += 1;
                }
            };
        }
    },

    Delivery: {
        async findByPk() {
            return state.deliveryExists ? delivery : null;
        },
        async findOne() {
            return null;
        }
    },

    Order: {
        async findByPk() {
            if (!state.orderExists) return null;

            return {
                id: 501,
                order_number: 'TEST-ORDER-501',
                customer: {
                    id: 7,
                    first_name: 'Test',
                    last_name: 'Customer',
                    email: state.customerEmail
                }
            };
        }
    },

    Customer: {},

    DeliveryStatusHistory: {
        async create(values) {
            state.historyCalls.push(values);
            return values;
        }
    }
};

const auditService = {
    async recordAuditLog(values) {
        state.auditCalls.push(values);
    }
};

const emailService = {
    async sendDeliveryTrackingEmail(payload) {
        state.emailCalls.push(payload);
        if (state.emailError) throw state.emailError;
    }
};

const controller = proxyquire('../controllers/deliveryController', {
    '../models': models,
    '../services/auditLogService': auditService,
    '../services/emailService': emailService
});

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

function makeRequest(body = {}) {
    return {
        params: { id: '99' },
        body,
        user: { id: 42 },
        ip: '127.0.0.1',
        id: 'delivery-test',
        get(name) {
            return name === 'user-agent' ? 'node-test' : undefined;
        }
    };
}

beforeEach(() => {
    resetState();
    delivery = makeDelivery();
});

test('dispatch rejects missing tracking number or courier', async () => {
    const res = makeResponse();

    await controller.updateDelivery(
        makeRequest({ delivery_status: 'dispatched' }),
        res
    );

    assert.equal(res.statusCode, 400);
    assert.equal(state.commitCalls, 0);
    assert.equal(state.rollbackCalls, 1);
    assert.equal(state.updateCalls.length, 0);
    assert.equal(state.emailCalls.length, 0);
    assert.equal(state.historyCalls.length, 0);
});

test('valid dispatch saves details, creates history and sends tracking email', async () => {
    const res = makeResponse();

    await controller.updateDelivery(
        makeRequest({
            delivery_status: 'dispatched',
            tracking_number: '  TEST-TRACK-99  ',
            courier_name: '  Test Courier  ',
            status_notes: 'Handed to test courier'
        }),
        res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.tracking_email_status, 'sent');
    assert.equal(state.commitCalls, 1);
    assert.equal(state.rollbackCalls, 0);

    assert.equal(state.status, 'dispatched');
    assert.equal(state.trackingNumber, 'TEST-TRACK-99');
    assert.equal(state.courierName, 'Test Courier');
    assert.ok(state.dispatchedAt instanceof Date);

    assert.equal(state.historyCalls.length, 1);
    assert.equal(state.historyCalls[0].status, 'dispatched');
    assert.equal(state.historyCalls[0].notes, 'Handed to test courier');
    assert.equal(state.historyCalls[0].changed_by, 42);

    assert.equal(state.emailCalls.length, 1);
    assert.equal(state.emailCalls[0].email, 'test@example.com');
    assert.equal(state.emailCalls[0].trackingNumber, 'TEST-TRACK-99');
});

test('email failure does not roll back a committed dispatch', async () => {
    state.emailError = new Error('Simulated SMTP failure');

    const res = makeResponse();

    const originalConsoleError = console.error;
    console.error = () => {};

    try {
        await controller.updateDelivery(
            makeRequest({
                delivery_status: 'dispatched',
                tracking_number: 'TEST-TRACK-FAIL',
                courier_name: 'Test Courier'
            }),
            res
        );
    } finally {
        console.error = originalConsoleError;
    }

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.tracking_email_status, 'failed');
    assert.equal(state.commitCalls, 1);
    assert.equal(state.rollbackCalls, 0);
    assert.equal(state.status, 'dispatched');
    assert.equal(state.trackingNumber, 'TEST-TRACK-FAIL');
    assert.equal(state.historyCalls.length, 1);
    assert.equal(state.emailCalls.length, 1);
    assert.ok(
        state.auditCalls.some(
            (entry) => entry.action === 'DELIVERY_TRACKING_EMAIL_FAILED'
        )
    );
});

test('missing customer email skips email but keeps dispatch saved', async () => {
    state.customerEmail = null;

    const res = makeResponse();

    const originalConsoleWarn = console.warn;
    console.warn = () => {};

    try {
        await controller.updateDelivery(
            makeRequest({
                delivery_status: 'dispatched',
                tracking_number: 'TEST-TRACK-NOEMAIL',
                courier_name: 'Test Courier'
            }),
            res
        );
    } finally {
        console.warn = originalConsoleWarn;
    }

    assert.equal(res.statusCode, 200);
    assert.equal(
        res.body.tracking_email_status,
        'skipped_missing_customer_email'
    );
    assert.equal(state.commitCalls, 1);
    assert.equal(state.rollbackCalls, 0);
    assert.equal(state.status, 'dispatched');
    assert.equal(state.historyCalls.length, 1);
    assert.equal(state.emailCalls.length, 0);
});

test('ordinary status change creates history without sending dispatch email', async () => {
    const res = makeResponse();

    await controller.updateDelivery(
        makeRequest({ delivery_status: 'processing' }),
        res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(state.status, 'processing');
    assert.equal(state.commitCalls, 1);
    assert.equal(state.historyCalls.length, 1);
    assert.equal(state.historyCalls[0].status, 'processing');
    assert.equal(state.emailCalls.length, 0);
    assert.equal(res.body.tracking_email_status, 'not_required');
});

test('missing delivery returns 404 and rolls back', async () => {
    state.deliveryExists = false;

    const res = makeResponse();

    await controller.updateDelivery(
        makeRequest({ delivery_status: 'dispatched' }),
        res
    );

    assert.equal(res.statusCode, 404);
    assert.equal(state.commitCalls, 0);
    assert.equal(state.rollbackCalls, 1);
    assert.equal(state.emailCalls.length, 0);
});

test('delivery reassignment to another order is rejected', async () => {
    const originalOrderId = delivery.order_id;
    const res = makeResponse();

    await controller.updateDelivery(
        makeRequest({ order_id: 502 }),
        res
    );

    // This test should pass once reassignment is prohibited.
    assert.equal(res.statusCode, 400);
    assert.equal(delivery.order_id, originalOrderId);
    assert.equal(state.commitCalls, 0);
    assert.equal(state.rollbackCalls, 1);
});

test('invalid delivery status is rejected without changing the delivery', async () => {
    const originalStatus = state.status;
    const res = makeResponse();

    await controller.updateDelivery(
        makeRequest({ delivery_status: 'hacked_status' }),
        res
    );

    // This test should pass once explicit status validation is added.
    assert.equal(res.statusCode, 400);
    assert.equal(state.status, originalStatus);
    assert.equal(state.commitCalls, 0);
    assert.equal(state.rollbackCalls, 1);
    assert.equal(state.historyCalls.length, 0);
    assert.equal(state.emailCalls.length, 0);
});

test('manual delivery creation is not exposed by the controller', async () => {
    assert.equal(controller.createDelivery, undefined);
});