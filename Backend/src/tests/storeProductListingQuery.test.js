'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    getEligibleProductPage,
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
    });

    assert.match(captured.sql, /items\.is_active = 1/);
    assert.match(captured.sql, /item_variants/);
    assert.match(captured.sql, /candidate\.variant_id = priced_variants\.id/);
    assert.match(captured.sql, /parent_price\.variant_id IS NULL/);
    assert.match(captured.sql, /candidate\.price_type = 'selling'/);
    assert.match(captured.sql, /candidate\.currency = 'LKR'/);
    assert.match(captured.sql, /candidate\.is_active = 1/);
    assert.match(captured.sql, /effective_from <= :now/);
    assert.match(captured.sql, /effective_to >= :now/);
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
