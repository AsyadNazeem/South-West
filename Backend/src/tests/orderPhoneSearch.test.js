'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    buildOrderPhoneSearch,
    normalizePhoneSearch,
    phoneSearchVariants
} = require('../utils/orderPhoneSearch');

test('normalizes full, partial, spaced, and hyphenated phone searches', () => {
    assert.equal(normalizePhoneSearch('0768094431'), '0768094431');
    assert.equal(normalizePhoneSearch('07680'), '07680');
    assert.equal(normalizePhoneSearch('+94 76-809 4431'), '94768094431');
    assert.equal(normalizePhoneSearch('076-80'), '07680');
});

test('matches equivalent Sri Lankan local and international forms', () => {
    assert.deepEqual(
        phoneSearchVariants('0768094431'),
        ['0768094431', '94768094431']
    );
    assert.deepEqual(
        phoneSearchVariants('+94 76 809 4431'),
        ['94768094431', '0768094431']
    );
    assert.deepEqual(phoneSearchVariants('76809'), ['76809']);
});

test('does not reinterpret names or order references as phone searches', () => {
    assert.equal(normalizePhoneSearch('Asha Perera'), null);
    assert.equal(normalizePhoneSearch('SWO-1234'), null);
    assert.equal(normalizePhoneSearch('12'), null);
});

test('uses the shipping snapshot and only then the linked customer fallback', () => {
    const search = buildOrderPhoneSearch('+94 76-809 4431', {
        orderAlias: 'order',
        replacementPrefix: 'testPhone'
    });
    const sql = search.condition.val;

    assert.match(sql, /FROM `order_addresses`/);
    assert.match(sql, /`address_type` = 'shipping'/);
    assert.match(sql, /NOT EXISTS[\s\S]*FROM `customers`/);
    assert.match(sql, /`testPhoneCustomer`\.`id` = `order`\.`customer_id`/);
    assert.deepEqual(search.replacements, {
        testPhone0: '%94768094431%',
        testPhone1: '%0768094431%'
    });
    assert.doesNotMatch(sql, /94768094431|0768094431/);
});

test('delivery search can include its saved recipient phone without changing fallback rules', () => {
    const search = buildOrderPhoneSearch('07680', {
        orderAlias: 'order',
        directPhoneColumns: ['Delivery.recipient_phone'],
        replacementPrefix: 'deliveryPhone'
    });

    assert.match(search.condition.val, /`Delivery`\.`recipient_phone`/);
    assert.deepEqual(search.variants, ['07680', '947680']);
});
