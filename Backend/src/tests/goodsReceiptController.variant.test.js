'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();

let state;

function resetState(overrides = {}) {
    state = {
        receipt: {
            id: 12,
            receipt_number: 'GRN-TEST-001',
            status: 'draft',
            purchase_order_id: null,
            location_id: 3,
            received_by: null,
            received_at: null,
            async update(changes) {
                Object.assign(this, changes);
                state.receiptUpdates.push({ ...changes });
            }
        },
        location: {
            id: 3,
            code: 'MAIN',
            name: 'Main Warehouse',
            location_type: 'warehouse'
        },
        items: [
            {
                id: 21,
                goods_receipt_id: 12,
                purchase_order_item_id: null,
                item_id: 4,
                variant_id: 9,
                quantity_received: 5,
                condition: 'good'
            }
        ],
        variants: {
            9: { id: 9, item_id: 4, is_active: true }
        },
        poItems: {},
        stocks: {
            '4:9:3': {
                id: 7,
                item_id: 4,
                variant_id: 9,
                location_id: 3,
                quantity_on_hand: 10,
                quantity_reserved: 0,
                async update(changes) {
                    Object.assign(this, changes);
                    state.stockUpdates.push({ ...changes });
                }
            }
        },
        stockCreates: [],
        movements: [],
        stockUpdates: [],
        poItemUpdates: [],
        receiptUpdates: [],
        audits: [],
        auditError: null,
        transactionCommits: 0,
        transactionRollbacks: 0,
        transactionFinished: null,
        ...overrides
    };

    if (!state.stocks) state.stocks = {};
}

const models = {
    sequelize: {
        async transaction() {
            return {
                LOCK: { UPDATE: 'UPDATE' },
                finished: undefined,
                async commit() {
                    state.transactionCommits++;
                    this.finished = 'commit';
                    state.transactionFinished = 'commit';
                },
                async rollback() {
                    state.transactionRollbacks++;
                    this.finished = 'rollback';
                    state.transactionFinished = 'rollback';
                }
            };
        }
    },

    GoodsReceipt: {
        async findByPk(id, options = {}) {
            if (Number(id) !== state.receipt.id) return null;

            // The post-commit lookup includes associations.
            return state.receipt;
        }
    },

    GoodsReceiptItem: {
        async findAll() {
            return state.items;
        }
    },

    InventoryLocation: {
        async findByPk(id) {
            return Number(id) === state.location.id ? state.location : null;
        }
    },

    ItemVariant: {
        async findOne(options) {
            const variant = state.variants[Number(options.where.id)];

            if (
                !variant ||
                Number(variant.item_id) !== Number(options.where.item_id)
            ) {
                return null;
            }

            return variant;
        }
    },

    PurchaseOrderItem: {
        async findByPk(id) {
            const poItem = state.poItems[Number(id)];

            if (!poItem) return null;

            return {
                ...poItem,
                async update(changes) {
                    Object.assign(poItem, changes);
                    state.poItemUpdates.push({ id: Number(id), ...changes });
                }
            };
        }
    },

    InventoryStock: {
        async findOne(options) {
            const where = options.where;
            return state.stocks[
                `${where.item_id}:${where.variant_id}:${where.location_id}`
            ] || null;
        },

        async create(values) {
            const stock = {
                id: 100 + state.stockCreates.length,
                ...values,
                async update(changes) {
                    Object.assign(this, changes);
                    state.stockUpdates.push({ ...changes });
                }
            };

            state.stockCreates.push({ ...values });
            state.stocks[
                `${values.item_id}:${values.variant_id}:${values.location_id}`
            ] = stock;

            return stock;
        }
    },

    InventoryStockMovement: {
        async create(values) {
            const movement = { id: 500 + state.movements.length, ...values };
            state.movements.push(movement);
            return movement;
        }
    },

    PurchaseOrder: {},
    User: {}
};

const auditService = {
    async recordAuditLog(values) {
        state.audits.push(values);

        if (state.auditError) {
            throw state.auditError;
        }
    }
};

const controller = proxyquire(
    '../controllers/goodsReceiptController',
    {
        '../models': models,
        '../services/auditLogService': auditService
    }
);

function makeRequest() {
    return {
        params: { id: '12' },
        user: { id: 42 },
        ip: '127.0.0.1',
        id: 'goods-receipt-test',
        get(name) {
            return name === 'user-agent' ? 'node-test' : undefined;
        }
    };
}

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

async function receive() {
    const req = makeRequest();
    const res = makeResponse();

    await controller.receiveGoodsReceipt(req, res);

    return res;
}

test('receiving a standalone GRN increases stock for the exact variant and creates a goods-receipt movement', async () => {
    resetState();

    const res = await receive();

    assert.equal(res.statusCode, 200);
    assert.equal(state.receipt.status, 'received');
    assert.equal(state.stocks['4:9:3'].quantity_on_hand, 15);
    assert.equal(state.stockCreates.length, 0);
    assert.equal(state.movements.length, 1);
    assert.equal(state.movements[0].item_id, 4);
    assert.equal(state.movements[0].variant_id, 9);
    assert.equal(state.movements[0].location_id, 3);
    assert.equal(state.movements[0].movement_type, 'goods_receipt');
    assert.equal(state.movements[0].quantity, 5);
    assert.equal(state.transactionCommits, 1);
    assert.equal(state.transactionRollbacks, 0);
});

test('receiving creates stock when the variant has no stock row at the location', async () => {
    resetState({ stocks: {} });

    const res = await receive();

    assert.equal(res.statusCode, 200);
    assert.equal(state.stockCreates.length, 1);
    assert.equal(state.stockCreates[0].item_id, 4);
    assert.equal(state.stockCreates[0].variant_id, 9);
    assert.equal(state.stockCreates[0].location_id, 3);
    assert.equal(state.stockCreates[0].quantity_on_hand, 0);
    assert.equal(state.movements.length, 1);
    assert.equal(state.transactionCommits, 1);
});

test('receiving rejects a missing variant and rolls back', async () => {
    resetState({
        items: [{
            id: 21,
            goods_receipt_id: 12,
            purchase_order_item_id: null,
            item_id: 4,
            variant_id: null,
            quantity_received: 5,
            condition: 'good'
        }]
    });

    const res = await receive();

    assert.equal(res.statusCode, 400);
    assert.equal(state.transactionRollbacks, 1);
    assert.equal(state.transactionCommits, 0);
    assert.equal(state.stockUpdates.length, 0);
    assert.equal(state.movements.length, 0);
    assert.notEqual(state.receipt.status, 'received');
});

test('receiving rejects a variant belonging to a different item', async () => {
    resetState({
        items: [{
            id: 21,
            goods_receipt_id: 12,
            purchase_order_item_id: null,
            item_id: 4,
            variant_id: 10,
            quantity_received: 5,
            condition: 'good'
        }]
    });

    const res = await receive();

    assert.equal(res.statusCode, 400);
    assert.equal(state.transactionRollbacks, 1);
    assert.equal(state.stockUpdates.length, 0);
    assert.equal(state.movements.length, 0);
});

test('receiving rejects an inactive variant', async () => {
    resetState({
        variants: {
            9: { id: 9, item_id: 4, is_active: false }
        }
    });

    const res = await receive();

    assert.equal(res.statusCode, 409);
    assert.equal(state.transactionRollbacks, 1);
    assert.equal(state.stockUpdates.length, 0);
    assert.equal(state.movements.length, 0);
});

test('damaged and defective goods do not increase usable stock', async () => {
    resetState({
        items: [
            {
                id: 21,
                goods_receipt_id: 12,
                purchase_order_item_id: null,
                item_id: 4,
                variant_id: 9,
                quantity_received: 2,
                condition: 'damaged'
            },
            {
                id: 22,
                goods_receipt_id: 12,
                purchase_order_item_id: null,
                item_id: 4,
                variant_id: 9,
                quantity_received: 3,
                condition: 'defective'
            }
        ]
    });

    const res = await receive();

    assert.equal(res.statusCode, 200);
    assert.equal(state.receipt.status, 'received');
    assert.equal(state.stocks['4:9:3'].quantity_on_hand, 10);
    assert.equal(state.movements.length, 0);
    assert.equal(state.transactionCommits, 1);
});

test('receiving rejects a quantity exceeding the remaining purchase-order quantity', async () => {
    resetState({
        receipt: {
            id: 12,
            receipt_number: 'GRN-TEST-001',
            status: 'draft',
            purchase_order_id: 30,
            location_id: 3,
            async update(changes) {
                Object.assign(this, changes);
                state.receiptUpdates.push({ ...changes });
            }
        },
        items: [{
            id: 21,
            goods_receipt_id: 12,
            purchase_order_item_id: 41,
            item_id: 4,
            variant_id: 9,
            quantity_received: 5,
            condition: 'good'
        }],
        poItems: {
            41: {
                id: 41,
                purchase_order_id: 30,
                item_id: 4,
                variant_id: 9,
                quantity_ordered: 6,
                quantity_received: 2
            }
        }
    });

    const res = await receive();

assert.equal(res.statusCode, 400);
    assert.equal(state.transactionRollbacks, 1);
    assert.equal(state.poItemUpdates.length, 0);
    assert.equal(state.stockUpdates.length, 0);
    assert.equal(state.movements.length, 0);
    assert.notEqual(state.receipt.status, 'received');
});

test('receiving rejects a GRN variant that differs from the purchase-order item variant', async () => {
    resetState({
        receipt: {
            id: 12,
            receipt_number: 'GRN-TEST-001',
            status: 'draft',
            purchase_order_id: 30,
            location_id: 3,
            async update(changes) {
                Object.assign(this, changes);
                state.receiptUpdates.push({ ...changes });
            }
        },
        items: [{
            id: 21,
            goods_receipt_id: 12,
            purchase_order_item_id: 41,
            item_id: 4,
            variant_id: 9,
            quantity_received: 2,
            condition: 'good'
        }],
        poItems: {
            41: {
                id: 41,
                purchase_order_id: 30,
                item_id: 4,
                variant_id: 10,
                quantity_ordered: 6,
                quantity_received: 0
            }
        },
        variants: {
            9: { id: 9, item_id: 4, is_active: true },
            10: { id: 10, item_id: 4, is_active: true }
        }
    });

    const res = await receive();

    assert.equal(res.statusCode, 400);
    assert.equal(state.transactionRollbacks, 1);
    assert.equal(state.poItemUpdates.length, 0);
    assert.equal(state.stockUpdates.length, 0);
    assert.equal(state.movements.length, 0);
});

test('an audit failure rolls back receiving and does not mark the receipt received', async () => {
    resetState({
        auditError: new Error('Simulated audit failure')
    });

    const res = await receive();

    assert.equal(res.statusCode, 500);
    assert.equal(state.transactionRollbacks, 1);
    assert.equal(state.transactionCommits, 0);
    assert.notEqual(state.receipt.status, 'received');
});
