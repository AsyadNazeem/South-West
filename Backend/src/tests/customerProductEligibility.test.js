'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();

function loadEligibility({ variants = [], prices = [], stocked = [] } = {}) {
    const calls = {};
    const eligibility = proxyquire('../utils/customerProductEligibility', {
        sequelize: { Op: { in: Symbol('in'), gt: Symbol('gt'), lte: Symbol('lte'), gte: Symbol('gte'), or: Symbol('or'), and: Symbol('and') } },
        '../models': {
            ItemVariant: { async findAll(options) { calls.variantQuery = options; return variants; } },
            ItemPrice: { async findAll(options) { calls.priceQuery = options; return prices; } },
        },
        './productStockHistory': {
            getVariantsWithStockEvidence: async ids => new Set(ids.map(String).filter(id => stocked.includes(id))),
            getProductsWithValidImages: async ids => new Set(ids.map(String)),
        },
    });
    return { ...eligibility, calls };
}

test('requires the same variant to have positive price and its own stock history', async () => {
    const eligibility = loadEligibility({
        variants: [{ id: 1 }, { id: 2 }, { id: 3 }],
        prices: [{ variant_id: 1 }, { variant_id: 2 }],
        stocked: ['1', '3'],
    });
    const result = await eligibility.getEligibleCustomerVariantIds([1, 2, 3]);
    assert.deepEqual([...result], ['1']);
    assert.deepEqual(Object.getOwnPropertySymbols(eligibility.calls.priceQuery.where.price)
        .map(symbol => eligibility.calls.priceQuery.where.price[symbol]), [0]);
});

test('a product without a valid image is not customer visible', async () => {
    const eligibility = proxyquire('../utils/customerProductEligibility', {
        sequelize: { Op: { in: Symbol('in'), gt: Symbol('gt'), lte: Symbol('lte'), gte: Symbol('gte'), or: Symbol('or'), and: Symbol('and') } },
        '../models': {
            ItemVariant: { async findAll() { throw new Error('must not load variants'); } },
            ItemPrice: { async findAll() { throw new Error('must not load prices'); } },
        },
        './productStockHistory': { getProductsWithValidImages: async () => new Set() },
    });
    assert.equal(await eligibility.hasCustomerVisibleProduct(50), false);
});

test('an image alone does not make a never-stocked product visible', async () => {
    const eligibility = loadEligibility({ variants: [{ id: 4 }], prices: [{ variant_id: 4 }], stocked: [] });
    assert.equal(await eligibility.hasCustomerVisibleProduct(12), false);
});

test('exposes two priced and stocked variants while excluding an unpriced third variant', async () => {
    const eligibility = loadEligibility({
        variants: [{ id: 1 }, { id: 2 }, { id: 3 }],
        prices: [{ variant_id: 1 }, { variant_id: 2 }],
        stocked: ['1', '2', '3'],
    });
    assert.deepEqual([...await eligibility.getEligibleCustomerVariantIds([1, 2, 3])], ['1', '2']);
});

test('previously stocked out-of-stock products remain eligible when image and variant price exist', async () => {
    const eligibility = loadEligibility({ variants: [{ id: 9 }], prices: [{ variant_id: 9 }], stocked: ['9'] });
    assert.equal(await eligibility.hasCustomerVisibleProduct(20), true);
});

test('customer visibility requires valid positive LKR selling prices with active effective dates', async () => {
    const eligibility = loadEligibility({ variants: [{ id: 7 }], prices: [{ variant_id: 7 }], stocked: ['7'] });
    await eligibility.getEligibleCustomerVariantIds([7]);
    const where = eligibility.calls.priceQuery.where;
    assert.deepEqual(Object.getOwnPropertySymbols(where.price).map(symbol => where.price[symbol]), [0]);
    assert.equal(where.price_type, 'selling');
    assert.equal(where.currency, 'LKR');
    assert.equal(where.is_active, true);
    assert.ok(where[Object.getOwnPropertySymbols(where)[0]]);
});
