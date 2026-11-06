'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();

function createHarness(options = {}) {
    const calls = {
        create: [],
        duplicateQueries: [],
        guestNumberQueries: [],
        purchaseQueries: [],
        publicReviewQuery: null,
        summaryQuery: null,
    };

    const models = {
        ProductReview: {
            async findOne(query) {
                if (query.where?.guest_number) {
                    calls.guestNumberQueries.push(query);
                    return options.existingGuestNumber ?? null;
                }

                if (query.where?.customer_id) {
                    calls.duplicateQueries.push(query);
                    return options.existingReview ?? null;
                }

                calls.summaryQuery = query;
                return options.summary ?? null;
            },

            async findAll(query) {
                calls.publicReviewQuery = query;
                return options.publicReviews ?? [];
            },

            async create(values) {
                calls.create.push(values);
                return {
                    id: 101,
                    ...values,
                    created_at: new Date('2026-11-06T00:00:00Z'),
                };
            },
        },

        Item: {
            async findByPk() {
                return options.itemMissing ? null : { id: 10 };
            },
        },

        Customer: {},
        Order: {},

        OrderItem: {
            async findOne(query) {
                calls.purchaseQueries.push(query);
                return options.purchasedOrderItem ?? null;
            },
        },
    };

    const controller = proxyquire(
        '../controllers/customerProductReviewController',
        {
            '../models': models,
            '../controllers/adminNotificationController': {
                async notifyAdmins() {}
            },
            '../services/auditLogService': {
                async recordAuditLog() {}
            }
        }
    );

    const req = {
        customer: options.customer ?? undefined,
        params: { itemId: '10' },
        body: {
            item_id: 10,
            rating: 5,
            review_title: 'Great product',
            review_text: 'Works exactly as expected.',
            ...options.body,
        },
        get() {
            return 'node-test';
        },
    };

    const res = {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
    };

    return { controller, req, res, calls };
}

test('guest can submit a review without providing identity details', async () => {
    const h = createHarness();

    await h.controller.createCustomerReview(h.req, h.res);

    assert.equal(h.res.statusCode, 201);
    assert.equal(h.calls.create.length, 1);

    const saved = h.calls.create[0];

    assert.equal(saved.customer_id, null);
    assert.match(saved.guest_number, /^\d{6}$/);
    assert.equal(saved.display_name, false);
    assert.equal(saved.status, 'pending');
    assert.equal(saved.is_verified_purchase, false);
    assert.equal(saved.order_id, null);
    assert.match(h.res.body.data.reviewer_name, /^Guest #\d{6}$/);
});

test('guest cannot choose identity, approval status or verification', async () => {
    const h = createHarness({
        body: {
            guest_number: '123456',
            display_name: true,
            customer_id: 99,
            is_verified_purchase: true,
            status: 'approved',
        },
    });

    await h.controller.createCustomerReview(h.req, h.res);

    assert.equal(h.res.statusCode, 201);

    const saved = h.calls.create[0];

    assert.notEqual(saved.guest_number, '123456');
    assert.equal(saved.display_name, false);
    assert.equal(saved.customer_id, null);
    assert.equal(saved.status, 'pending');
    assert.equal(saved.is_verified_purchase, false);
});

test('guest number generation checks for an existing number', async () => {
    const h = createHarness();

    await h.controller.createCustomerReview(h.req, h.res);

    assert.equal(h.res.statusCode, 201);
    assert.equal(h.calls.guestNumberQueries.length, 1);
    assert.deepEqual(
        h.calls.guestNumberQueries[0].where,
        { guest_number: h.calls.create[0].guest_number }
    );
});

test('authenticated customer defaults to masked name', async () => {
    const h = createHarness({
        customer: { id: 25 },
    });

    await h.controller.createCustomerReview(h.req, h.res);

    assert.equal(h.res.statusCode, 201);
    assert.equal(h.calls.create[0].customer_id, 25);
    assert.equal(h.calls.create[0].guest_number, null);
    assert.equal(h.calls.create[0].display_name, false);
    assert.equal(h.calls.create[0].status, 'pending');
});

test('authenticated customer can opt to display full name', async () => {
    const h = createHarness({
        customer: { id: 25 },
        body: { display_name: true },
    });

    await h.controller.createCustomerReview(h.req, h.res);

    assert.equal(h.res.statusCode, 201);
    assert.equal(h.calls.create[0].display_name, true);
});

test('authenticated customer duplicate review is rejected', async () => {
    const h = createHarness({
        customer: { id: 25 },
        existingReview: { id: 55 },
    });

    await h.controller.createCustomerReview(h.req, h.res);

    assert.equal(h.res.statusCode, 409);
    assert.equal(h.calls.create.length, 0);
    assert.deepEqual(h.calls.duplicateQueries[0].where, {
        item_id: 10,
        customer_id: 25,
    });
});

test('delivered purchase is marked as verified', async () => {
    const h = createHarness({
        customer: { id: 25 },
        purchasedOrderItem: { order_id: 80 },
    });

    await h.controller.createCustomerReview(h.req, h.res);

    assert.equal(h.res.statusCode, 201);
    assert.equal(h.calls.create[0].order_id, 80);
    assert.equal(h.calls.create[0].is_verified_purchase, true);
    assert.equal(h.calls.purchaseQueries.length, 1);
    assert.equal(h.calls.purchaseQueries[0].include[0].where.status, 'delivered');
});

test('customer without a delivered purchase is not verified', async () => {
    const h = createHarness({
        customer: { id: 25 },
        purchasedOrderItem: null,
    });

    await h.controller.createCustomerReview(h.req, h.res);

    assert.equal(h.res.statusCode, 201);
    assert.equal(h.calls.create[0].order_id, null);
    assert.equal(h.calls.create[0].is_verified_purchase, false);
});

test('public guest review exposes guest label but not internal guest number', async () => {
    const h = createHarness({
        publicReviews: [{
            id: 7,
            customer_id: null,
            guest_number: '482731',
            display_name: false,
            rating: 5,
            review_title: 'Great',
            review_text: 'Excellent product.',
            is_verified_purchase: false,
            created_at: new Date('2026-11-06T00:00:00Z'),
        }],
    });

    await h.controller.getProductReviews(h.req, h.res);

    assert.equal(h.res.statusCode, 200);
    assert.ok(h.calls.publicReviewQuery.attributes.includes('guest_number'));
    assert.ok(h.calls.publicReviewQuery.attributes.includes('display_name'));

    const review = h.res.body.data.reviews[0];

    assert.equal(review.reviewer_name, 'Guest #482731');
    assert.equal('guest_number' in review, false);
    assert.equal('customer_id' in review, false);
    assert.equal('display_name' in review, false);
    assert.equal('customer' in review, false);
});

test('public registered review masks first and last names by default', async () => {
    const h = createHarness({
        publicReviews: [{
            id: 8,
            customer_id: 25,
            guest_number: null,
            display_name: false,
            rating: 5,
            customer: {
                first_name: 'Mohamad',
                last_name: 'Asyad',
            },
        }],
    });

    await h.controller.getProductReviews(h.req, h.res);

    assert.equal(
        h.res.body.data.reviews[0].reviewer_name,
        'M*****d A***d'
    );
});

test('public registered review displays full name when opted in', async () => {
    const h = createHarness({
        publicReviews: [{
            id: 9,
            customer_id: 25,
            guest_number: null,
            display_name: true,
            rating: 5,
            customer: {
                first_name: 'Mohamad',
                last_name: 'Asyad',
            },
        }],
    });

    await h.controller.getProductReviews(h.req, h.res);

    assert.equal(
        h.res.body.data.reviews[0].reviewer_name,
        'Mohamad Asyad'
    );
});
