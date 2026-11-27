'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();
const { Op } = require('sequelize');

function createHarness(options = {}) {
    const calls = {
        list: [],
        counts: [],
        updates: [],
        audits: [],
        deletes: 0,
    };

    const review = {
        id: 101,
        item_id: 10,
        customer_id: null,
        guest_name: 'John Smith',
        guest_number: '482731',
        display_name: true,
        rating: 5,
        status: 'pending',
        is_verified_purchase: false,
        images: [],

        async update(values) {
            calls.updates.push(values);
            Object.assign(this, values);
        },

        async destroy() {
            calls.deletes++;
        },
    };

    const controller = proxyquire(
        '../controllers/productReviewController',
        {
            '../models': {
                ProductReview: {
                    async count(query) {
                        calls.counts.push(query);
                        return 1;
                    },
                    async findAndCountAll(query) {
                        calls.list.push(query);
                        return { count: 1, rows: [review] };
                    },
                    async findByPk() {
                        return options.missing ? null : review;
                    },
                },
                ProductReviewImage: {
                    async findAll() {
                        return [];
                    },
                },
                Item: {},
                Customer: {},
                Order: {},
            },

            '../services/auditLogService': {
                async recordAuditLog(values) {
                    calls.audits.push(values);
                },
            },

            './adminNotificationController': {
                async notifyAdmins() {},
            },

            '../utils/fileStorage': {
                buildFileUrl(value) {
                    return value;
                },
                async removeStoredImage() {
                    return { status: 'success' };
                },
            },
        }
    );

    const req = {
        user: { id: 1 },
        params: { id: '101' },
        query: options.query || {},
        body: options.body || {},
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

    return { controller, req, res, calls, review };
}

test('Admin search includes visible guest names', async () => {
    const h = createHarness({
        query: { search: 'John Smith' },
    });

    await h.controller.getAllProductReviews(h.req, h.res);

    assert.equal(h.res.statusCode, 200);

    const conditions = h.calls.list[0].where[Op.or];

    const nameCondition = conditions.find(
        condition => condition.guest_name
    );

    assert.ok(nameCondition);
    assert.equal(
        nameCondition.guest_name[Op.like],
        '%John Smith%'
    );
    assert.equal(nameCondition.display_name, true);

    assert.equal(h.res.body.data[0].guest_name, 'John Smith');
});

test('Admin search supports plain guest numbers', async () => {
    const h = createHarness({
        query: { search: '482731' },
    });

    await h.controller.getAllProductReviews(h.req, h.res);

    assert.equal(h.res.statusCode, 200);

    const condition = h.calls.list[0].where[Op.or].find(
        value => value.guest_number
    );

    assert.ok(condition);
    assert.equal(condition.guest_number[Op.like], '%482731%');
});

test('Admin search supports formatted guest labels', async () => {
    const h = createHarness({
        query: { search: 'Guest #482731' },
    });

    await h.controller.getAllProductReviews(h.req, h.res);

    assert.equal(h.res.statusCode, 200);

    const condition = h.calls.list[0].where[Op.or].find(
        value => value.guest_number
    );

    assert.ok(condition);
    assert.equal(condition.guest_number[Op.like], '%482731%');
});

test('Admin guest search preserves existing search fields', async () => {
    const h = createHarness({
        query: { search: 'Example' },
    });

    await h.controller.getAllProductReviews(h.req, h.res);

    assert.equal(h.res.statusCode, 200);

    const conditions = h.calls.list[0].where[Op.or];

    for (const field of [
        'review_title',
        'review_text',
        '$item.item_name$',
        '$customer.first_name$',
        '$customer.last_name$',
    ]) {
        const condition = conditions.find(value => value[field]);

        assert.ok(condition, `Missing search field: ${field}`);
        assert.equal(condition[field][Op.like], '%Example%');
    }
});

test('Admin guest search preserves filters and rating counts', async () => {
    const h = createHarness({
        query: {
            search: 'John',
            status: 'pending',
            rating: '5',
            page: '2',
            pageSize: '10',
        },
    });

    await h.controller.getAllProductReviews(h.req, h.res);

    assert.equal(h.res.statusCode, 200);

    const query = h.calls.list[0];

    assert.equal(query.where.status, 'pending');
    assert.equal(query.where.rating, 5);
    assert.equal(query.limit, 10);
    assert.equal(query.offset, 10);

    assert.equal(h.calls.counts.length, 5);

    for (const count of h.calls.counts) {
        assert.equal(count.where.status, 'pending');

        const condition = count.where[Op.or].find(
            value => value.guest_name
        );

        assert.ok(condition);
        assert.equal(condition.guest_name[Op.like], '%John%');
        assert.equal(condition.display_name, true);
    }

    assert.deepEqual(
        h.calls.counts.map(value => value.where.rating).sort(),
        [1, 2, 3, 4, 5]
    );
});

test('Admin can approve a named guest without changing identity', async () => {
    const h = createHarness({
        body: { status: 'approved' },
    });

    await h.controller.updateProductReview(h.req, h.res);

    assert.equal(h.res.statusCode, 200);
    assert.equal(h.review.status, 'approved');
    assert.equal(h.review.guest_name, 'John Smith');
    assert.equal(h.review.guest_number, '482731');
    assert.equal(h.review.display_name, true);
    assert.equal(h.review.is_verified_purchase, false);
    assert.deepEqual(h.calls.updates, [{ status: 'approved' }]);
});

test('Admin can reject a named guest without changing identity', async () => {
    const h = createHarness({
        body: { status: 'rejected' },
    });

    await h.controller.updateProductReview(h.req, h.res);

    assert.equal(h.res.statusCode, 200);
    assert.equal(h.review.status, 'rejected');
    assert.equal(h.review.guest_name, 'John Smith');
    assert.equal(h.review.guest_number, '482731');
    assert.equal(h.review.display_name, true);
    assert.deepEqual(h.calls.updates, [{ status: 'rejected' }]);
});

test('Admin rejects invalid moderation status', async () => {
    const h = createHarness({
        body: { status: 'invalid-status' },
    });

    await h.controller.updateProductReview(h.req, h.res);

    assert.equal(h.res.statusCode, 400);
    assert.equal(h.calls.updates.length, 0);
    assert.equal(h.review.status, 'pending');
});

test('Admin can delete a named guest review', async () => {
    const h = createHarness();

    await h.controller.deleteProductReview(h.req, h.res);

    assert.equal(h.res.statusCode, 200);
    assert.equal(h.calls.deletes, 1);
});

test('Admin moderation handles a missing review', async () => {
    const h = createHarness({
        missing: true,
        body: { status: 'approved' },
    });

    await h.controller.updateProductReview(h.req, h.res);

    assert.equal(h.res.statusCode, 404);
    assert.equal(h.calls.updates.length, 0);
});
