'use strict';

const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();

const state = {};

function resetState(overrides = {}) {
    Object.assign(state, {
        item: {
            id: 4,
            item_code: 'SW-000004',
            is_active: true
        },
        variant: {
            id: 9,
            item_id: 4,
            is_active: true
        },
        location: {
            id: 3,
            location_type: 'online',
            is_active: true
        },
        stock: {
            id: 7,
            item_id: 4,
            variant_id: 9,
            location_id: 3,
            quantity_on_hand: 15,
            quantity_reserved: 0,
            is_active: true,
            async update(changes) {
                Object.assign(this, changes);
                state.stockUpdateCalls.push(changes);
                return this;
            }
        },
        stocksByVariant: {},
        stockCreateCalls: [],
        movementCalls: [],
        auditCalls: [],
        auditError: null,
        locationCount: 1,
        transactionFinished: false,
        transactionCommits: 0,
        transactionRollbacks: 0,
        stockUpdateCalls: [],
        ...overrides
    });

    state.stocksByVariant = {
        9: state.stock,
        ...(overrides.stocksByVariant || {})
    };
}

function makeStock(values) {
    return {
        id: 20,
        is_active: true,
        quantity_on_hand: 0,
        quantity_reserved: 0,
        ...values,
        async update(changes) {
            Object.assign(this, changes);
            state.stockUpdateCalls.push(changes);
            return this;
        }
    };
}

const models = {
    sequelize: {
        async transaction() {
            return {
                LOCK: { UPDATE: 'UPDATE' },
                finished: undefined,
                async commit() {
                    state.transactionCommits += 1;
                    this.finished = 'commit';
                    state.transactionFinished = true;
                },
                async rollback() {
                    state.transactionRollbacks += 1;
                    this.finished = 'rollback';
                    state.transactionFinished = true;
                }
            };
        }
    },

    Item: {
        async findByPk(id) {
            return Number(id) === Number(state.item.id)
                ? state.item
                : null;
        }
    },

    ItemVariant: {
        async findOne(options) {
            const where = options.where;

            if (
                Number(where.id) !== Number(state.variant.id) ||
                Number(where.item_id) !== Number(state.variant.item_id)
            ) {
                return null;
            }

            return state.variant;
        }
    },

   InventoryLocation: {
    findOne: async () => state.location,
    findByPk: async (id) =>
        Number(id) === Number(state.location?.id)
            ? state.location
            : null,
    findAll: async () => [state.location]
},

    InventoryStock: {
        async findOne(options) {
            return state.stocksByVariant[options.where.variant_id] || null;
        },

            async findByPk(id) {
        return (
            Object.values(state.stocksByVariant).find(
                (stock) => Number(stock.id) === Number(id)
            ) || null
        );
    },

        async create(values) {
            state.stockCreateCalls.push(values);
            const stock = makeStock({
                ...values,
                id: 20
            });
            state.stocksByVariant[values.variant_id] = stock;
            return stock;
        }
    },

    InventoryStockMovement: {
        async create(values) {
            state.movementCalls.push(values);
            return values;
        }
    }
};

const auditService = {
    async recordAuditLog(values) {
        state.auditCalls.push(values);

        if (state.auditError) {
            throw state.auditError;
        }
    }
};

const controller = proxyquire(
    '../controllers/inventoryStockController',
    {
        '../models': models,
        '../services/auditLogService': auditService
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

function makeRequest(body) {
    return {
        body,
        user: { id: 42 },
        ip: '127.0.0.1',
        id: 'inventory-test',
        get(name) {
            return name === 'user-agent' ? 'node-test' : undefined;
        }
    };
}

async function callCount(body) {
    const req = makeRequest(body);
    const res = makeResponse();
    await controller.setOnlineStockCount(req, res);
    return res;
}

function validBody(overrides = {}) {
    return {
        item_id: 4,
        variant_id: 9,
        counted_quantity: 20,
        notes: 'Automated test',
        ...overrides
    };
}

test('online stock count rejects a variant belonging to another item', async () => {
    resetState();

    const res = await callCount(validBody({ variant_id: 10 }));

    assert.equal(res.statusCode, 404);
    assert.equal(state.transactionRollbacks, 1);
    assert.equal(state.stockUpdateCalls.length, 0);
    assert.equal(state.movementCalls.length, 0);
});

test('online stock count rejects an inactive variant', async () => {
    resetState({
        variant: {
            id: 9,
            item_id: 4,
            is_active: false
        }
    });

    const res = await callCount(validBody());

    assert.equal(res.statusCode, 409);
    assert.equal(state.transactionRollbacks, 1);
    assert.equal(state.stockUpdateCalls.length, 0);
});

test('online stock count rejects a count below reserved stock', async () => {
    resetState({
        stock: makeStock({
            id: 7,
            item_id: 4,
            variant_id: 9,
            location_id: 3,
            quantity_on_hand: 15,
            quantity_reserved: 8,
            is_active: true
        })
    });
    state.stocksByVariant = { 9: state.stock };

    const res = await callCount(validBody({ counted_quantity: 7 }));

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.reserved_quantity, 8);
    assert.equal(state.transactionRollbacks, 1);
    assert.equal(state.stockUpdateCalls.length, 0);
    assert.equal(state.movementCalls.length, 0);
});

test('unchanged count returns variant ID without creating a movement', async () => {
    resetState();

    const res = await callCount(validBody({ counted_quantity: 15 }));

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.variant_id, 9);
    assert.equal(res.body.data.adjustment, 0);
    assert.equal(state.transactionCommits, 1);
    assert.equal(state.movementCalls.length, 0);
    assert.equal(state.auditCalls.length, 0);
});

test('stock count updates only the requested variant and records its movement', async () => {
    resetState({
        stock: makeStock({
            id: 7,
            item_id: 4,
            variant_id: 9,
            location_id: 3,
            quantity_on_hand: 15,
            quantity_reserved: 0,
            is_active: true
        })
    });

    state.stocksByVariant = {
        9: state.stock,
        10: makeStock({
            id: 8,
            item_id: 4,
            variant_id: 10,
            location_id: 3,
            quantity_on_hand: 10,
            quantity_reserved: 0,
            is_active: true
        })
    };

    const otherVariantStock = state.stocksByVariant[10];

    const res = await callCount(validBody({ counted_quantity: 18 }));

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.variant_id, 9);
    assert.equal(state.stock.quantity_on_hand, 18);
    assert.equal(otherVariantStock.quantity_on_hand, 10);
    assert.equal(state.movementCalls.length, 1);
    assert.equal(state.movementCalls[0].variant_id, 9);
    assert.equal(state.movementCalls[0].quantity, 3);
    assert.equal(state.auditCalls[0].newValues.variant_id, 9);
    assert.equal(state.transactionCommits, 1);
});

test('audit failure rolls back the stock-count transaction', async () => {
    resetState({
        stock: makeStock({
            id: 7,
            item_id: 4,
            variant_id: 9,
            location_id: 3,
            quantity_on_hand: 15,
            quantity_reserved: 0,
            is_active: true
        }),
        auditError: new Error('Audit unavailable')
    });

    state.stocksByVariant = { 9: state.stock };

    const res = await callCount(validBody({ counted_quantity: 20 }));

    assert.equal(res.statusCode, 500);
    assert.equal(state.transactionRollbacks, 1);
    assert.equal(state.transactionCommits, 0);
    assert.equal(state.movementCalls.length, 1);
});

test('stock count rejects unsupported request fields', async () => {
    resetState();

    const res = await callCount(
        validBody({ unexpected_field: true })
    );

    assert.equal(res.statusCode, 400);
    assert.equal(state.transactionCommits, 0);
    assert.equal(state.transactionRollbacks, 0);
});

test('stock count rejects requests without a valid variant ID', async () => {
    resetState();

    const res = await callCount(validBody({ variant_id: 0 }));

    assert.equal(res.statusCode, 400);
    assert.equal(state.transactionCommits, 0);
    assert.equal(state.transactionRollbacks, 0);
});

test('stock creation rejects a variant belonging to another item', async () => {
    resetState();

    const req = makeRequest({
        item_id: 4,
        variant_id: 10,
        location_id: 3,
        quantity_on_hand: 5
    });
    const res = makeResponse();

    await controller.createInventoryStock(req, res);

    assert.equal(res.statusCode, 404);
    assert.equal(state.transactionRollbacks, 1);
    assert.equal(state.stockCreateCalls.length, 0);
});

test('stock creation rejects an inactive variant', async () => {
    resetState({
        variant: {
            id: 9,
            item_id: 4,
            is_active: false
        }
    });

    const req = makeRequest({
        item_id: 4,
        variant_id: 9,
        location_id: 3,
        quantity_on_hand: 5
    });
    const res = makeResponse();

    await controller.createInventoryStock(req, res);

    assert.equal(res.statusCode, 409);
    assert.equal(state.transactionRollbacks, 1);
    assert.equal(state.stockCreateCalls.length, 0);
});

test('stock creation rejects duplicate stock for the same variant and location', async () => {
    resetState();

    const req = makeRequest({
        item_id: 4,
        variant_id: 9,
        location_id: 3,
        quantity_on_hand: 5
    });
    const res = makeResponse();

    await controller.createInventoryStock(req, res);

    assert.equal(res.statusCode, 409);
    assert.match(res.body.message, /variant and location/i);
    assert.equal(state.transactionRollbacks, 1);
    assert.equal(state.stockCreateCalls.length, 0);
});

test('stock creation stores the variant ID and audits it', async () => {
    resetState({
        stocksByVariant: {}
    });
    state.stocksByVariant = {};

    const req = makeRequest({
        item_id: 4,
        variant_id: 9,
        location_id: 3,
        quantity_on_hand: 6,
        quantity_reserved: 0,
        reorder_level: 2,
        reorder_quantity: 5
    });
    const res = makeResponse();

    await controller.createInventoryStock(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(state.stockCreateCalls.length, 1);
    assert.equal(state.stockCreateCalls[0].item_id, 4);
    assert.equal(state.stockCreateCalls[0].variant_id, 9);
    assert.equal(state.stockCreateCalls[0].quantity_on_hand, 6);
    assert.equal(state.auditCalls.length, 1);
    assert.equal(state.auditCalls[0].newValues.variant_id, 9);
    assert.equal(state.transactionCommits, 1);
});

test('stock creation rolls back if audit logging fails', async () => {
    resetState({
        stocksByVariant: {},
        auditError: new Error('Audit unavailable')
    });
    state.stocksByVariant = {};

    const req = makeRequest({
        item_id: 4,
        variant_id: 9,
        location_id: 3,
        quantity_on_hand: 6
    });
    const res = makeResponse();

    await controller.createInventoryStock(req, res);

    assert.equal(res.statusCode, 500);
    assert.equal(state.transactionRollbacks, 1);
    assert.equal(state.transactionCommits, 0);
});
