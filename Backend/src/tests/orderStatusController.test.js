'use strict';

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();

const state = {};

function resetState(overrides = {}) {
    Object.assign(state, {
        orderStatus: 'pending',
        paymentStatus: 'unpaid',
        customerId: null,
        customer: null,
        deliveries: [],
        createdDeliveries: [],
        shippingAddress: null,
        notifications: [],
        histories: [],
        auditCalls: [],
        statusEmails: [],
        trackingEmails: [],
        commitCalls: 0,
        rollbackCalls: 0,
        emailError: null,
        ...overrides
    });
}

function makeTransaction() {
    return {
        LOCK: { UPDATE: 'UPDATE' },
        finished: undefined,

        async commit() {
            state.commitCalls += 1;
            this.finished = 'commit';
        },

        async rollback() {
            state.rollbackCalls += 1;
            this.finished = 'rollback';
        }
    };
}

const sequelize = {
    async transaction() {
        return makeTransaction();
    }
};

const order = {
    id: 501,
    order_number: 'TEST-ORDER-501',
    customer_id: null,

    get status() {
        return state.orderStatus;
    },

    get payment_status() {
        return state.paymentStatus;
    },

    async update(values) {
        if (values.status !== undefined) {
            state.orderStatus = values.status;
        }

        return this;
    }
};

const models = {
    sequelize,

    Order: {
        async findByPk() {
            return order;
        }
    },

    Customer: {
        async findByPk() {
            return state.customer;
        }
    },

    OrderAddress: {
        async findOne() {
            return state.shippingAddress;
        }
    },

    Delivery: {
        async findAll() {
            return state.deliveries;
        },
        async create(values) {
            const delivery = makeDelivery({
                id: 902,
                ...values,
                async save() {
                    return this;
                }
            });
            state.createdDeliveries.push(delivery);
            return delivery;
        }
    },

    DeliveryStatusHistory: {
        async create(values) {
            state.histories.push(values);
            return values;
        }
    },

    Notification: {
        async create(values) {
            state.notifications.push(values);
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
        state.trackingEmails.push(payload);

        if (state.emailError) {
            throw state.emailError;
        }
    },

    async sendOrderStatusEmail(payload) {
        state.statusEmails.push(payload);

        if (state.emailError) {
            throw state.emailError;
        }
    }
};

const controller = proxyquire(
    '../controllers/orderStatusController',
    {
        '../models': models,
        '../services/auditLogService': auditService,
        '../services/emailService': emailService
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

function makeRequest(body = {}) {
    return {
        params: { id: '501' },
        body,
        user: { id: 42 },
        ip: '127.0.0.1',
        id: 'order-status-test',

        get(name) {
            return name === 'user-agent' ? 'node-test' : undefined;
        }
    };
}

function makeDelivery(overrides = {}) {
    return {
        id: 901,
        order_id: 501,
        delivery_status: 'pending',
        tracking_number: null,
        courier_name: null,
        expected_delivery_date: null,
        dispatched_at: null,
        delivered_at: null,
        notes: null,

        async save() {
            return this;
        },

        ...overrides
    };
}

beforeEach(() => {
    resetState();

    order.customer_id = null;
});

test('walk-in order can be confirmed without a customer account', async () => {
    const res = makeResponse();

    await controller.updateOrderStatus(
        makeRequest({ status: 'confirmed' }),
        res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(state.orderStatus, 'confirmed');
    assert.equal(state.paymentStatus, 'unpaid');
    assert.equal(state.notifications.length, 0);
    assert.equal(state.statusEmails.length, 0);
    assert.equal(state.commitCalls, 1);
    assert.equal(state.rollbackCalls, 0);
    assert.equal(state.auditCalls.length, 1);
});

test('registered customer receives an in-app notification and email', async () => {
    state.customer = {
        id: 7,
        first_name: 'Test',
        last_name: 'Customer',
        email: 'test@example.com'
    };

    order.customer_id = 7;

    const res = makeResponse();

    await controller.updateOrderStatus(
        makeRequest({ status: 'confirmed' }),
        res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(state.notifications.length, 1);
    assert.equal(state.notifications[0].customer_id, 7);
    assert.equal(state.notifications[0].type, 'order_status');
    assert.equal(state.notifications[0].is_read, false);
    assert.equal(state.notifications[0].reference_id, 501);

    assert.equal(state.statusEmails.length, 1);
    assert.equal(state.statusEmails[0].email, 'test@example.com');
    assert.equal(state.statusEmails[0].statusLabel, 'Order Confirmed');
});

test('invalid order status is rejected', async () => {
    const res = makeResponse();

    await controller.updateOrderStatus(
        makeRequest({ status: 'something_else' }),
        res
    );

    assert.equal(res.statusCode, 400);
    assert.equal(state.commitCalls, 0);
    assert.equal(state.orderStatus, 'pending');
});

test('invalid transition is rejected and rolled back', async () => {
    const res = makeResponse();

    await controller.updateOrderStatus(
        makeRequest({ status: 'delivered' }),
        res
    );

    assert.equal(res.statusCode, 409);
    assert.equal(state.orderStatus, 'pending');
    assert.equal(state.commitCalls, 0);
    assert.equal(state.rollbackCalls, 1);
});

test('cancellation requires a reason', async () => {
    const res = makeResponse();

    await controller.updateOrderStatus(
        makeRequest({ status: 'cancelled' }),
        res
    );

    assert.equal(res.statusCode, 400);
    assert.equal(state.commitCalls, 0);
    assert.equal(state.orderStatus, 'pending');
});

test('return requires a reason', async () => {
    state.orderStatus = 'shipped';

    const res = makeResponse();

    await controller.updateOrderStatus(
        makeRequest({ status: 'returned', reason: '   ' }),
        res
    );

    assert.equal(res.statusCode, 400);
    assert.equal(state.commitCalls, 0);
    assert.equal(state.orderStatus, 'shipped');
});

test('courier handover requires courier and tracking details', async () => {
    state.orderStatus = 'processing';
    state.deliveries = [makeDelivery()];

    const res = makeResponse();

    await controller.updateOrderStatus(
        makeRequest({ status: 'shipped', courier_name: 'Courier' }),
        res
    );

    assert.equal(res.statusCode, 400);
    assert.equal(state.orderStatus, 'processing');
    assert.equal(state.commitCalls, 0);
    assert.equal(state.trackingEmails.length, 0);
});

test('courier handover updates delivery, history and tracking email', async () => {
    state.orderStatus = 'processing';
    state.customer = {
        id: 7,
        first_name: 'Test',
        last_name: 'Customer',
        email: 'test@example.com'
    };

    order.customer_id = 7;
    state.deliveries = [makeDelivery()];

    const res = makeResponse();

    await controller.updateOrderStatus(
        makeRequest({
            status: 'shipped',
            courier_name: ' Test Courier ',
            tracking_number: ' TRACK-123 '
        }),
        res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(state.orderStatus, 'shipped');
    assert.equal(state.deliveries[0].delivery_status, 'dispatched');
    assert.equal(state.deliveries[0].courier_name, 'Test Courier');
    assert.equal(state.deliveries[0].tracking_number, 'TRACK-123');
    assert.ok(state.deliveries[0].dispatched_at instanceof Date);

    assert.equal(state.histories.length, 1);
    assert.equal(state.histories[0].status, 'dispatched');
    assert.equal(state.notifications.length, 1);
    assert.equal(state.trackingEmails.length, 1);
    assert.equal(state.statusEmails.length, 0);
    assert.equal(state.commitCalls, 1);
});

test('courier handover creates a delivery from the saved shipping address', async () => {
    state.orderStatus = 'processing';
    state.customer = {
        id: 7,
        first_name: 'Test',
        last_name: 'Customer',
        email: 'test@example.com'
    };
    order.customer_id = 7;

    state.shippingAddress = {
        recipient_name: 'Test Recipient',
        phone: '0771234567',
        address_line_1: '123 Test Street',
        address_line_2: 'Apartment 4',
        city: 'Colombo',
        state: 'Western',
        postal_code: '00100',
        country: 'Sri Lanka'
    };

    const res = makeResponse();

    await controller.updateOrderStatus(
        makeRequest({
            status: 'shipped',
            courier_name: 'Test Courier',
            tracking_number: 'TRACK-NEW-123'
        }),
        res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(state.orderStatus, 'shipped');
    assert.equal(state.createdDeliveries.length, 1);

    const delivery = state.createdDeliveries[0];

    assert.match(delivery.delivery_reference, /^SWD-/);
    assert.equal(delivery.order_id, order.id);
    assert.equal(delivery.delivery_status, 'dispatched');
    assert.equal(delivery.recipient_name, 'Test Recipient');
    assert.equal(delivery.recipient_phone, '0771234567');
    assert.equal(delivery.address_line_1, '123 Test Street');
    assert.equal(delivery.address_line_2, 'Apartment 4');
    assert.equal(delivery.city, 'Colombo');
    assert.equal(delivery.state, 'Western');
    assert.equal(delivery.postal_code, '00100');
    assert.equal(delivery.country, 'Sri Lanka');
    assert.equal(delivery.courier_name, 'Test Courier');
    assert.equal(delivery.tracking_number, 'TRACK-NEW-123');
    assert.ok(delivery.dispatched_at instanceof Date);

    assert.equal(state.histories.length, 1);
    assert.equal(state.histories[0].delivery_id, delivery.id);
    assert.equal(state.histories[0].status, 'dispatched');
    assert.equal(state.trackingEmails.length, 1);
    assert.equal(state.commitCalls, 1);
    assert.equal(state.rollbackCalls, 0);
});

test('courier handover is rejected when a new delivery has no saved shipping address', async () => {
    state.orderStatus = 'processing';
    state.shippingAddress = null;

    const res = makeResponse();

    await controller.updateOrderStatus(
        makeRequest({
            status: 'shipped',
            courier_name: 'Test Courier',
            tracking_number: 'TRACK-MISSING-ADDRESS'
        }),
        res
    );

    assert.equal(res.statusCode, 409);
    assert.equal(state.createdDeliveries.length, 0);
    assert.equal(state.orderStatus, 'processing');
    assert.equal(state.commitCalls, 0);
    assert.equal(state.rollbackCalls, 1);
});

test('order cannot be completed while a delivery is undelivered', async () => {
    state.orderStatus = 'shipped';
    state.deliveries = [
        makeDelivery({ delivery_status: 'dispatched' })
    ];

    const res = makeResponse();

    await controller.updateOrderStatus(
        makeRequest({ status: 'delivered' }),
        res
    );

    assert.equal(res.statusCode, 409);
    assert.equal(state.orderStatus, 'shipped');
    assert.equal(state.commitCalls, 0);
    assert.equal(state.rollbackCalls, 1);
    assert.equal(state.notifications.length, 0);
});

test('email failure does not undo the committed status update', async () => {
    state.customer = {
        id: 7,
        first_name: 'Test',
        last_name: 'Customer',
        email: 'test@example.com'
    };

    order.customer_id = 7;
    state.emailError = new Error('Simulated SMTP failure');

    const originalConsoleError = console.error;
    console.error = () => {};

    let res;

    try {
        res = makeResponse();

        await controller.updateOrderStatus(
            makeRequest({ status: 'confirmed' }),
            res
        );
    } finally {
        console.error = originalConsoleError;
    }

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.email_status, 'failed');
    assert.equal(state.orderStatus, 'confirmed');
    assert.equal(state.commitCalls, 1);
    assert.equal(state.rollbackCalls, 0);
    assert.equal(state.notifications.length, 1);
    assert.equal(state.auditCalls.length, 2);
});

test('unchanged status does not send duplicate notifications or emails', async () => {
    state.orderStatus = 'confirmed';

    const res = makeResponse();

    await controller.updateOrderStatus(
        makeRequest({ status: 'confirmed' }),
        res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(state.commitCalls, 0);
    assert.equal(state.notifications.length, 0);
    assert.equal(state.statusEmails.length, 0);
});

test('cancellation updates a pending delivery and preserves payment status', async () => {
    state.customer = null;
    state.deliveries = [makeDelivery()];

    const res = makeResponse();

    await controller.updateOrderStatus(
        makeRequest({
            status: 'cancelled',
            reason: 'Customer requested cancellation'
        }),
        res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(state.orderStatus, 'cancelled');
    assert.equal(state.deliveries[0].delivery_status, 'cancelled');
    assert.equal(state.paymentStatus, 'unpaid');
    assert.equal(state.histories.length, 1);
    assert.equal(state.notifications.length, 0);
    assert.equal(state.commitCalls, 1);
});
