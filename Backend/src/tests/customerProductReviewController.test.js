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
            associations: { images: options.reviewImagesAssociation },
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

test('my reviews joins photos by review ID and returns public images or an empty array', async t => {
    const express = require('express');
    const fs = require('node:fs/promises');
    const path = require('node:path');
    const os = require('node:os');
    const { once } = require('node:events');
    const { ProductReview, ProductReviewImage } = require('../models');
    const { UPLOAD_ROOT } = require('../utils/fileStorage');

    const photos = ProductReview.associations.images;
    assert.equal(photos.target, ProductReviewImage);
    assert.equal(photos.sourceKey, 'id');
    assert.equal(photos.foreignKey, 'product_review_id');
    assert.equal(ProductReviewImage.associations.review.target, ProductReview);
    assert.equal(ProductReviewImage.associations.review.foreignKey, 'product_review_id');

    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'review-images-'));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const folder = 'reviews/images';
    await fs.mkdir(path.join(directory, folder), { recursive: true });
    const sharp = require('sharp');
    for (const color of ['red', 'blue']) {
        await sharp({ create: { width: 2, height: 2, channels: 3, background: color } })
            .webp().toFile(path.join(directory, folder, color + '.webp'));
    }
    const app = express();
    app.use('/uploads', express.static(directory));
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise(resolve => server.close(resolve)));
    const origin = 'http://127.0.0.1:' + server.address().port;
    const previousBase = process.env.FILE_BASE_URL;
    process.env.FILE_BASE_URL = origin;
    t.after(() => {
        if (previousBase === undefined) delete process.env.FILE_BASE_URL;
        else process.env.FILE_BASE_URL = previousBase;
    });

    const h = createHarness({
        customer: { id: 25 },
        reviewImagesAssociation: photos,
        publicReviews: [
            { toJSON: () => ({ id: 12, item_id: 40, images: [
                { id: 1, file_path: folder + '/red.webp' },
                { id: 2, file_path: path.join(UPLOAD_ROOT, folder, 'blue.webp') },
                { id: 3, file_path: '/private/missing.webp' },
            ] }) },
            { toJSON: () => ({ id: 13, item_id: 40, images: [] }) },
        ],
    });
    await h.controller.getMyReviews(h.req, h.res);
    const query = h.calls.publicReviewQuery;
    assert.deepEqual(query.where, { customer_id: 25 });
    assert.deepEqual(query.order, [['created_at', 'DESC']]);
    assert.equal(query.include[0].as, 'item');
    assert.deepEqual(query.include[1], {
        association: photos, attributes: ['id', 'file_path'], required: false,
    });
    const images = ['red', 'blue'].map((color, i) => ({
        id: i + 1, url: origin + '/uploads/' + folder + '/' + color + '.webp',
    }));
    assert.deepEqual(h.res.body, { data: [
        { id: 12, item_id: 40, images },
        { id: 13, item_id: 40, images: [] },
    ] });
    for (const image of h.res.body.data[0].images) {
        const response = await fetch(image.url);
        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-type'), /image\/webp/);
        const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
        assert.equal(metadata.format, 'webp');
    }
});


// Guest reviewer name regression tests

test('named guest review stores and returns the supplied name', async () => {
    const h = createHarness({
        body: {
            guest_name: '  John Smith  ',
            display_name: 'true',
        },
    });

    await h.controller.createCustomerReview(h.req, h.res);

    assert.equal(h.res.statusCode, 201);
    assert.equal(h.calls.create.length, 1);

    const saved = h.calls.create[0];

    assert.equal(saved.guest_name, 'John Smith');
    assert.equal(saved.display_name, true);
    assert.equal(saved.customer_id, null);
    assert.match(saved.guest_number, /^\d{6}$/);
    assert.equal(saved.status, 'pending');
    assert.equal(saved.is_verified_purchase, false);
    assert.equal(h.res.body.data.reviewer_name, 'John Smith');
});

test('unchecked guest name is discarded', async () => {
    const h = createHarness({
        body: {
            guest_name: 'John Smith',
            display_name: 'false',
        },
    });

    await h.controller.createCustomerReview(h.req, h.res);

    assert.equal(h.res.statusCode, 201);
    assert.equal(h.calls.create[0].guest_name, null);
    assert.equal(h.calls.create[0].display_name, false);
    assert.match(
        h.res.body.data.reviewer_name,
        /^Guest #\d{6}$/
    );
});

test('empty guest name falls back to guest number', async () => {
    const h = createHarness({
        body: {
            guest_name: '',
            display_name: true,
        },
    });

    await h.controller.createCustomerReview(h.req, h.res);

    assert.equal(h.res.statusCode, 201);
    assert.equal(h.calls.create[0].guest_name, null);
    assert.equal(h.calls.create[0].display_name, false);
    assert.match(
        h.res.body.data.reviewer_name,
        /^Guest #\d{6}$/
    );
});

test('whitespace-only guest name falls back to guest number', async () => {
    const h = createHarness({
        body: {
            guest_name: '   ',
            display_name: true,
        },
    });

    await h.controller.createCustomerReview(h.req, h.res);

    assert.equal(h.res.statusCode, 201);
    assert.equal(h.calls.create[0].guest_name, null);
    assert.equal(h.calls.create[0].display_name, false);
    assert.match(
        h.res.body.data.reviewer_name,
        /^Guest #\d{6}$/
    );
});

test('guest name of exactly 100 characters is accepted', async () => {
    const name = 'A'.repeat(100);

    const h = createHarness({
        body: {
            guest_name: name,
            display_name: true,
        },
    });

    await h.controller.createCustomerReview(h.req, h.res);

    assert.equal(h.res.statusCode, 201);
    assert.equal(h.calls.create[0].guest_name, name);
});

test('guest name exceeding 100 characters is rejected', async () => {
    const h = createHarness({
        body: {
            guest_name: 'A'.repeat(101),
            display_name: true,
        },
    });

    await h.controller.createCustomerReview(h.req, h.res);

    assert.equal(h.res.statusCode, 400);
    assert.equal(h.calls.create.length, 0);
});

test('invalid guest name data types are rejected', async () => {
    for (const name of [123, {}, ['John'], true]) {
        const h = createHarness({
            body: {
                guest_name: name,
                display_name: true,
            },
        });

        await h.controller.createCustomerReview(h.req, h.res);

        assert.equal(h.res.statusCode, 400);
        assert.equal(h.calls.create.length, 0);
    }
});

test('guest name without explicit display consent is discarded', async () => {
    const h = createHarness({
        body: {
            guest_name: 'John Smith',
        },
    });

    await h.controller.createCustomerReview(h.req, h.res);

    assert.equal(h.res.statusCode, 201);
    assert.equal(h.calls.create[0].guest_name, null);
    assert.equal(h.calls.create[0].display_name, false);
});

test('registered customer cannot override account name with guest name', async () => {
    const h = createHarness({
        customer: { id: 25 },
        body: {
            guest_name: 'Different Name',
            guest_number: '123456',
            display_name: 'true',
        },
    });

    await h.controller.createCustomerReview(h.req, h.res);

    assert.equal(h.res.statusCode, 201);

    const saved = h.calls.create[0];

    assert.equal(saved.customer_id, 25);
    assert.equal(saved.guest_name, null);
    assert.equal(saved.guest_number, null);
    assert.equal(saved.display_name, true);
});

test('registered customer can explicitly disable full name display', async () => {
    const h = createHarness({
        customer: { id: 25 },
        body: {
            display_name: 'false',
        },
    });

    await h.controller.createCustomerReview(h.req, h.res);

    assert.equal(h.res.statusCode, 201);
    assert.equal(h.calls.create[0].display_name, false);
});

test('public named guest review exposes only the resolved reviewer name', async () => {
    const h = createHarness({
        publicReviews: [{
            id: 20,
            customer_id: null,
            guest_number: '482731',
            guest_name: 'John Smith',
            display_name: true,
            rating: 5,
        }],
    });

    await h.controller.getProductReviews(h.req, h.res);

    assert.equal(h.res.statusCode, 200);
    assert.ok(
        h.calls.publicReviewQuery.attributes.includes('guest_name')
    );

    const review = h.res.body.data.reviews[0];

    assert.equal(review.reviewer_name, 'John Smith');

    for (const field of [
        'guest_name',
        'guest_number',
        'customer_id',
        'display_name',
        'customer',
    ]) {
        assert.equal(field in review, false);
    }
});

test('public guest name stays hidden when display preference is false', async () => {
    const h = createHarness({
        publicReviews: [{
            id: 21,
            customer_id: null,
            guest_number: '482731',
            guest_name: 'Hidden Name',
            display_name: false,
            rating: 5,
        }],
    });

    await h.controller.getProductReviews(h.req, h.res);

    assert.equal(h.res.statusCode, 200);

    const review = h.res.body.data.reviews[0];

    assert.equal(review.reviewer_name, 'Guest #482731');
    assert.equal('guest_name' in review, false);
    assert.ok(
        !JSON.stringify(review).includes('Hidden Name')
    );
});

test('historical guest review retains its original guest number', async () => {
    const h = createHarness({
        publicReviews: [{
            id: 22,
            customer_id: null,
            guest_number: '654321',
            guest_name: null,
            display_name: false,
            rating: 4,
        }],
    });

    await h.controller.getProductReviews(h.req, h.res);

    assert.equal(h.res.statusCode, 200);
    assert.equal(
        h.res.body.data.reviews[0].reviewer_name,
        'Guest #654321'
    );
});
