'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const proxyquire = require('proxyquire').noCallThru();

const uploadRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-customer-media-response-'));
process.env.UPLOAD_ROOT = uploadRoot;
delete process.env.FILE_BASE_URL;

const fileStorage = require('../utils/fileStorage');
const { getResponsiveImageMetadata } = fileStorage;

async function makeImages(count = 2) {
    const folder = 'items/images';
    const directory = path.join(uploadRoot, folder);
    await fs.promises.mkdir(directory, { recursive: true });
    const images = [];
    for (let index = 0; index < count; index += 1) {
        const uuid = crypto.randomUUID();
        const filePath = `${folder}/${uuid}.webp`;
        await fs.promises.writeFile(path.join(directory, `${uuid}.webp`), 'base');
        await fs.promises.writeFile(path.join(directory, `${uuid}-320.webp`), 'variant');
        await fs.promises.writeFile(path.join(directory, `${uuid}-640.webp`), 'variant');
        images.push({
            id: index + 1,
            file_name: `${uuid}.webp`,
            file_path: filePath,
            url: `/uploads/${filePath}`,
            alt_text: `Image ${index + 1}`,
            sort_order: index,
            is_primary: index === 0,
            is_active: true,
        });
    }
    return images;
}

function mockResponse() {
    return {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
    };
}

function modelImage(image) {
    return {
        ...image,
        toJSON() { return { ...image }; },
    };
}

function hydratedCart(images) {
    const extras = {};
    const cartItemExtras = {};
    const item = {
        id: 1,
        public_id: 'public-1',
        slug: 'sample-product',
        item_code: 'SKU-1',
        item_name: 'Sample product',
        category_id: 1,
        brand_id: 1,
        is_active: true,
        images: images.map(modelImage),
        toJSON() {
            return { ...this, toJSON: undefined, images: this.images.map(image => image.toJSON()) };
        },
    };
    const cartItem = {
        id: 5,
        cart_id: 2,
        item_id: 1,
        variant_id: 10,
        quantity: 1,
        unit_price: 125,
        item,
        variant: { id: 10, variant_sku: 'SKU-1-A', variant_name: 'Default' },
        setDataValue(key, value) { cartItemExtras[key] = value; },
        toJSON() {
            return {
                id: this.id,
                cart_id: this.cart_id,
                item_id: this.item_id,
                variant_id: this.variant_id,
                quantity: this.quantity,
                unit_price: this.unit_price,
                ...cartItemExtras,
                item: item.toJSON(),
                variant: this.variant,
            };
        },
    };
    return {
        id: 2,
        customer_id: 9,
        status: 'active',
        items: [cartItem],
        setDataValue(key, value) { extras[key] = value; },
        toJSON() {
            return {
                id: this.id,
                customer_id: this.customer_id,
                status: this.status,
                ...extras,
                items: this.items.map(entry => entry.toJSON()),
            };
        },
    };
}

function cartController(images) {
    const tx = { LOCK: { UPDATE: 'UPDATE' } };
    const cart = hydratedCart(images);
    const variant = { id: 10, item_id: 1, is_active: true };
    const cartItem = {
        id: 5, cart_id: 2, item_id: 1, variant_id: 10,
        quantity: 1, unit_price: 125,
        async update(values) { Object.assign(this, values); },
    };
    const models = {
        Cart: {
            sequelize: { async transaction(callback) { return callback(tx); } },
            async findOne(options) { return options.transaction ? { id: 2 } : cart; },
            async findByPk() { return cart; },
        },
        CartItem: {
            async findOne() { return null; },
            async findByPk() { return cartItem; },
            async create(values) { return { id: 5, ...values }; },
        },
        Item: { async findByPk() { return { id: 1, is_active: true }; } },
        ItemVariant: {
            async findOne() { return variant; },
            async findAll() { return [variant]; },
        },
        ItemPrice: { async findOne() { return { price: 125 }; } },
        ItemImage: {},
        InventoryStock: { async findAll() { return [{ quantity_on_hand: 20, quantity_reserved: 0 }]; } },
        InventoryLocation: {},
    };
    return proxyquire('../controllers/customerCartController', {
        '../models': models,
        '../services/discountCampaignService': {
            getActiveCampaigns: async () => [],
            campaignTargetsItem: () => false,
            calculateDiscount: () => ({}),
        },
        '../services/auditLogService': { recordAuditLog: async () => {} },
        '../utils/fileStorage': fileStorage,
    });
}

function guestCheckoutController(images) {
    const tx = { LOCK: { UPDATE: 'UPDATE' } };
    const session = {
        cart_items: [{ item_id: 1, variant_id: 10, quantity: 1 }],
        async update(values) { Object.assign(this, values); },
    };
    const item = {
        id: 1,
        is_active: true,
        item_name: 'Sample product',
        shipping_weight: 1,
        shipping_weight_unit: 'kg',
        images: images.map(modelImage),
    };
    const models = {
        sequelize: { async transaction(callback) { return callback(tx); } },
        GuestCheckoutSession: {
            async findOne() { return session; },
            async create(values) { Object.assign(session, values); return session; },
        },
        Item: { async findByPk() { return item; } },
        ItemVariant: { async findOne() { return { id: 10, variant_name: 'Default' }; } },
        ItemPrice: { async findOne() { return { price: 125 }; } },
        InventoryStock: { async findAll() { return [{ quantity_on_hand: 20, quantity_reserved: 0 }]; } },
        InventoryLocation: {},
        DeliveryDistrict: { async findOne() { return { id: 1, district_name: 'Central' }; } },
        DeliveryArea: { async findOne() { return { id: 2, area_name: 'Town' }; } },
    };
    const controller = proxyquire('../controllers/guestCheckoutController', {
        '../models': models,
        '../services/discountCampaignService': {
            getActiveCampaigns: async () => [],
            campaignTargetsItem: () => false,
            calculateDiscount: () => ({}),
        },
        '../services/prepaidDeliveryPricingService': {
            calculateDeliveryCharge: async () => ({ deliveryCharge: 0, billableKg: 1 }),
        },
        '../services/emailService': {
            sendOrderConfirmationEmail: async () => {},
            sendAdminNewOrderEmail: async () => {},
        },
        '../utils/fileStorage': fileStorage,
    });
    return { controller, session };
}

test('guest checkout preserves Buy Now and normal cart items when MySQL returns stored JSON as text', async () => {
    const images = await makeImages(1);
    const { controller, session } = guestCheckoutController(images);
    const token = 'b'.repeat(64);

    const buyNowResponse = mockResponse();
    await controller.createSession({
        body: { item_id: 1, variant_id: 10, quantity: 2 },
    }, buyNowResponse);

    assert.equal(buyNowResponse.statusCode, 201);
    assert.deepEqual(session.cart_items, [
        { item_id: 1, variant_id: 10, quantity: 2 },
    ]);

    // MariaDB may expose its JSON alias (LONGTEXT) as a string through mysql2.
    session.cart_items = JSON.stringify(session.cart_items);
    const cartResponse = mockResponse();
    await controller.getGuestCart({ get: () => token }, cartResponse);

    assert.equal(cartResponse.statusCode, 200);
    assert.equal(cartResponse.body.data.items.length, 1);
    assert.equal(cartResponse.body.data.items[0].quantity, 2);

    const { controller: normalCartController, session: normalCartSession } = guestCheckoutController(images);
    normalCartSession.cart_items = JSON.stringify([
        { item_id: 1, variant_id: 10, quantity: 1 },
    ]);
    const addResponse = mockResponse();
    await normalCartController.addGuestCartItem({
        body: { item_id: 1, variant_id: 10, quantity: 1 },
        get: () => token,
    }, addResponse);
    assert.equal(addResponse.statusCode, 200);
    assert.deepEqual(normalCartSession.cart_items, [
        { item_id: 1, variant_id: 10, quantity: 2 },
    ]);

    const emptyResponse = mockResponse();
    await controller.createSession({ body: { items: [] } }, emptyResponse);
    assert.equal(emptyResponse.statusCode, 400);
    assert.equal(emptyResponse.body.message, 'Cart must contain between 1 and 100 items.');
});

test('customer cart retrieval, add, and update preserve structure and attach multiple image variants', async () => {
    const images = await makeImages(2);
    const controller = cartController(images);

    const getResponse = mockResponse();
    const originalReaddir = fs.promises.readdir;
    let directoryReads = 0;
    fs.promises.readdir = async (...args) => {
        directoryReads += 1;
        return originalReaddir(...args);
    };
    try {
        await controller.getMyCart({ customer: { id: 9 }, get: () => '' }, getResponse);
    } finally {
        fs.promises.readdir = originalReaddir;
    }
    assert.equal(directoryReads, 1);
    const cartImages = getResponse.body.data.items[0].item.images;
    assert.equal(getResponse.body.data.id, 2);
    assert.equal(cartImages.length, 2);
    assert.equal(cartImages[0].url, images[0].url);
    assert.deepEqual(cartImages[1].responsive_images.map(value => value.width), [320, 640]);

    const addResponse = mockResponse();
    await controller.addItem({
        customer: { id: 9 }, body: { item_id: 1, variant_id: 10, quantity: 1 },
        get: () => '', ip: '127.0.0.1',
    }, addResponse);
    assert.equal(addResponse.body.message, 'Item added to cart successfully');
    assert.equal(addResponse.body.data.items[0].item.images.length, 2);
    assert.deepEqual(addResponse.body.data.items[0].item.images[0].responsive_images.map(value => value.width), [320, 640]);

    const updateResponse = mockResponse();
    await controller.updateItem({
        customer: { id: 9 }, params: { id: '5' }, body: { quantity: 2 },
        get: () => '', ip: '127.0.0.1',
    }, updateResponse);
    assert.equal(updateResponse.body.message, 'Cart item updated successfully');
    assert.equal(updateResponse.body.data.items[0].item.images.length, 2);
    assert.deepEqual(updateResponse.body.data.items[0].item.images[1].responsive_images.map(value => value.width), [320, 640]);
});

test('guest session, cart retrieval, add, update, and quote responses include image metadata', async () => {
    const images = await makeImages(2);
    const { controller } = guestCheckoutController(images);
    const token = 'a'.repeat(64);
    const guestRequest = (body = {}) => ({
        body,
        get: () => token,
    });

    const createResponse = mockResponse();
    await controller.createSession({ body: { items: [{ item_id: 1, variant_id: 10, quantity: 1 }] } }, createResponse);
    assert.equal(createResponse.body.data.items[0].images.length, 2);
    assert.equal(createResponse.body.data.items[0].images[0].url, images[0].url);
    assert.deepEqual(createResponse.body.data.items[0].images[1].responsive_images.map(value => value.width), [320, 640]);

    const getResponse = mockResponse();
    await controller.getGuestCart(guestRequest(), getResponse);
    assert.equal(getResponse.body.data.items[0].item_name, 'Sample product');
    assert.equal(getResponse.body.data.items[0].images.length, 2);

    const addResponse = mockResponse();
    await controller.addGuestCartItem(guestRequest({ item_id: 1, variant_id: 10, quantity: 1 }), addResponse);
    assert.equal(addResponse.body.data.items[0].images.length, 2);

    const updateResponse = mockResponse();
    await controller.updateGuestCartItem(guestRequest({ item_id: 1, variant_id: 10, quantity: 2 }), updateResponse);
    assert.equal(updateResponse.body.data.items[0].quantity, 2);
    assert.equal(updateResponse.body.data.items[0].images[1].url, images[1].url);

    const quoteResponse = mockResponse();
    await controller.quoteGuestCheckout(guestRequest({
        recipient_name: 'Guest Customer',
        customer_email: 'guest@example.com',
        phone: '0712345678',
        address_line_1: '1 Main Street',
        city: 'Colombo',
        district_id: 1,
        area_id: 2,
        payment_method: 'cash',
    }), quoteResponse);
    assert.equal(quoteResponse.body.data.items[0].images.length, 2);
    assert.deepEqual(quoteResponse.body.data.items[0].images[0].responsive_images.map(value => value.width), [320, 640]);
    assert.equal(quoteResponse.body.data.currency, 'LKR');
});

test('wishlist retrieval adds metadata to nested product images while add response stays unchanged', async () => {
    const images = await makeImages(2);
    const wishlistModel = {
        async findAll() {
            return [{ toJSON: () => ({
                id: 4,
                customer_id: 9,
                item_id: 1,
                item: {
                    id: 1,
                    item_name: 'Sample product',
                    images: images.map(image => ({ ...image })),
                },
            }) }];
        },
        async findOne() { return null; },
        async create(values) { return { id: 5, ...values }; },
    };
    const controller = proxyquire('../controllers/customerWishlistController', {
        '../models': {
            Wishlist: wishlistModel,
            Item: { async findByPk() { return { id: 1, is_active: true }; } },
            ItemImage: {},
        },
        '../services/auditLogService': { recordAuditLog: async () => {} },
        '../utils/fileStorage': fileStorage,
    });

    const getResponse = mockResponse();
    await controller.getMyWishlist({ customer: { id: 9 }, get: () => '' }, getResponse);
    assert.equal(getResponse.body.data[0].item.item_name, 'Sample product');
    assert.equal(getResponse.body.data[0].item.images.length, 2);
    assert.equal(getResponse.body.data[0].item.images[0].url, images[0].url);
    assert.deepEqual(getResponse.body.data[0].item.images[1].responsive_images.map(value => value.width), [320, 640]);

    const addResponse = mockResponse();
    await controller.addMyWishlistItem({
        customer: { id: 9 }, body: { item_id: 1 }, get: () => '',
    }, addResponse);
    assert.equal(addResponse.body.data.item_id, 1);
    assert.equal(Object.hasOwn(addResponse.body.data, 'item'), false);
});

test('repeated image directory paths share one request cache', async () => {
    const images = await makeImages(3);
    const originalReaddir = fs.promises.readdir;
    let calls = 0;
    fs.promises.readdir = async (...args) => {
        calls += 1;
        return originalReaddir(...args);
    };
    try {
        const cache = new Map();
        await Promise.all(images.map(image =>
            getResponsiveImageMetadata(image.file_path, 'products', cache)
        ));
        assert.equal(calls, 1);
    } finally {
        fs.promises.readdir = originalReaddir;
    }
});

test.after(async () => {
    await fs.promises.rm(uploadRoot, { recursive: true, force: true });
});
