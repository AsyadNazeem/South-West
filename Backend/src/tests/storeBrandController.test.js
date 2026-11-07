'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const proxyquire = require('proxyquire').noCallThru();

function response() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
    };
}

test('returns only active brands with eligible products, preserving order and image fallback data', async () => {
    const eligibleBrandIds = [1, 3, 4];
    const allBrands = [
        { id: 1, name: 'Alpha', is_active: true, image_url: '/uploads/alpha.webp' },
        { id: 2, name: 'No sellable products', is_active: true, image_url: null },
        { id: 3, name: 'Inactive', is_active: false, image_url: '/uploads/inactive.webp' },
        { id: 4, name: 'Zulu', is_active: true, image_url: null },
    ];
    let queryOptions;
    const controller = proxyquire('../controllers/storeBrandController', {
        '../models': {
            Brand: {
                async findAll(options) {
                    queryOptions = options;
                    const ids = options.where.id[Op.in];
                    return allBrands
                        .filter(brand => brand.is_active && ids.includes(brand.id))
                        .sort((a, b) => a.name.localeCompare(b.name));
                },
            },
            sequelize: {},
        },
        '../utils/storeProductListingQuery': {
            getEligibleBrandIds: async () => eligibleBrandIds,
        },
        '../utils/fileStorage': {
            getResponsiveImageMetadata: async image => image ? [{ width: 320, url: `${image}?w=320` }] : [],
        },
    });

    const res = response();
    await controller.getStoreBrands({}, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.data.map(brand => brand.name), ['Alpha', 'Zulu']);
    assert.equal(queryOptions.where.is_active, true);
    assert.deepEqual(queryOptions.where.id[Op.in], eligibleBrandIds);
    assert.deepEqual(queryOptions.order, [['name', 'ASC']]);
    assert.equal(res.body.data[0].image_url, '/uploads/alpha.webp');
    assert.deepEqual(res.body.data[0].responsive_images, [{ width: 320, url: '/uploads/alpha.webp?w=320' }]);
    assert.equal(res.body.data[1].image_url, null);
    assert.deepEqual(res.body.data[1].responsive_images, []);
});

test('returns no brands when no eligible publicly sellable products have brands', async () => {
    let options;
    const controller = proxyquire('../controllers/storeBrandController', {
        '../models': {
            Brand: { async findAll(value) { options = value; return []; } },
            sequelize: {},
        },
        '../utils/storeProductListingQuery': { getEligibleBrandIds: async () => [] },
        '../utils/fileStorage': { getResponsiveImageMetadata: async () => [] },
    });
    const res = response();
    await controller.getStoreBrands({}, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.data, []);
    assert.deepEqual(options.where.id[Op.in], []);
});
