'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    getEligibleProductPage,
    getEligibleBrandIds,
} = require('../utils/storeProductListingQuery');

const SEED = 'abcdef0123456789abcdef0123456789';

test('queries only eligible active products with valid selling prices', async () => {
    let captured;

    const sequelize = {
        async query(sql, options) {
            captured = { sql, options };
            return [];
        },
    };

    await getEligibleProductPage({
        sequelize,
        seed: SEED,
        limit: 20,
        imageItemIds: ['3', '4'],
    });

    assert.match(captured.sql, /items\.is_active = 1/);
    assert.match(captured.sql, /items\.id IN \(:imageItemIds\)/);
    assert.doesNotMatch(captured.sql, /inventory_stock_movements|inventory_stock/);
    assert.match(captured.sql, /item_variants/);
    assert.match(captured.sql, /eligible_price\.price_type = 'selling'/);
    assert.match(captured.sql, /eligible_price\.currency = 'LKR'/);
    assert.match(captured.sql, /eligible_price\.is_active = 1/);
    assert.match(captured.sql, /eligible_price\.price > 0/);
    assert.match(captured.sql, /eligible_price\.effective_from <= :now/);
    assert.match(captured.sql, /eligible_price\.effective_to >= :now/);
    assert.deepEqual(captured.options.replacements.imageItemIds, ['3', '4']);
    assert.equal(captured.options.replacements.limit, 21);
});

test('uses deterministic shuffle ordering and cursor continuation', async () => {
    let captured;

    const sequelize = {
        async query(sql, options) {
            captured = { sql, options };
            return [];
        },
    };

    await getEligibleProductPage({
        sequelize,
        seed: SEED,
        limit: 25,
        cursor: {
            score: 123456,
            id: '987654321012345678',
        },
    });

    assert.match(captured.sql, /CRC32\(CONCAT/);
    assert.match(captured.sql, /ORDER BY shuffle_score ASC, items\.id ASC/);
    assert.match(captured.sql, /CRC32\(CONCAT\([\s\S]*?\)\) > :cursorScore/);
    assert.match(captured.sql, /items\.id > :cursorId/);
    assert.equal(captured.options.replacements.cursorScore, 123456);
    assert.equal(captured.options.replacements.cursorId, '987654321012345678');
    assert.equal(captured.options.replacements.limit, 26);
});

test('does not add cursor conditions to the first page', async () => {
    let captured;

    const sequelize = {
        async query(sql, options) {
            captured = { sql, options };
            return [];
        },
    };

    await getEligibleProductPage({
        sequelize,
        seed: SEED,
        limit: 20,
    });

    assert.doesNotMatch(captured.sql, /cursorScore/);
    assert.doesNotMatch(captured.sql, /cursorId/);
});

test('rejects invalid shuffle seeds before querying', async () => {
    let queried = false;

    const sequelize = {
        async query() {
            queried = true;
            return [];
        },
    };

    await assert.rejects(
        getEligibleProductPage({
            sequelize,
            seed: 'invalid',
            limit: 20,
        })
    );

    assert.equal(queried, false);
});

test('returns no customer products when there are no valid uploaded image ids', async () => {
    let captured;
    await getEligibleProductPage({
        sequelize: { async query(sql, options) { captured = { sql, options }; return []; } },
        seed: SEED,
        limit: 20,
        imageItemIds: [],
    });
    assert.match(captured.sql, /AND 1 = 0/);
    assert.equal(captured.options.replacements.imageItemIds, undefined);
});

test('top-rated listing ranks eligible items by approved rating and review count with a bounded page', async () => {
    let captured;
    const rankedRows = [
        { id: 8, rating: 5, review_count: 4 },
        { id: 3, rating: 5, review_count: 2 },
        { id: 12, rating: 4, review_count: 1 },
    ];
    const sequelize = {
        async query(sql, options) {
            captured = { sql, options };
            return rankedRows;
        },
    };

    const rows = await getEligibleProductPage({
        sequelize,
        seed: SEED,
        limit: 12,
        sort: 'top_rated',
        filters: { minRating: 4 },
    });

    assert.deepEqual(rows, rankedRows);
    assert.match(captured.sql, /INNER JOIN \([\s\S]*AVG\(rating\)[\s\S]*COUNT\(\*\)[\s\S]*FROM product_reviews[\s\S]*WHERE status = 'approved'/);
    assert.match(captured.sql, /approved_review_summary\.rating >= :minRating/);
    assert.match(captured.sql, /ORDER BY approved_review_summary\.rating DESC, approved_review_summary\.review_count DESC, items\.id ASC/);
    assert.doesNotMatch(captured.sql, /LEFT JOIN/);
    assert.equal(captured.options.replacements.minRating, 4);
    assert.equal(captured.options.replacements.limit, 13);
    assert.equal(rows.some(row => row.rating == null), false);
});

test('eligible brand ids use the same active-product and current selling-price rules as the storefront listing', async () => {
    let captured;
    const sequelize = {
        async query(sql, options) {
            captured = { sql, options };
            return [{ brand_id: 4 }, { brand_id: 9 }];
        },
    };

    const ids = await getEligibleBrandIds({ sequelize, now: new Date('2026-11-07T00:00:00Z'), imageItemIds: ['3', '4'] });

    assert.deepEqual(ids, [4, 9]);
    assert.match(captured.sql, /SELECT DISTINCT items\.brand_id/);
    assert.match(captured.sql, /items\.is_active = 1/);
    assert.match(captured.sql, /items\.brand_id IS NOT NULL/);
    assert.doesNotMatch(captured.sql, /inventory_stock_movements|inventory_stock/);
    assert.match(captured.sql, /items\.id IN \(:imageItemIds\)/);
    assert.match(captured.sql, /eligible_variant\.is_active = 1/);
    assert.match(captured.sql, /eligible_price\.price_type = 'selling'/);
    assert.match(captured.sql, /eligible_price\.currency = 'LKR'/);
    assert.match(captured.sql, /eligible_price\.is_active = 1/);
    assert.match(captured.sql, /eligible_price\.price > 0/);
    assert.match(captured.sql, /eligible_price\.effective_from <= :now/);
    assert.match(captured.sql, /eligible_price\.effective_to >= :now/);
    assert.equal(captured.options.replacements.now.toISOString(), '2026-11-07T00:00:00.000Z');
});
