'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();
const sequelizeLibrary = require('sequelize');

function createHarness({ count = 0, rows = [] } = {}) {
    const calls = { paginated: null, legacy: null };
    const models = {
        sequelize: {},
        Customer: {
            findAndCountAll: async options => {
                calls.paginated = options;
                return { count, rows };
            },
            findAll: async options => {
                calls.legacy = options;
                return rows;
            },
        },
        CustomerAddress: { name: 'CustomerAddress' },
        CustomerSession: {},
        CustomerPasswordSetupToken: {},
    };
    const controller = proxyquire('../src/controllers/customerController', {
        sequelize: sequelizeLibrary,
        '../models': models,
        '../services/customerPasswordSetupService': {},
        '../services/emailService': {},
        '../services/customerCodeService': {},
        '../services/auditLogService': {},
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

    return { controller, calls, response };
}

function customer(overrides = {}) {
    const values = {
        id: 3,
        first_name: 'Asha',
        last_name: 'Perera',
        email: 'asha@example.test',
        phone: '0771234567',
        is_active: true,
        created_at: '2025-01-01T00:00:00.000Z',
        password_hash: 'must-not-leak',
        addresses: [{ id: 99, address_line_1: 'private address' }],
        ...overrides,
    };
    return { toJSON: () => values };
}

test('paginated customer listing returns selected first-page rows and metadata', async () => {
    const { controller, calls, response } = createHarness({
        count: 5,
        rows: [customer(), customer({ id: 2 })],
    });

    await controller.getCustomers({ query: { paginate: '1', page: '1', pageSize: '2' } }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(calls.paginated.limit, 2);
    assert.equal(calls.paginated.offset, 0);
    assert.deepEqual(calls.paginated.order, [['id', 'DESC']]);
    assert.deepEqual(calls.paginated.attributes, [
        'id', 'first_name', 'last_name', 'email', 'phone', 'is_active', 'created_at',
    ]);
    assert.equal(calls.paginated.include, undefined);
    assert.deepEqual(response.body.pagination, { total: 5, page: 1, pageSize: 2, totalPages: 3 });
    assert.deepEqual(response.body.data[0], {
        id: 3,
        first_name: 'Asha',
        last_name: 'Perera',
        email: 'asha@example.test',
        mobile: '0771234567',
        orders: 0,
        total_spent: 0,
        status: 'active',
        created_at: '2025-01-01T00:00:00.000Z',
    });
    assert.equal(JSON.stringify(response.body).includes('must-not-leak'), false);
    assert.equal(JSON.stringify(response.body).includes('private address'), false);
});

test('paginated customer listing calculates last-page offset', async () => {
    const { controller, calls, response } = createHarness({ count: 5, rows: [customer()] });
    await controller.getCustomers({ query: { paginate: '1', page: '3', pageSize: '2' } }, response);

    assert.equal(calls.paginated.offset, 4);
    assert.equal(response.body.pagination.page, 3);
    assert.equal(response.body.pagination.totalPages, 3);
});

test('paginated customer listing applies search and status filters', async () => {
    const { controller, calls, response } = createHarness({ count: 1, rows: [customer()] });
    await controller.getCustomers({
        query: { paginate: '1', search: 'asha', status: 'inactive' },
    }, response);

    assert.equal(calls.paginated.where.is_active, false);
    assert.equal(calls.paginated.where[sequelizeLibrary.Op.or].length, 3);
    assert.equal(calls.paginated.where[sequelizeLibrary.Op.or][1].email[sequelizeLibrary.Op.like], '%asha%');
    assert.equal(calls.paginated.where[sequelizeLibrary.Op.or][2].phone[sequelizeLibrary.Op.like], '%asha%');
});

test('paginated customer listing uses allowlisted sorting and stable tie ordering', async () => {
    const { controller, calls } = createHarness();
    await controller.getCustomers({
        query: { paginate: '1', sortBy: 'first_name', sortOrder: 'ASC' },
    }, { status() { return this; }, json() {} });
    assert.deepEqual(calls.paginated.order, [['first_name', 'ASC'], ['id', 'DESC']]);

    await controller.getCustomers({
        query: { paginate: '1', sortBy: 'password_hash', sortOrder: 'ASC' },
    }, { status() { return this; }, json() {} });
    assert.deepEqual(calls.paginated.order, [['id', 'ASC']]);
});

test('paginated customer listing returns empty results with zero total pages', async () => {
    const { controller, response } = createHarness();
    await controller.getCustomers({ query: { paginate: '1', search: 'no-match' } }, response);
    assert.deepEqual(response.body.data, []);
    assert.deepEqual(response.body.pagination, { total: 0, page: 1, pageSize: 25, totalPages: 0 });
});

test('requests without pagination retain the legacy response and address include', async () => {
    const rows = [customer()];
    const { controller, calls, response } = createHarness({ rows });
    await controller.getCustomers({ query: {} }, response);

    assert.notEqual(calls.legacy, null);
    assert.equal(calls.paginated, null);
    assert.equal(calls.legacy.include[0].as, 'addresses');
    const { password_hash, ...legacyCustomer } = customer().toJSON();
    assert.deepEqual(response.body, {
        message: 'Customers retrieved successfully.',
        data: [{
            ...legacyCustomer,
            mobile: '0771234567',
            orders: 0,
            total_spent: 0,
            status: 'active',
        }],
    });
});

test('customer list route retains authentication and view permission', () => {
    const registrations = [];
    const router = {
        get: (...args) => registrations.push(args),
        post() {},
        put() {},
        delete() {},
    };
    const authenticate = function authenticate() {};
    const viewPermission = function viewPermission() {};
    const getCustomers = function getCustomers() {};
    proxyquire('../src/routes/customerRoutes', {
        express: { Router: () => router },
        '../controllers/customerController': {
            getCustomers,
            createCustomer() {},
            getCustomer() {},
            updateCustomer() {},
            deleteCustomer() {},
        },
        '../middleware/authMiddleware': authenticate,
        '../middleware/requirePermission': {
            requirePermission: permission => permission === 'customers.view' ? viewPermission : () => {},
        },
    });

    const listRoute = registrations.find(([path]) => path === '/');
    assert.deepEqual(listRoute, ['/', authenticate, viewPermission, getCustomers]);
});
