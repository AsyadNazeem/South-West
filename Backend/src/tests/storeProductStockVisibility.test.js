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

function loadController() {
    const variant = {
        id: 15,
        item_id: 9,
        variant_sku: 'TEST-001',
        variant_name: 'Standard',
        attributes: {},
        is_default: true,
        is_active: true,
    };

const item = {
    id: 9,
    item_name: 'Never Stocked Product',
    category_id: 2,
    item_type_id: 3,
    images: [{
        id: 1,
        file_path: 'items/images/test-product.jpg',
        url: 'items/images/test-product.jpg',
        is_primary: true,
        sort_order: 0,
    }],
};

    return proxyquire('../controllers/storeProductController', {
        '../models': {
Item: {
    async findAll() {
        return [{
            ...item,
            toJSON() {
                return { ...item };
            },
        }];
    },
    async findOne() { return item; },
},
            Brand: {}, Category: {}, Warranty: {},
            ItemVariant: {
                async findAll() { return [variant]; },
                async findByPk() { return { id: 15, colors: [] }; },
            },
ItemPrice: {
    async findOne() {
        return { id: 1, price: 1000, currency: 'LKR' };
    },
    async findAll() {
        return [{
            id: 1,
            item_id: 9,
            variant_id: 15,
            price: 1000,
            currency: 'LKR',
            effective_from: new Date('2026-01-01'),
            effective_to: null,
        }];
    },
},
            ItemPaymentPrice: {
                async findAll() { return []; },
            },
            ItemImage: {},
            ItemSpecificationValue: {},
            ItemSpecification: {},
            InventoryStock: {
                async findAll() { return []; },
            },
            InventoryLocation: {},
ProductReview: {
    async findAll() {
        return [];
    },
},
            ItemColor: {},
            sequelize: {},
        },
        '../utils/storeProductListingQuery': {
            getEligibleProductPage: async () => [
                { id: 9, shuffle_score: 123 },
            ],
            getEligibleBrandIds: async () => [],
        },
        '../utils/productStockHistory': {
            getProductsWithStockEvidence: async () => new Set(),
            getAllProductsWithValidImages: async () => new Set(['9']),
            getProductsWithValidImages: async () => new Set(['9']),
        },
        '../utils/customerProductEligibility': {
            hasCustomerVisibleProduct: async () => true,
            getEligibleCustomerVariantIds: async () => new Set(['15']),
        },
'../services/discountCampaignService': {
    getActiveCampaigns: async () => [],
    getBestVisualCampaignForItem: async () => null,
},
        '../utils/fileStorage': {
            getResponsiveImageMetadata: async () => [],
            buildFileUrl: value => value,
            isValidUploadedImagePath: async () => true,
        },
    });
}

test('public product listings include never-stocked products when otherwise eligible', async () => {
    const controller = loadController();
    const res = response();

    await controller.getStoreProducts({ query: {} }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].id, 9);
});

test('direct customer variant endpoint exposes eligible never-stocked products as out of stock', async () => {
    const controller = loadController();
    const res = response();

    await controller.getStoreProductVariants({ params: { id: '9' } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].id, 15);
    assert.equal(res.body.data[0].available_quantity, 0);
    assert.equal(res.body.data[0].in_stock, false);
});
