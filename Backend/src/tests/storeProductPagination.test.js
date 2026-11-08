'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pagination = require('../utils/storeProductPagination');

const SECRET = 'test-pagination-secret-at-least-32-characters';
const SEED = 'abcdef0123456789abcdef0123456789';
const QUERY = { sort: 'relevance', category: null, brands: ['2', '1'] };
const QUERY_HASH = pagination.createQueryFingerprint(QUERY);

test('defaults to 20 products', () => {
    assert.equal(pagination.parseLimit(undefined), 20);
    assert.equal(pagination.parseLimit('invalid'), 20);
    assert.equal(pagination.parseLimit('0'), 20);
});

test('caps page size at 25', () => {
    assert.equal(pagination.parseLimit('25'), 25);
    assert.equal(pagination.parseLimit('50'), 25);
});

test('rejects partially numeric page sizes', () => {
    assert.equal(pagination.parseLimit('20abc'), 20);
});

test('generates unique valid shuffle seeds', () => {
    const first = pagination.createSeed();
    const second = pagination.createSeed();

    assert.match(first, /^[a-f0-9]{32}$/);
    assert.notEqual(first, second);
});

test('validates shuffle seeds', () => {
    assert.equal(pagination.validateSeed(SEED), true);
    assert.equal(pagination.validateSeed('invalid'), false);
    assert.equal(pagination.validateSeed(null), false);
});

test('creates stable fingerprints regardless of object key order', () => {
    assert.equal(
        pagination.createQueryFingerprint({
            brands: ['2', '1'],
            category: null,
            sort: 'relevance',
        }),
        QUERY_HASH
    );
});

test('fingerprints nested filters and array values', () => {
    assert.notEqual(
        pagination.createQueryFingerprint({ brands: ['1', '2'] }),
        pagination.createQueryFingerprint({ brands: ['2', '1'] })
    );
});

test('store product fingerprints ignore campaign and image result ordering', () => {
    const filters = {
        search: '',
        categoryIds: [],
        brandIds: [],
        offers: false,
    };

    const campaignsA = [
        {
            target_type: 'selected_products',
            discount_type: 'percentage',
            discount_value: 10,
            campaignItems: [{ item_id: 12 }, { item_id: 5 }],
            campaignCategories: [],
            campaignBrands: [],
        },
        {
            target_type: 'brand',
            discount_type: 'fixed',
            discount_value: 500,
            campaignItems: [],
            campaignCategories: [],
            campaignBrands: [{ brand_id: 8 }, { brand_id: 3 }],
        },
    ];

    const campaignsB = [
        {
            target_type: 'brand',
            discount_type: 'fixed',
            discount_value: 500,
            campaignItems: [],
            campaignCategories: [],
            campaignBrands: [{ brand_id: 3 }, { brand_id: 8 }],
        },
        {
            target_type: 'selected_products',
            discount_type: 'percentage',
            discount_value: 10,
            campaignItems: [{ item_id: 5 }, { item_id: 12 }],
            campaignCategories: [],
            campaignBrands: [],
        },
    ];

    const first = pagination.createStoreProductQueryFingerprint({
        filters,
        sort: 'relevance',
        campaigns: campaignsA,
        imageItemIds: ['12', '5', '8'],
    });

    const second = pagination.createStoreProductQueryFingerprint({
        filters,
        sort: 'relevance',
        campaigns: campaignsB,
        imageItemIds: ['8', '12', '5'],
    });

    assert.equal(first, second);
});

test('store product fingerprints still detect changed campaign values', () => {
    const base = {
        filters: {},
        sort: 'relevance',
        campaigns: [{
            target_type: 'all_products',
            discount_type: 'percentage',
            discount_value: 10,
        }],
        imageItemIds: ['1', '2'],
    };

    const changed = {
        ...base,
        campaigns: [{
            target_type: 'all_products',
            discount_type: 'percentage',
            discount_value: 15,
        }],
    };

    assert.notEqual(
        pagination.createStoreProductQueryFingerprint(base),
        pagination.createStoreProductQueryFingerprint(changed)
    );
});

test('encodes and decodes signed cursors', () => {
    const cursor = pagination.createCursor(
        123456,
        '18446744073709551615',
        SEED,
        QUERY_HASH,
        SECRET
    );

    assert.deepEqual(
        pagination.parseCursor(cursor, SEED, QUERY_HASH, SECRET),
        {
            score: 123456,
            id: '18446744073709551615',
        }
    );
});

test('rejects modified cursors', () => {
    const cursor = pagination.createCursor(
        123456, '789', SEED, QUERY_HASH, SECRET
    );

    const modified = `${cursor.slice(0, -1)}x`;

    assert.equal(
        pagination.parseCursor(modified, SEED, QUERY_HASH, SECRET),
        null
    );
});

test('rejects cursors with a different seed', () => {
    const cursor = pagination.createCursor(
        123456, '789', SEED, QUERY_HASH, SECRET
    );

    assert.equal(
        pagination.parseCursor(
            cursor,
            '12345678901234567890123456789012',
            QUERY_HASH,
            SECRET
        ),
        null
    );
});

test('rejects cursors with a different query', () => {
    const cursor = pagination.createCursor(
        123456, '789', SEED, QUERY_HASH, SECRET
    );

    const otherQueryHash = pagination.createQueryFingerprint({
        sort: 'price_asc',
    });

    assert.equal(
        pagination.parseCursor(cursor, SEED, otherQueryHash, SECRET),
        null
    );
});

test('rejects invalid cursors', () => {
    assert.equal(
        pagination.parseCursor(undefined, SEED, QUERY_HASH, SECRET),
        null
    );

    assert.equal(
        pagination.parseCursor('invalid', SEED, QUERY_HASH, SECRET),
        null
    );
});

test('rejects invalid seed and product IDs', () => {
    assert.throws(() =>
        pagination.createCursor(123, '789', 'invalid', QUERY_HASH, SECRET)
    );

    assert.throws(() =>
        pagination.createCursor(123, '0', SEED, QUERY_HASH, SECRET)
    );

    assert.throws(() =>
        pagination.getShuffleScoreExpression('invalid')
    );
});

test('creates a deterministic MySQL shuffle expression', () => {
    const expression = pagination.getShuffleScoreExpression(SEED);

    assert.match(expression.val, /CRC32/);
    assert.match(expression.val, new RegExp(SEED));
    assert.match(expression.val, /items\.id/);
});
