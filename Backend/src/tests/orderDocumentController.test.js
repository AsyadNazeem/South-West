'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();

function setup({ order = null } = {}) {
    const calls = [];
    const pdfCalls = [];
    const models = {
        Order: { async findOne(options) { calls.push(options); return order; } },
        OrderItem: {}, OrderAddress: {}, Payment: {}, Customer: {}, Invoice: {},
        Item: {}, ItemVariant: {},
        GuestCheckoutSession: { async findOne() { return null; } },
        GuestCheckoutIdempotency: { async findOne() { return null; } }
    };
    const controller = proxyquire('../controllers/orderDocumentController', {
        '../models': models,
        '../services/invoicePdfService': {
            async generateInvoicePdf(orderData, options) {
                pdfCalls.push({ orderData, options });
                return Buffer.from('%PDF-test');
            },
            invoiceFilename() { return 'order.pdf'; }
        }
    });
    const response = {
        code: null, body: null, headers: {},
        status(code) { this.code = code; return this; },
        json(body) { this.body = body; return this; },
        type(value) { this.headers.contentType = value; return this; },
        attachment(value) { this.headers.filename = value; return this; },
        send(body) { this.body = body; return this; }
    };
    return { controller, response, calls, pdfCalls };
}

test('customer document lookup scopes the query to the authenticated customer', async () => {
    const { controller, response, calls } = setup();
    await controller.getCustomerOrderDocument({
        params: { orderId: '22' }, customer: { id: 9 }
    }, response);
    assert.equal(response.code, 404);
    assert.deepEqual(calls[0].where, { id: '22', customer_id: 9, order_type: 'online' });
});

test('online pending payment cannot download a paid invoice', async () => {
    const { controller, response } = setup({ order: {
        id: 22, payment_status: 'unpaid', payments: [{ payment_method: 'card', payment_status: 'pending' }], invoices: [{}]
    } });
    await controller.getCustomerOrderDocument({
        params: { orderId: '22' }, customer: { id: 9 }
    }, response);
    assert.equal(response.code, 409);
    assert.match(response.body.message, /until payment is confirmed/);
});

test('COD customer download produces a draft PDF from the owned order', async () => {
    const ownedOrder = {
        id: 22,
        order_number: 'SWO-22',
        payment_status: 'unpaid',
        payments: [{ payment_method: 'cash', payment_status: 'unpaid' }],
        invoices: [{ invoice_number: 'SWI-22', status: 'draft' }],
        toJSON() { return { id: this.id, order_number: this.order_number }; }
    };
    const { controller, response, pdfCalls } = setup({ order: ownedOrder });
    await controller.getCustomerOrderDocument({
        params: { orderId: '22' }, customer: { id: 9 }
    }, response);
    assert.equal(response.code, 200);
    assert.equal(response.headers.contentType, 'application/pdf');
    assert.equal(response.headers.filename, 'order.pdf');
    assert.deepEqual(pdfCalls[0].options, { draft: true });
});

test('guest document requires a session token linked to the requested order', async () => {
    const { controller, response, calls } = setup();
    await controller.getGuestOrderDocument({
        params: { orderId: '22' },
        get(name) { return name === 'x-guest-checkout-token' ? 'a'.repeat(64) : undefined; }
    }, response);
    assert.equal(response.code, 404);
    assert.equal(calls.length, 0);
});
