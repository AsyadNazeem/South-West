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

function loadController(withSecondVariant = false) {
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

    const variants = withSecondVariant ? [variant, { ...variant, id: 16, is_default: false }] : [variant];
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
                async findAll() { return variants; },
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
            ItemTypeSpecification: {
                async findAll(query) {
                    assert.equal(query.where.item_type_id, item.item_type_id);
                    assert.deepEqual(query.include[0].where, { is_active: true, data_type: 'select' });
                    return [{ specification: { name: 'Interface', options: [] } },
                        { specification: { name: 'Connector Type', options: ['USB', '3.5MM'] } }];
                }
            },
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
            getEligibleCustomerVariantIds: async () => new Set(variants.map(v => String(v.id))),
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


test('public variant response retains SKU rows and adds only ordered Select names with saved options', async () => {
    const res = response();
    await loadController(true).getStoreProductVariants({ params: { id: '9' } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.data.map(v => v.id), [15, 16]);
    assert.deepEqual(res.body.preferred_attributes, ['Connector Type']);
});
