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

function createController(eligibleRows) {
    const calls = { eligible: null, eligibleOrder: null, reviewOptions: null, itemFindOrder: null };
    const item = (id, name) => ({
        id,
        toJSON: () => ({
            id,
            public_id: `public-${id}`,
            slug: `product-${id}`,
            item_name: name,
            item_code: `SKU-${id}`,
            brand_id: 1,
            images: [],
            specificationValues: [],
        }),
    });
    const itemModels = [item(3, 'Lower rated'), item(8, 'Top rated')];
    const models = {
        sequelize: {},
        Item: {
            async findAll() {
                calls.itemFindOrder = itemModels.map(model => model.id);
                return itemModels;
            },
        },
        ItemVariant: { async findAll() { return []; } },
        ItemPrice: {
            async findAll() {
                return [
                    { item_id: 8, variant_id: null, price: 100, currency: 'LKR' },
                    { item_id: 3, variant_id: null, price: 200, currency: 'LKR' },
                ];
            },
        },
        InventoryStock: { async findAll() { return []; } },
        ProductReview: {
            async findAll(options) {
                calls.reviewOptions = options;
                return [
                    { item_id: 8, rating: 5 },
                    { item_id: 8, rating: 4 },
                    { item_id: 3, rating: 4 },
                ];
            },
        },
        Brand: {}, Category: {}, Warranty: {}, ItemImage: {},
        ItemSpecificationValue: {}, ItemSpecification: {},
        InventoryLocation: {}, ItemPaymentPrice: {}, ItemColor: {},
    };
    const controller = proxyquire('../controllers/storeProductController', {
        '../models': models,
        '../utils/storeProductListingQuery': {
            getEligibleProductPage: async options => {
                calls.eligible = options;
                calls.eligibleOrder = eligibleRows.map(row => row.id);
                return eligibleRows;
            },
        },
        '../services/discountCampaignService': {
            getActiveCampaigns: async () => [],
            campaignTargetsItem: () => false,
            calculateDiscount: () => ({}),
            getBestVisualCampaignForItem: () => null,
        },
        '../utils/fileStorage': {
            buildFileUrl: value => value,
            getResponsiveImageMetadata: async () => [],
        },
    });
    return { controller, calls };
}

test('top-rated endpoint delegates to eligible-product sorting and preserves full store product shape and ranking', async () => {
    const { controller, calls } = createController([
        { id: 8, shuffle_score: null, sort_value: null, rating: 4.5, review_count: 2 },
        { id: 3, shuffle_score: null, sort_value: null, rating: 4, review_count: 1 },
    ]);
    const res = response();

    await controller.getTopRatedStoreProducts({ query: { limit: '12' } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(calls.eligible.sort, 'top_rated');
    assert.equal(calls.eligible.filters.minRating, 4);
    assert.equal(calls.eligible.limit, 12);
    assert.equal(calls.reviewOptions, null);
    assert.deepEqual(calls.eligibleOrder, [8, 3]);
    assert.deepEqual(calls.itemFindOrder, [3, 8]);
    assert.deepEqual(res.body.data.map(product => product.id), [8, 3]);
    assert.deepEqual(res.body.data.map(product => product.rating), [4.5, 4]);
    assert.deepEqual(res.body.data.map(product => product.review_count), [2, 1]);
    assert.deepEqual(res.body.data.map(product => product.price), [100, 200]);
    assert.equal(res.body.data[0].images.length, 0);
    assert.equal(Object.hasOwn(res.body, 'pagination'), false);
});

test('top-rated endpoint defaults to 12 and clamps oversized limits to the product listing maximum', async () => {
    const defaultController = createController([]);
    await defaultController.controller.getTopRatedStoreProducts({ query: {} }, response());
    assert.equal(defaultController.calls.eligible.limit, 12);

    const cappedController = createController([]);
    await cappedController.controller.getTopRatedStoreProducts({ query: { limit: '1000' } }, response());
    assert.equal(cappedController.calls.eligible.limit, 25);
});

test('dedicated top-rated route is registered before parameterized product routes', () => {
    const routes = [];
    const router = { get: (...args) => routes.push(args) };
    proxyquire('../routes/storeProductRoutes', {
        express: { Router: () => router },
        '../controllers/storeProductController': {
            getStoreProducts() {},
            getTopRatedStoreProducts() {},
            getRelatedStoreProducts() {},
            getStoreProductFilters() {},
            getStoreProductVariants() {},
        },
    });
    const ratedRouteIndex = routes.findIndex(([path]) => path === '/top-rated');
    const relatedRouteIndex = routes.findIndex(([path]) => path === '/:id/related');
    assert.ok(ratedRouteIndex >= 0);
    assert.ok(ratedRouteIndex < relatedRouteIndex);
});
