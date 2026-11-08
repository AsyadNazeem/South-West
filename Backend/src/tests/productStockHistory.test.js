'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();

function createService({ stocks = [], movements = [], images = [] } = {}) {
    const calls = {};
    const service = proxyquire('../utils/productStockHistory', {
        '../models': {
            InventoryStock: {
                async findAll(options) {
                    calls.stock = options;
                    return stocks;
                },
            },
            InventoryStockMovement: {
                async findAll(options) {
                    calls.movements = options;
                    return movements;
                },
            },
            ItemImage: { async findAll() { return images; } },
        },
        '../utils/fileStorage': { isValidUploadedImagePath: async imagePath => imagePath === 'valid-upload.webp' },
    });
    return { service, calls };
}

test('products with no variant stock record or movement are hidden', async () => {
    const { service } = createService();
    assert.deepEqual([...await service.getProductsWithStockEvidence([1])], []);
});

test('a zero-quantity variant stock record without receipt history is insufficient', async () => {
    const { service } = createService({ stocks: [{ item_id: 1, quantity_on_hand: 0 }] });
    assert.equal(await service.hasProductStockEvidence(1), false);
});

test('positive current stock and positive quantity receipts make a product visible', async () => {
    const { service } = createService({
        stocks: [{ item_id: 1, quantity_on_hand: 6 }],
        movements: [
            { item_id: 2, movement_type: 'goods_receipt', quantity: 4 },
            { item_id: 3, movement_type: 'transfer_in', quantity: 2 },
            { item_id: 4, movement_type: 'goods_receipt', quantity: 0 },
        ],
    });
    assert.deepEqual([...await service.getProductsWithStockEvidence([1, 2, 3, 4])], ['1', '2', '3']);
});

test('outbound movement alone does not count, but positive adjustment history does', async () => {
    const { service } = createService({
        movements: [
            { item_id: 1, movement_type: 'sale', quantity: 3 },
            { item_id: 2, movement_type: 'adjustment', quantity: 5, notes: 'Signed difference: -5' },
            { item_id: 3, movement_type: 'adjustment', quantity: 5, notes: 'Signed difference: 5 | Staff notes: count correction' },
        ],
    });
    assert.deepEqual([...await service.getProductsWithStockEvidence([1, 2, 3])], ['3']);
});

test('a receipt for any one of multiple variants makes its parent product visible', async () => {
    const { service, calls } = createService({
        movements: [{ item_id: 7, movement_type: 'goods_receipt', quantity: 1 }],
    });
    assert.equal(await service.hasProductStockEvidence(7), true);
    assert.ok(calls.movements.where.variant_id);
    assert.ok(calls.movements.where.movement_type);
});

test('variant history evidence is returned for that variant only', async () => {
    const { service } = createService({
        stocks: [{ variant_id: 10, quantity_on_hand: 4 }],
        movements: [
            { variant_id: 11, movement_type: 'goods_receipt', quantity: 2 },
            { variant_id: 12, movement_type: 'adjustment', quantity: 2, notes: 'Signed difference: -2' },
            { variant_id: 13, movement_type: 'adjustment', quantity: 2, notes: 'Signed difference: 2' },
        ],
    });
    assert.deepEqual([...await service.getVariantsWithStockEvidence([10, 11, 12, 13])], ['10', '11', '13']);
});

test('only active image references to real uploaded files qualify', async () => {
    const { service } = createService({
        images: [
            { item_id: 5, file_path: 'valid-upload.webp' },
            { item_id: 6, file_path: 'missing.webp' },
        ],
    });
    assert.deepEqual([...await service.getAllProductsWithValidImages()], ['5']);
});
