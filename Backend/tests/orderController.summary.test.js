'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();
const sequelizeLibrary = require('sequelize');

function createHarness({ count = 0, rows = [] } = {}) {
    const calls = { summary: null, legacy: null };
    const models = {
        Order: {
            findAndCountAll: async options => {
                calls.summary = options;
                return { count, rows };
            },
            findAll: async options => {
                calls.legacy = options;
                return rows;
            },
        },
        Customer: { name: 'Customer' },
        CustomerAddress: { name: 'CustomerAddress' },
        User: { name: 'User' },
        OrderItem: { name: 'OrderItem' },
        OrderAddress: { name: 'OrderAddress' },
        Payment: { name: 'Payment' },
        Delivery: { name: 'Delivery' },
        Invoice: { name: 'Invoice' },
        OrderPromotion: { name: 'OrderPromotion' },
        ProductReview: { name: 'ProductReview' },
        Item: { name: 'Item' },
        ItemPrice: {},
        ItemVariant: { name: 'ItemVariant' },
    };
    const controller = proxyquire('../src/controllers/orderController', {
        sequelize: sequelizeLibrary,
        '../models': models,
        '../services/auditLogService': { recordAuditLog: async () => {} },
    });
    const response = {
        statusCode: null,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
    };
    return { controller, calls, response, models };
}

function order(overrides = {}) {
    const values = {
        id: 14,
        order_number: 'SW-2026-0014',
        order_date: '2026-02-03T00:00:00.000Z',
        order_type: 'online',
        status: 'processing',
        payment_status: 'paid',
        total_amount: '12450.00',
        notes: 'private internal note',
        customer_email: 'asha@example.test',
        customer: { id: 3, first_name: 'Asha', last_name: 'Perera', phone: '0771234567' },
        items: [{ id: 9, item_name: 'private item details' }],
        addresses: [{ address_line_1: 'private address' }],
        payments: [{ id: 22, transaction_reference: 'private payment' }],
        invoices: [{ id: 31 }],
        promotions: [{ id: 41 }],
        productReviews: [{ id: 51 }],
        ...overrides,
    };
    return { toJSON: () => values };
}

test('order summary returns first-page metadata and only table fields', async () => {
    const { controller, calls, response } = createHarness({ count: 5, rows: [order()] });
    await controller.getOrderSummaries({ query: { page: '1', pageSize: '2' } }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(calls.summary.limit, 2);
    assert.equal(calls.summary.offset, 0);
    assert.deepEqual(calls.summary.order, [['id', 'DESC']]);
    assert.deepEqual(calls.summary.attributes, [
        'id', 'order_number', 'order_date', 'order_type', 'status', 'payment_status', 'total_amount',
    ]);
    assert.equal(calls.summary.include.length, 1);
    assert.equal(calls.summary.include[0].as, 'customer');
    assert.deepEqual(calls.summary.include[0].attributes, ['id', 'first_name', 'last_name']);
    assert.deepEqual(response.body.pagination, { total: 5, page: 1, pageSize: 2, totalPages: 3 });
    assert.deepEqual(response.body.data[0], {
        id: 14,
        order_number: 'SW-2026-0014',
        order_date: '2026-02-03T00:00:00.000Z',
        order_type: 'online',
        status: 'processing',
        payment_status: 'paid',
        total_amount: '12450.00',
        customer: { id: 3, name: 'Asha Perera' },
    });
    assert.equal(JSON.stringify(response.body).includes('private address'), false);
    assert.equal(JSON.stringify(response.body).includes('private payment'), false);
    assert.equal(JSON.stringify(response.body).includes('private item details'), false);
});

test('order summary calculates last-page offset and caps page size', async () => {
    const { controller, calls, response } = createHarness({ count: 201, rows: [order()] });
    await controller.getOrderSummaries({
        query: { page: '3', pageSize: '500' },
    }, response);

    assert.equal(calls.summary.limit, 100);
    assert.equal(calls.summary.offset, 200);
    assert.deepEqual(response.body.pagination, { total: 201, page: 3, pageSize: 100, totalPages: 3 });
});

test('order summary applies search, order status and payment status filters', async () => {
    const { controller, calls } = createHarness({ rows: [order()] });
    await controller.getOrderSummaries({
        query: {
            search: 'Asha Perera',
            status: 'processing',
            paymentStatus: 'paid',
        },
    }, { status() { return this; }, json() {} });

    assert.equal(calls.summary.where.status, 'processing');
    assert.equal(calls.summary.where.payment_status, 'paid');
    assert.equal(calls.summary.where[sequelizeLibrary.Op.or].length, 3);
    assert.equal(
        calls.summary.where[sequelizeLibrary.Op.or][0].order_number[sequelizeLibrary.Op.like],
        '%Asha Perera%'
    );
});

test('order summary uses allowlisted sorting with a stable tie breaker', async () => {
    const { controller, calls } = createHarness();
    await controller.getOrderSummaries({ query: { sortBy: 'total_amount', sortOrder: 'ASC' } }, {
        status() { return this; }, json() {},
    });
    assert.deepEqual(calls.summary.order, [['total_amount', 'ASC'], ['id', 'DESC']]);

    await controller.getOrderSummaries({ query: { sortBy: 'customer_email', sortOrder: 'ASC' } }, {
        status() { return this; }, json() {},
    });
    assert.deepEqual(calls.summary.order, [['id', 'ASC']]);
});

test('order summary returns empty results and zero total pages', async () => {
    const { controller, response } = createHarness();
    await controller.getOrderSummaries({ query: { search: 'no-match' } }, response);
    assert.deepEqual(response.body.data, []);
    assert.deepEqual(response.body.pagination, { total: 0, page: 1, pageSize: 25, totalPages: 0 });
});

test('legacy order list keeps its existing full response and associations', async () => {
    const rows = [order()];
    const { controller, calls, response } = createHarness({ rows });
    await controller.getAllOrders({ query: {} }, response);

    assert.equal(calls.legacy.include.length, 9);
    assert.deepEqual(calls.legacy.include.map(include => include.as), [
        'customer', 'creator', 'items', 'addresses', 'payments', 'deliveries',
        'invoices', 'promotions', 'productReviews',
    ]);
    assert.deepEqual(response.body, {
        message: 'Orders retrieved successfully',
        data: rows,
    });
});

test('summary route retains authentication and orders.view permission', () => {
    const registrations = [];
    const router = {
        get: (...args) => registrations.push(args),
        patch() {},
        delete() {},
    };
    const authenticate = function authenticate() {};
    const viewPermission = function viewPermission() {};
    const getOrderSummaries = function getOrderSummaries() {};
    const getAllOrders = function getAllOrders() {};
    const getOrderById = function getOrderById() {};
    proxyquire('../src/routes/orderRoutes', {
        express: { Router: () => router },
        '../controllers/orderController': {
            getOrderSummaries,
            getAllOrders,
            getOrderById,
            deleteOrder() {},
        },
        '../controllers/orderStatusController': { updateOrderStatus() {} },
        '../middleware/authMiddleware': authenticate,
        '../middleware/requirePermission': {
            requirePermission: permission => permission === 'orders.view' ? viewPermission : () => {},
        },
    });

    const summaryRoute = registrations.find(([path]) => path === '/summary');
    assert.deepEqual(summaryRoute, ['/summary', authenticate, viewPermission, getOrderSummaries]);
    assert.deepEqual(registrations.find(([path]) => path === '/'), [
        '/', authenticate, viewPermission, getAllOrders,
    ]);
});
