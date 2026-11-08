'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire');

// Social preview tests always assert production canonical and image URLs.
// Keep these values independent of the developer's local Backend/.env.
process.env.PUBLIC_SITE_URL = 'https://southwest.lk';
process.env.PUBLIC_API_URL = 'https://api.southwest.lk';

const UUID = '12345678-1234-1234-1234-123456789abc';

function loadController(state = {}) {
    const Item = {
        findOne: async (...args) => {
            state.itemQuery = args[0];
            if (state.itemError) throw state.itemError;
            return state.product === undefined
                ? {
                    id: 12,
                    public_id: UUID,
                    slug: `kingston-fury-${UUID}`,
                    item_name: 'Kingston Fury RAM',
                    description: '<p>Fast &amp; reliable <strong>memory</strong>.</p>',
                }
                : state.product;
        },
    };

    const ItemImage = {
        findAll: async (...args) => {
            state.imageQuery = args[0];
            return state.image ? [state.image] : [];
        },
    };

    return proxyquire('../controllers/socialPreviewController', {
        '../models': { Item, ItemImage },
        '../utils/fileStorage': {
            buildFileUrl: (filePath) =>
                filePath ? `/uploads/${filePath}` : null,
            isValidUploadedImagePath: async filePath => Boolean(filePath),
        },
        '../utils/customerProductEligibility': { hasCustomerVisibleProduct: async () => true },
    });
}

function responseMock() {
    return {
        statusCode: 200,
        contentType: null,
        headers: {},
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        type(value) {
            this.contentType = value;
            return this;
        },
        set(name, value) {
            this.headers[name] = value;
            return this;
        },
        send(value) {
            this.body = value;
            return this;
        },
    };
}

test('generates product-specific Open Graph and Twitter metadata', async () => {
    const state = {
        image: {
            file_path: 'items/images/kingston.jpg',
            alt_text: 'Kingston Fury memory',
        },
    };

    const { getProductSocialPreview } = loadController(state);
    const req = {
        params: { slug: `kingston-fury-${UUID}` },
    };
    const res = responseMock();

    await getProductSocialPreview(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.contentType, 'html');
    assert.match(res.body, /property="og:title"/);
    assert.match(res.body, /Kingston Fury RAM \| South West/);
    assert.match(res.body, /property="og:description"/);
    assert.match(res.body, /https:\/\/api\.southwest\.lk\/uploads\/items\/images\/kingston\.jpg/);
    assert.match(res.body, /https:\/\/southwest\.lk\/product\/kingston-fury-/);
    assert.match(res.body, /name="twitter:card" content="summary_large_image"/);
    assert.equal(res.headers['Cache-Control'], 'public, max-age=300, s-maxage=600');
    assert.equal(state.itemQuery.where.public_id, UUID);
    assert.equal(state.itemQuery.where.is_active, true);
});

test('does not expose social metadata for a product that has never been stocked', async () => {
    const controller = proxyquire('../controllers/socialPreviewController', {
        '../models': {
            Item: { findOne: async () => ({ id: 22, item_name: 'Hidden product' }) },
            ItemImage: { findAll: async () => [] },
        },
        '../utils/fileStorage': { buildFileUrl: () => null, isValidUploadedImagePath: async () => true },
        '../utils/customerProductEligibility': { hasCustomerVisibleProduct: async () => false },
    });
    const res = responseMock();
    await controller.getProductSocialPreview({ params: { slug: `hidden-${UUID}` } }, res);
    assert.equal(res.statusCode, 404);
    assert.equal(res.body, 'Product not found');
});

test('rejects product URLs without a public UUID', async () => {
    const { getProductSocialPreview } = loadController();
    const res = responseMock();

    await getProductSocialPreview(
        { params: { slug: 'kingston-fury' } },
        res
    );

    assert.equal(res.statusCode, 400);
    assert.equal(res.body, 'Invalid product URL');
});

test('returns 404 for unavailable products', async () => {
    const { getProductSocialPreview } = loadController({
        product: null,
    });
    const res = responseMock();

    await getProductSocialPreview(
        { params: { slug: `kingston-fury-${UUID}` } },
        res
    );

    assert.equal(res.statusCode, 404);
    assert.equal(res.body, 'Product not found');
});

test('does not expose social metadata when product has no valid uploaded image', async () => {
    const { getProductSocialPreview } = loadController({
        image: null,
    });
    const res = responseMock();

    await getProductSocialPreview(
        { params: { slug: `kingston-fury-${UUID}` } },
        res
    );

    assert.equal(res.statusCode, 404);
    assert.equal(res.body, 'Product not found');
});

test('returns a generic 500 response when the database fails', async () => {
    const { getProductSocialPreview } = loadController({
        itemError: new Error('Database connection details'),
    });
    const res = responseMock();

    await getProductSocialPreview(
        { params: { slug: `kingston-fury-${UUID}` } },
        res
    );

    assert.equal(res.statusCode, 500);
    assert.equal(res.body, 'Unable to generate product preview');
    assert.doesNotMatch(res.body, /Database connection details/);
});

test('escapes HTML and removes markup from descriptions', () => {
    const { escapeHtml, plainText } = loadController();

    assert.equal(
        escapeHtml('<script>"hello" & \'world\'</script>'),
        '&lt;script&gt;&quot;hello&quot; &amp; &#39;world&#39;&lt;/script&gt;'
    );

    assert.equal(
        plainText('<p>Fast &amp; reliable <strong>memory</strong>.</p>'),
        'Fast & reliable memory .'
    );
});
