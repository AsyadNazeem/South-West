'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();
const sequelizeLibrary = require('sequelize');

function createHarness({ count = 0, rows = [] } = {}) {
    const calls = { paginated: null, legacy: null };
    const models = {
        sequelize: {},
        Item: {
            findAndCountAll: async options => {
                calls.paginated = options;
                return { count, rows };
            },
            findAll: async options => {
                calls.legacy = options;
                return rows;
            },
        },
        Brand: {},
        Category: {},
        Unit: {},
        ItemType: {},
        Warranty: {},
        ItemSpecificationValue: {},
        ItemSpecification: {},
    };
    const controller = proxyquire('../src/controllers/itemController', {
        sequelize: sequelizeLibrary,
        '../models': models,
        '../services/auditLogService': { recordAuditLog: async () => {} },
        '../services/itemCodeService': { generateItemCode: async () => 'ITEM-1' },
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

test('paginated item listing returns first-page metadata and selected rows', async () => {
    const rows = [{ id: 3 }, { id: 2 }];
    const { controller, calls, response } = createHarness({ count: 5, rows });

    await controller.getItems({
        query: { paginate: '1', page: '1', pageSize: '2' },
    }, response);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.data, rows);
    assert.deepEqual(response.body.pagination, {
        total: 5,
        page: 1,
        pageSize: 2,
        totalPages: 3,
    });
    assert.equal(calls.paginated.limit, 2);
    assert.equal(calls.paginated.offset, 0);
    assert.deepEqual(calls.paginated.order, [['id', 'DESC']]);
    assert.deepEqual(calls.paginated.attributes, [
        'id',
        'item_code',
        'item_name',
        'condition',
        'is_serialized',
        'is_active',
        'is_new',
    ]);
    assert.deepEqual(
        calls.paginated.include.map(include => [include.as, include.attributes]),
        [
            ['brand', ['id', 'name']],
            ['category', ['id', 'name']],
        ]
    );
});

test('paginated item listing calculates the last-page offset', async () => {
    const { controller, calls, response } = createHarness({ count: 5, rows: [{ id: 1 }] });

    await controller.getItems({
        query: { paginate: '1', page: '3', pageSize: '2' },
    }, response);

    assert.equal(calls.paginated.offset, 4);
    assert.equal(response.body.pagination.page, 3);
    assert.equal(response.body.pagination.totalPages, 3);
});

test('paginated item listing supports search, category, brand and table filters', async () => {
    const { controller, calls, response } = createHarness({ count: 30, rows: [{ id: 1 }] });

    await controller.getItems({
        query: {
            paginate: '1',
            page: '2',
            pageSize: '25',
            search: 'lamp',
            categoryId: '8',
            brandId: '4',
            condition: 'used',
            status: 'inactive',
            sortBy: 'item_name',
            sortOrder: 'ASC',
        },
    }, response);

    const where = calls.paginated.where;
    assert.equal(calls.paginated.offset, 25);
    assert.equal(where.category_id, '8');
    assert.equal(where.brand_id, '4');
    assert.equal(where.condition, 'used');
    assert.equal(where.is_active, false);
    assert.equal(where[sequelizeLibrary.Op.or].length, 4);
    assert.deepEqual(calls.paginated.order, [['item_name', 'ASC'], ['id', 'DESC']]);
    assert.deepEqual(response.body.data, [{ id: 1 }]);
    assert.deepEqual(response.body.pagination, {
        total: 30,
        page: 2,
        pageSize: 25,
        totalPages: 2,
    });
});

test('paginated item listing returns empty results with zero total pages', async () => {
    const { controller, response } = createHarness({ count: 0, rows: [] });

    await controller.getItems({
        query: { paginate: '1', page: '1', pageSize: '25', search: 'no-match' },
    }, response);

    assert.deepEqual(response.body.data, []);
    assert.deepEqual(response.body.pagination, {
        total: 0,
        page: 1,
        pageSize: 25,
        totalPages: 0,
    });
});

test('requests without pagination retain the existing item response format', async () => {
    const rows = [{ id: 9, unitOfMeasure: { name: 'Each' } }];
    const { controller, calls, response } = createHarness({ rows });

    await controller.getItems({ query: {} }, response);

    assert.equal(calls.legacy !== null, true);
    assert.equal(calls.paginated, null);
    assert.deepEqual(response.body, {
        message: 'Item retrieved successfully',
        data: rows,
    });
});
