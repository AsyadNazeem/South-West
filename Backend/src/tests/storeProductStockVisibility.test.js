'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();

function response() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
    };
}

function loadController({ stocked = false } = {}) {
    return proxyquire('../controllers/storeProductController', {
        '../models': {
            Item: {
                async findAll() { return [{ id: 9 }]; },
                async findOne() { return { id: 9, category_id: 2, item_type_id: 3 }; },
            },
            Brand: {}, Category: {}, Warranty: {}, ItemVariant: {}, ItemPrice: {},
            ItemPaymentPrice: {}, ItemImage: {}, ItemSpecificationValue: {}, ItemSpecification: {},
            InventoryStock: {}, InventoryLocation: {}, ProductReview: {}, ItemColor: {}, sequelize: {},
        },
        '../utils/storeProductListingQuery': {
            getEligibleProductPage: async () => [],
            getEligibleBrandIds: async () => [],
        },
        '../utils/productStockHistory': {
            getProductsWithStockEvidence: async ids => stocked ? new Set(ids.map(String)) : new Set(),
            getAllProductsWithValidImages: async () => new Set(['9']),
            getProductsWithValidImages: async ids => new Set(ids.map(String)),
        },
        '../utils/customerProductEligibility': {
            hasCustomerVisibleProduct: async () => stocked,
            getEligibleCustomerVariantIds: async () => new Set(),
        },
        '../services/discountCampaignService': { getActiveCampaigns: async () => [] },
        '../utils/fileStorage': { getResponsiveImageMetadata: async () => [], buildFileUrl: value => value, isValidUploadedImagePath: async () => true },
    });
}

test('public product listings exclude never-stocked products even if active', async () => {
    const controller = loadController();
    const res = response();
    await controller.getStoreProducts({ query: {} }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.data, []);
});

test('the direct customer variant endpoint also hides never-stocked products', async () => {
    const controller = loadController();
    const res = response();
    await controller.getStoreProductVariants({ params: { id: '9' } }, res);
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, 'Product not found');
});
