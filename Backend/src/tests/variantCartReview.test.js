'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();

test('two SKUs keep independent cart lines, quantities, stock and signed-in quote prices', async () => {
    const tx = { LOCK: { UPDATE: true }, commit() {}, rollback() {} };
    const transaction = callback => callback ? callback(tx) : tx;
    const rows = [];
    const setDataValue = function (key, value) { this[key] = value; };
    const item = { id: 166, item_name: 'Fixture', is_active: true, shipping_weight: 1 };
    const cart = { id: 4, items: rows, setDataValue };
    const stock = [{ variant_id: 182, quantity_on_hand: 5, quantity_reserved: 0 },
        { variant_id: 206, quantity_on_hand: 2, quantity_reserved: 0 }];
    const models = {
        sequelize: { transaction },
        Item: { findByPk: () => item },
        ItemVariant: { findOne: ({ where }) => where.item_id === item.id && { id: where.id, is_active: true } },
        ItemPrice: { findOne: ({ where }) => ({ price: where.variant_id === 182 ? 4000 : 4300 }) },
        ItemPaymentPrice: { findOne: ({ where }) => ({ price: methodPrice(where.variant_id, where.payment_method) }) },
        Cart: { sequelize: { transaction }, findOne: () => cart, findByPk: () => cart },
        CartItem: {
            findAll: () => rows,
            findOne: ({ where }) => rows.find(row => row.cart_id === where.cart_id && row.variant_id === where.variant_id),
            findByPk: id => rows.find(row => row.id === id),
            create(values) {
                const row = { ...values, id: rows.length + 1, setDataValue, update(patch) { Object.assign(this, patch); } };
                rows.push(row);
                return row;
            }
        },
        CustomerAddress: { findOne: () => ({ id: 1, area_id: 1, district_id: 1 }) },
        DeliveryArea: { findOne: () => ({ id: 1 }) }, DeliveryDistrict: { findOne: () => ({ id: 1 }) },
        InventoryLocation: { findAll: () => [{ id: 1 }] },
        InventoryStock: { findAll: ({ where }) => stock.filter(s => [where.variant_id].flat().includes(s.variant_id)) }
    };
    function methodPrice(id, method) {
        const base = { cash: 4000, card: 4100, koko: 4700, mintpay: 4750 }[method];
        return base + (id === 206 ? 300 : 0);
    }
    const deps = {
        '../models': models,
        '../services/auditLogService': { recordAuditLog() {} },
        '../services/discountCampaignService': { getActiveCampaigns: () => [] },
        '../services/prepaidDeliveryPricingService': { calculateDeliveryCharge: () => ({ deliveryCharge: 0 }) }
    };
    const customerCart = proxyquire('../controllers/customerCartController', deps);
    const checkout = proxyquire('../controllers/customerCheckoutController', deps);
    async function call(handler, body, params = {}, expected = 200) {
        const res = { status(code) { this.code = code; return this; }, json(value) { this.body = value; } };
        await handler({ customer: { id: 1 }, body, params }, res);
        assert.equal(res.code, expected, JSON.stringify(res.body));
        return res.body;
    }
    for (const variant_id of [182, 206]) await call(customerCart.addItem, { item_id: 166, variant_id, quantity: 1 });
    await call(customerCart.updateItem, { quantity: 2 }, { id: 2 });
    await call(customerCart.updateItem, { quantity: 3 }, { id: 2 }, 409);
    assert.deepEqual(rows.map(r => [r.variant_id, r.quantity, r.unit_price]), [[182, 1, 4000], [206, 2, 4300]]);
    for (const method of ['cash', 'card', 'koko', 'mintpay']) {
        const { quote } = await call(checkout.quote, { cart_id: 4, address_id: 1, payment_method: method });
        assert.deepEqual(quote.items.map(r => [r.variant_id, r.quantity, r.unit_price]),
            [[182, 1, methodPrice(182, method)], [206, 2, methodPrice(206, method)]]);
        assert.equal(quote.subtotal, methodPrice(182, method) + 2 * methodPrice(206, method));
    }
});

test('guest cart, method-specific quotes and simulated order agree for two SKUs of the same item', async () => {
    const item = { id: 166, item_name: 'Fixture headset', is_active: true, shipping_weight: 1 };
    const update = function (patch) { Object.assign(this, patch); };
    const session = { id: 1, expires_at: Date.now() + 60000, cart_items: [], update };
    const tx = { LOCK: { UPDATE: true }, commit() {}, rollback() {} };
    const orderLines = [];
    const fixtureStock = [182, 206].map(id => ({
        variant_id: id, location_id: 3, quantity_on_hand: id === 182 ? 5 : 2, quantity_reserved: 0, update
    }));
    const prices = { cash: 3900, card: 4120, koko: 4650, mintpay: 4780 };
    let missing = false;
    const models = {
        sequelize: { transaction: callback => callback ? callback(tx) : tx },
        GuestCheckoutSession: { findOne: () => ({
            ...session, cart_items: structuredClone(session.cart_items), update: patch => Object.assign(session, patch)
        }) },
        GuestCheckoutIdempotency: { findOne: () => null, create: () => ({ update }) },
        Item: { findByPk: () => item },
        ItemVariant: { findOne: ({ where }) => ({ id: where.id, item_id: where.item_id, variant_name: 'SKU ' + where.id }) },
        ItemPrice: { findOne: ({ where }) => ({ price: where.variant_id === 182 ? 4000 : 4300 }) },
        ItemPaymentPrice: { findOne({ where }) {
            assert.ok([182, 206].includes(where.variant_id));
            assert.equal(where.currency, 'LKR');
            assert.equal(where.item_id, item.id);
            return missing ? null : { price: prices[where.payment_method] + (where.variant_id === 206 ? 300 : 0) };
        } },
        DeliveryArea: { findOne: () => ({ id: 1 }) }, DeliveryDistrict: { findOne: () => ({ id: 1 }) },
        InventoryLocation: { findAll: () => [{ id: 3 }] },
        InventoryStock: { findAll: ({ where }) => fixtureStock.filter(s => [where.variant_id].flat().includes(s.variant_id)) },
        Order: { create: values => ({ id: 1, ...values }) },
        Payment: { create: values => values }, OrderItem: { create: values => orderLines.push(values) },
        OrderAddress: { create() {} }, Invoice: { create() {} }, InventoryStockMovement: { create() {} }
    };
    const guest = proxyquire('../controllers/guestCheckoutController', {
        '../models': models,
        '../services/auditLogService': { recordAuditLog() {} },
        './adminNotificationController': { notifyAdmins() {} },
        '../services/emailService': { sendOrderConfirmationEmail() {}, sendAdminNewOrderEmail() {} },
        '../services/invoicePdfService': { getOrderInvoiceAttachment() {} },
        '../services/prepaidDeliveryPricingService': { calculateDeliveryCharge: () => ({ deliveryCharge: 0 }) },
        '../services/discountCampaignService': {
            getActiveCampaigns: () => [{ id: 1 }], campaignTargetsItem: () => true,
            calculateDiscount: (_, price) => ({ discount_amount: price / 10, discounted_price: price * 0.9 })
        }
    });
    async function call(handler, body, expected = 200) {
        const res = { status(code) { this.code = code; return this; }, json(value) { this.body = value; } };
        await handler({ body, get: () => 'a'.repeat(64) }, res);
        assert.equal(res.code, expected, JSON.stringify(res.body));
        return res.body.data;
    }
    const address = { recipient_name: 'Fixture', customer_email: 'fixture@example.invalid', phone: '123',
        address_line_1: 'Test', city: 'Test', district_id: 1, area_id: 1 };
    for (const variant_id of [182, 206]) await call(guest.addGuestCartItem, { item_id: 166, variant_id, quantity: 1 });
    await call(guest.updateGuestCartItem, { item_id: 166, variant_id: 206, quantity: 2 });
    await call(guest.updateGuestCartItem, { item_id: 166, variant_id: 206, quantity: 3 }, 409);
    let lastQuote;
    for (const [payment_method, price] of Object.entries(prices)) {
        lastQuote = await call(guest.quoteGuestCheckout, { ...address, payment_method });
        assert.deepEqual(lastQuote.items.map(row => [row.variant_id, row.unit_price, row.quantity]),
            [[182, price, 1], [206, price + 300, 2]]);
        assert.equal(lastQuote.total_amount, (price + 2 * (price + 300)) * 0.9);
    }
    missing = true;
    await call(guest.quoteGuestCheckout, { ...address, payment_method: 'mintpay' }, 409);
    await call(guest.checkoutGuest, { ...address, payment_method: 'mintpay' }, 409);
    assert.equal(orderLines.length, 0);
    const cashFallback = await call(guest.quoteGuestCheckout, { ...address, payment_method: 'cod' });
    assert.deepEqual(cashFallback.items.map(row => row.unit_price), [4000, 4300]);
    missing = false;
    const result = await call(guest.checkoutGuest, { ...address, payment_method: 'mintpay' }, 201);
    assert.deepEqual(orderLines.map(row => [row.variant_id, row.unit_price, row.quantity]), [[182, 4780, 1], [206, 5080, 2]]);
    assert.equal(result.order.total_amount, lastQuote.total_amount);
    assert.equal(result.payment.amount, lastQuote.total_amount);
});
