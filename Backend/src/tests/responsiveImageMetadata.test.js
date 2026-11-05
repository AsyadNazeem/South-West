'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const proxyquire = require('proxyquire').noCallThru();

const uploadRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-responsive-metadata-'));
process.env.UPLOAD_ROOT = uploadRoot;
delete process.env.FILE_BASE_URL;

const fileStorage = require('../utils/fileStorage');
const { getResponsiveImageMetadata } = fileStorage;
const { randomUUID } = require('node:crypto');

async function writeImageSet(folder, uuid = randomUUID(), variants = []) {
    const directory = path.join(uploadRoot, folder);
    await fs.promises.mkdir(directory, { recursive: true });
    const basePath = path.join(directory, `${uuid}.webp`);
    await fs.promises.writeFile(basePath, 'base');
    for (const width of variants) {
        await fs.promises.writeFile(path.join(directory, `${uuid}-${width}.webp`), 'variant');
    }
    return `${folder}/${uuid}.webp`;
}

test('returns only existing UUID WebP variants and keeps the base separate', async () => {
    const storedPath = await writeImageSet('items/images', randomUUID(), [320, 640, 1200]);
    const result = await getResponsiveImageMetadata(storedPath, 'products');
    const uuid = path.basename(storedPath, '.webp');
    assert.deepEqual(result, [320, 640, 1200].map(width => ({
        width,
        url: `/uploads/items/images/${uuid}-${width}.webp`,
    })));
    assert.equal(result.some(candidate => candidate.url.endsWith(`/${uuid}.webp`)), false);
});

test('handles partial, absent, and missing responsive files without guessing URLs', async () => {
    const partial = await writeImageSet('categories/images', randomUUID(), [160, 640]);
    assert.deepEqual(
        (await getResponsiveImageMetadata(partial, 'categories')).map(value => value.width),
        [160, 640]
    );

    const baseOnly = await writeImageSet('brands/images', randomUUID(), []);
    assert.deepEqual(await getResponsiveImageMetadata(baseOnly, 'brands'), []);
    assert.deepEqual(
        await getResponsiveImageMetadata('brands/images/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp', 'brands'),
        []
    );
});

test('does not create candidates for external, legacy, or unsupported image paths', async () => {
    assert.deepEqual(await getResponsiveImageMetadata('https://cdn.example/image.webp', 'products'), []);
    assert.deepEqual(await getResponsiveImageMetadata('/uploads/items/legacy-image.webp', 'products'), []);
    assert.deepEqual(await getResponsiveImageMetadata('items/images/image.jpg', 'products'), []);
    assert.deepEqual(await getResponsiveImageMetadata('/etc/passwd', 'products'), []);
});

test('reuses one asynchronous directory read for repeated paths within a request', async () => {
    const storedPath = await writeImageSet('items/images', randomUUID(), [320]);
    const originalReaddir = fs.promises.readdir;
    let calls = 0;
    fs.promises.readdir = async (...args) => {
        calls += 1;
        return originalReaddir(...args);
    };
    try {
        const cache = new Map();
        await Promise.all([
            getResponsiveImageMetadata(storedPath, 'products', cache),
            getResponsiveImageMetadata(storedPath, 'products', cache),
            getResponsiveImageMetadata(`/${path.posix.join('uploads', storedPath)}`, 'products', cache),
        ]);
        assert.equal(calls, 1);
    } finally {
        fs.promises.readdir = originalReaddir;
    }
});

function mockResponse() {
    return {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
    };
}

test('product image API adds per-image metadata and preserves existing fields', async () => {
    const storedPath = await writeImageSet('items/images', randomUUID(), [320, 640]);
    const image = {
        id: 7,
        file_path: storedPath,
        url: `/uploads/${storedPath}`,
        is_primary: true,
        toJSON() { return { ...this, toJSON: undefined }; },
    };
    const modelStubs = {
        ItemImage: { async findAll() { return [image]; } },
        Item: {}, sequelize: {},
    };
    const controller = proxyquire('../controllers/itemImageController', {
        '../models': modelStubs,
        '../utils/fileStorage': fileStorage,
        '../services/auditLogService': { recordAuditLog: async () => {} },
    });
    const res = mockResponse();
    await controller.getItemImages({ query: {} }, res);
    const result = res.body.data[0];
    assert.equal(result.file_path, storedPath);
    assert.equal(result.url, `/uploads/${storedPath}`);
    assert.deepEqual(result.responsive_images.map(value => value.width), [320, 640]);
});

test('store category and brand APIs add metadata without changing base URLs', async () => {
    const categoryPath = await writeImageSet('categories/images', randomUUID(), [160]);
    const brandPath = await writeImageSet('brands/images', randomUUID(), [320]);
    const categoryController = proxyquire('../controllers/storeCategoryController', {
        '../models': { Category: { async findAll() { return [{ id: 1, name: 'Root', image_url: `/uploads/${categoryPath}`, parent_id: null }]; } } },
        '../utils/fileStorage': fileStorage,
    });
    const brandController = proxyquire('../controllers/storeBrandController', {
        '../models': { Brand: { async findAll() { return [{ id: 2, name: 'Brand', image_url: brandPath }]; } } },
        '../utils/fileStorage': fileStorage,
    });

    const categoryRes = mockResponse();
    await categoryController.getStoreCategories({}, categoryRes);
    assert.equal(categoryRes.body.data[0].image_url, `/uploads/${categoryPath}`);
    assert.deepEqual(categoryRes.body.data[0].responsive_images.map(value => value.width), [160]);

    const brandRes = mockResponse();
    await brandController.getStoreBrands({}, brandRes);
    assert.equal(brandRes.body.data[0].image_url, brandPath);
    assert.deepEqual(brandRes.body.data[0].responsive_images.map(value => value.width), [320]);
});

test('public banner API reports desktop and mobile variants independently', async () => {
    const desktopPath = await writeImageSet('homepage/banners', randomUUID(), [640, 960]);
    const mobileUuid = randomUUID();
    const mobilePath = await writeImageSet('homepage/banners', mobileUuid, [640]);
    const controller = proxyquire('../controllers/homepageBannerController', {
        '../models': {
            HomepageBanner: { async findAll() { return [{
                id: 1, image_path: desktopPath, mobile_image_path: mobilePath,
                title: 'Sale',
            }]; } },
            sequelize: {},
        },
        '../utils/fileStorage': fileStorage,
        '../services/auditLogService': { recordAuditLog: async () => {} },
    });
    const res = mockResponse();
    await controller.getPublicBanners({}, res);
    const banner = res.body.data[0];
    assert.equal(banner.image_url, `/uploads/${desktopPath}`);
    assert.equal(banner.mobile_image_url, `/uploads/${mobilePath}`);
    assert.deepEqual(banner.responsive_images.map(value => value.width), [640, 960]);
    assert.deepEqual(banner.mobile_responsive_images.map(value => value.width), [640]);
    assert.equal(banner.title, 'Sale');
});

test('store product image serialization adds metadata per image and retains base URL', async () => {
    const storedPath = await writeImageSet('items/images', randomUUID(), [320]);
    const models = {
        Item: { async findAll() { return [{ id: 1, toJSON: () => ({
            id: 1, item_name: 'Sample', images: [{
                id: 3, file_path: storedPath, url: `/uploads/${storedPath}`,
                is_primary: true, sort_order: 0,
            }],
            specificationValues: [],
        }) }]; } },
        ItemVariant: { async findAll() { return []; } },
        ItemPrice: { async findAll() { return [{ item_id: 1, variant_id: null, price: 10, currency: 'LKR' }]; } },
        InventoryStock: { async findAll() { return []; } },
        ProductReview: { async findAll() { return []; } },
        Brand: {}, Category: {}, Warranty: {}, ItemImage: {},
        ItemSpecificationValue: {}, ItemSpecification: {},
        InventoryLocation: {}, ItemPaymentPrice: {}, ItemColor: {},
        sequelize: {},
    };
    const controller = proxyquire('../controllers/storeProductController', {
        '../models': models,
        '../utils/fileStorage': fileStorage,
        '../services/discountCampaignService': {
            getActiveCampaigns: async () => [],
            campaignTargetsItem: () => false,
            calculateDiscount: () => ({}),
            getBestVisualCampaignForItem: () => null,
        },
        '../utils/storeProductListingQuery': { getEligibleProductPage: async () => [] },
    });
    const res = mockResponse();
    await controller.getStoreProducts({ query: {} }, res);
    const image = res.body.data[0].images[0];
    assert.equal(image.url, `/uploads/${storedPath}`);
    assert.equal(image.file_path, storedPath);
    assert.deepEqual(image.responsive_images.map(value => value.width), [320]);
});

test.after(async () => {
    await fs.promises.rm(uploadRoot, { recursive: true, force: true });
});
