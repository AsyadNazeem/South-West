'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();

function createHarness(options = {}) {
    const calls = {
        priceQueries: [],
        orderItems: [],
        stockMovements: [],
        orderCreated: false
    };

    const transaction = {
        LOCK: { UPDATE: 'UPDATE' },
        finished: undefined,

        async commit() {
            this.finished = 'commit';
        },

        async rollback() {
            this.finished = 'rollback';
        }
    };

    const variantPrice = options.variantPrice === undefined
        ? { id: 91, price: '1200.00' }
        : options.variantPrice;

    const parentPrice = options.parentPrice === undefined
        ? { id: 81, price: '1000.00' }
        : options.parentPrice;

    const stock = {
        variant_id: 9,
        location_id: 3,
        quantity_on_hand: 15,
        quantity_reserved: 0,
        is_active: true,

        async update(values, config) {
            Object.assign(this, values);
            calls.stockUpdateTransaction = config.transaction;
        }
    };

    const cart = {
        id: 20,
        status: 'active',

        async update(values, config) {
            Object.assign(this, values);
            calls.cartUpdateTransaction = config.transaction;
        }
    };

    const idempotencyRecord = {
        order_id: null,

        async update(values, config) {
            Object.assign(this, values);
            calls.idempotencyUpdateTransaction = config.transaction;
        }
    };

    const models = {
        sequelize: {
            async transaction() {
                return transaction;
            }
        },

        CheckoutIdempotency: {
            async create(values, config) {
                calls.idempotencyValues = values;

                assert.equal(config.transaction, transaction);

                if (options.duplicateIdempotencyKey) {
                    const error = new Error('Duplicate idempotency key');
                    error.original = { code: 'ER_DUP_ENTRY' };
                    throw error;
                }

                return idempotencyRecord;
            },

            async findOne() {
                return options.existingIdempotencyRecord ?? null;
            }
        },

        Cart: {
            async findOne() {
                return cart;
            }
        },

        CartItem: {
            async findAll() {
                return [{
                    cart_id: 20,
                    item_id: 4,
                    variant_id: 9,
                    quantity: options.quantity ?? 2
                }];
            }
        },

        Item: {
            async findByPk() {
                return {
                    id: 4,
                    item_name: 'USB Cable',
                    is_active: true,
                    shipping_weight: 200,
                    shipping_weight_unit: 'g'
                };
            }
        },

        ItemVariant: {
            async findOne({ where }) {
                calls.variantQuery = where;

                if (options.variantMissing) {
                    return null;
                }

                const variant = {
                    id: 9,
                    item_id: options.variantBelongsToWrongItem ? 99 : 4,
                    is_active: true
                };

                // Simulate Sequelize's WHERE filtering in the database.
                if (
                    Number(where.id) !== variant.id ||
                    Number(where.item_id) !== variant.item_id ||
                    where.is_active !== variant.is_active
                ) {
                    return null;
                }

                return variant;
            }
        },

        ItemPrice: {
            async findOne({ where, transaction: queryTransaction }) {
                calls.priceQueries.push({
                    variant_id: where.variant_id,
                    transaction: queryTransaction
                });

                assert.equal(queryTransaction, transaction);

                return where.variant_id === 9
                    ? variantPrice
                    : parentPrice;
            }
        },

        // Payment-method-specific price override.
        // Return null to use the normal selling price.
        ItemPaymentPrice: {
            async findOne() {
                return null;
            }
        },

        CustomerAddress: {
            async findOne() {
                return {
                    id: 7,
                    customer_id: 12,
                    address_type: 'shipping',
                    area_id: 5,
                    district_id: 2,
                    recipient_name: 'Test Customer',
                    phone: '0771234567',
                    address_line_1: '10 Test Road',
                    address_line_2: null,
                    city: 'Colombo',
                    state: 'Western',
                    postal_code: '00100',
                    country: 'Sri Lanka'
                };
            }
        },

        DeliveryArea: {
            async findOne() {
                return {
                    id: 5,
                    district_id: 2,
                    status: 1,
                    first_kg_charge: 300,
                    additional_kg_charge: 100
                };
            }
        },

        DeliveryDistrict: {
            async findOne() {
                return {
                    id: 2,
                    status: 1
                };
            }
        },

        InventoryLocation: {
            async findAll() {
                return [{
                    id: 3,
                    location_type: 'online',
                    is_active: true
                }];
            }
        },

        InventoryStock: {
            async findAll() {
                if (options.noStock) {
                    return [];
                }

                stock.quantity_on_hand = options.availableStock ?? 15;
                stock.quantity_reserved = 0;

                return [stock];
            }
        },

        InventoryStockMovement: {
            async create(values, config) {
                calls.stockMovements.push(values);

                assert.equal(config.transaction, transaction);

                return values;
            }
        },

        Order: {
            async create(values, config) {
                calls.orderCreated = true;
                calls.orderValues = values;

                assert.equal(config.transaction, transaction);

                return {
                    id: 50,
                    order_number: values.order_number,
                    status: values.status,
                    payment_status: values.payment_status
                };
            },

            async findOne() {
                return null;
            }
        },

        OrderItem: {
            async create(values, config) {
                if (options.failOrderItemCreate) {
                    throw new Error('Simulated order-item insert failure');
                }

                calls.orderItems.push(values);

                assert.equal(config.transaction, transaction);

                return values;
            }
        },

        OrderAddress: {
            async create(values, config) {
                assert.equal(config.transaction, transaction);
                return values;
            }
        },

        Delivery: {
            async create(values, config) {
                assert.equal(config.transaction, transaction);
                return values;
            }
        },

        Payment: {
            async create(values, config) {
                assert.equal(config.transaction, transaction);
                return values;
            },

            async findOne() {
                return null;
            }
        },

        Invoice: {
            async create(values, config) {
                assert.equal(config.transaction, transaction);
                return values;
            }
        }
    };

    const controller = proxyquire(
        '../controllers/customerCheckoutController',
        {
            '../models': models,

            '../services/auditLogService': {
                async recordAuditLog(values) {
                    calls.auditEntries ??= [];
                    calls.auditEntries.push(values);
                }
            },

            '../services/emailService': {
                async sendOrderConfirmationEmail() {
                    calls.customerEmails = (calls.customerEmails || 0) + 1;
                },
                async sendAdminNewOrderEmail() {
                    calls.adminEmails = (calls.adminEmails || 0) + 1;
                }
            },

            '../services/discountCampaignService': {
                async getActiveCampaigns() {
                    return [];
                },

                campaignTargetsItem() {
                    return false;
                },

                calculateDiscount() {
                    return {
                        discountAmount: 0,
                        discount_amount: 0
                    };
                }
            },

            '../services/promotionService': {
                async loadValidPromotion() {
                    return null;
                },

                calculatePromotionDiscount() {
                    return {
                        discountAmount: 0,
                        discount_amount: 0
                    };
                }
            }
        }
    );

    const checkout = controller.checkout;

    const req = {
        customer: { id: 12 },

        body: {
            cart_id: 20,
            address_id: 7,
            payment_method: 'cash'
        },

        ip: '127.0.0.1',

        get(name) {
            if (name === 'Idempotency-Key') {
                return options.idempotencyKey
                    ?? 'variant-checkout-test-001';
            }

            if (name === 'user-agent') {
                return 'node-test';
            }

            return undefined;
        }
    };

    const res = {
        statusCode: null,
        body: null,

        status(code) {
            this.statusCode = code;
            return this;
        },

        json(body) {
            this.body = body;
            return this;
        }
    };

    return {
        checkout,
        req,
        res,
        calls,
        transaction,
        stock
    };
}

test(
    'checkout prefers a valid variant-specific price over the parent price',
    async () => {
        const h = createHarness({
            variantPrice: { id: 91, price: '1200.00' },
            parentPrice: { id: 81, price: '1000.00' }
        });

        await h.checkout(h.req, h.res);

        assert.equal(h.res.statusCode, 201);
        assert.equal(h.calls.priceQueries.length, 1);
        assert.equal(h.calls.priceQueries[0].variant_id, 9);
        assert.equal(h.calls.orderItems[0].unit_price, 1200);
    }
);

test(
    'checkout falls back to the parent price when no variant price exists',
    async () => {
        const h = createHarness({
            variantPrice: null,
            parentPrice: { id: 81, price: '1000.00' }
        });

        await h.checkout(h.req, h.res);

        assert.equal(h.res.statusCode, 201);

        assert.deepEqual(
            h.calls.priceQueries.map(query => query.variant_id),
            [9, null]
        );

        assert.equal(h.calls.orderItems[0].unit_price, 1000);
    }
);

test(
    'checkout rejects the variant when it belongs to another item',
    async () => {
        const h = createHarness({
            variantBelongsToWrongItem: true
        });

        await h.checkout(h.req, h.res);

        assert.equal(h.res.statusCode, 409);
        assert.match(h.res.body.message, /variant/i);
        assert.equal(h.calls.orderCreated, false);
        assert.equal(h.transaction.finished, 'rollback');
    }
);

test('checkout rejects a missing selling price', async () => {
    const h = createHarness({
        variantPrice: null,
        parentPrice: null
    });

    await h.checkout(h.req, h.res);

    assert.equal(h.res.statusCode, 409);
assert.match(
    h.res.body.message,
    /valid price|selling price/i
);
    assert.equal(h.calls.orderCreated, false);
    assert.equal(h.transaction.finished, 'rollback');
});

test(
    'checkout validates and deducts stock for the selected variant',
    async () => {
        const h = createHarness({
            quantity: 3,
            availableStock: 10,
            variantPrice: { id: 91, price: '1200.00' }
        });

        await h.checkout(h.req, h.res);

        assert.equal(h.res.statusCode, 201);
        assert.equal(h.stock.quantity_on_hand, 7);
        assert.equal(h.calls.stockUpdateTransaction, h.transaction);

        assert.equal(h.calls.stockMovements.length, 1);
        assert.equal(h.calls.stockMovements[0].variant_id, 9);
        assert.equal(h.calls.stockMovements[0].quantity, 3);
        assert.equal(h.calls.stockMovements[0].item_id, 4);
    }
);

test(
    'checkout saves the selected variant and server-calculated price to the order item',
    async () => {
        const h = createHarness({
            quantity: 2,
            variantPrice: { id: 91, price: '1200.00' }
        });

        await h.checkout(h.req, h.res);

        assert.equal(h.res.statusCode, 201);
        assert.equal(h.calls.orderItems.length, 1);
        assert.equal(h.calls.orderItems[0].order_id, 50);
        assert.equal(h.calls.orderItems[0].item_id, 4);
        assert.equal(h.calls.orderItems[0].variant_id, 9);
        assert.equal(h.calls.orderItems[0].quantity, 2);
        assert.equal(h.calls.orderItems[0].unit_price, 1200);
        assert.equal(h.calls.orderItems[0].line_total, 2400);
    }
);

test(
    'checkout rolls back if creating an order item fails',
    async () => {
        const h = createHarness({
            failOrderItemCreate: true
        });

        await h.checkout(h.req, h.res);

        assert.equal(h.res.statusCode, 500);
        assert.equal(h.transaction.finished, 'rollback');
        assert.equal(h.calls.stockMovements.length, 0);
        assert.equal(h.calls.stockUpdateTransaction, undefined);
    }
);

test(
    'checkout rejects insufficient stock for the selected variant',
    async () => {
        const h = createHarness({
            quantity: 3,
            availableStock: 2
        });

        await h.checkout(h.req, h.res);

        assert.equal(h.res.statusCode, 409);
        assert.match(
            h.res.body.message,
            /insufficient online stock/i
        );
        assert.equal(h.calls.orderCreated, false);
        assert.equal(h.transaction.finished, 'rollback');
    }
);

test(
    'checkout accepts COD using the existing cash database value',
    async () => {
        const h = createHarness();

        h.req.body.payment_method = 'cod';

        await h.checkout(h.req, h.res);

        assert.equal(h.res.statusCode, 201);
        assert.equal(h.calls.orderCreated, true);
    }
);

for (const method of ['online', 'card', 'koko', 'mintpay']) {
    test(
        `checkout rejects ${method} until payment integration is enabled`,
        async () => {
            const h = createHarness();

            h.req.body.payment_method = method;

            await h.checkout(h.req, h.res);

            assert.equal(h.res.statusCode, 400);
            assert.equal(h.calls.orderCreated, false);
assert.equal(
    h.transaction.finished,
    method === 'online' ? undefined : 'rollback'
);
        }
    );
}

test(
    'checkout safely handles a duplicate idempotency key when no completed order is found',
    async () => {
        const h = createHarness({
            duplicateIdempotencyKey: true,
            existingIdempotencyRecord: null
        });

        await h.checkout(h.req, h.res);

        assert.equal(h.res.statusCode, 409);
        assert.match(
            h.res.body.message,
            /could not be confirmed/i
        );
        assert.equal(h.calls.orderCreated, false);
        assert.equal(h.transaction.finished, 'rollback');
    }
);