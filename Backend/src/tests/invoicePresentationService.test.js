'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    deriveInvoiceLifecycle,
    filterInvoiceSummaries,
    invoiceDetail,
    invoiceSummary
} = require('../services/invoicePresentationService');

function invoice({
    method = 'cash',
    paymentStatus = 'unpaid',
    orderPaymentStatus = paymentStatus,
    orderStatus = 'processing',
    fulfillmentStatus = 'unfulfilled',
    deliveryStatus = 'pending',
    paymentDate = null,
    discount = '980.00'
} = {}) {
    return {
        id: 9,
        invoice_number: 'SWI-9',
        invoice_date: '2026-11-20T00:00:00Z',
        status: paymentStatus === 'paid' ? 'paid' : 'draft',
        subtotal: '7350.00',
        discount_amount: discount,
        tax_amount: '0.00',
        shipping_amount: '450.00',
        total_amount: discount === '0.00' ? '7800.00' : '6820.00',
        customer: {
            first_name: 'Changed',
            last_name: 'Name',
            email: 'changed@example.test'
        },
        order: {
            id: 4,
            order_number: 'SWO-4',
            order_date: '2026-11-19T00:00:00Z',
            status: orderStatus,
            fulfillment_status: fulfillmentStatus,
            payment_status: orderPaymentStatus,
            customer_email: 'asha@example.test',
            payments: [{
                payment_method: method,
                payment_status: paymentStatus,
                amount: discount === '0.00' ? '7800.00' : '6820.00',
                payment_reference: 'SWP-4',
                payment_date: paymentDate
            }],
            deliveries: [{ delivery_status: deliveryStatus }],
            addresses: [{
                address_type: 'shipping',
                recipient_name: 'Asha Perera',
                phone: '0712345678',
                address_line_1: '20 Lake Road',
                city: 'Nugegoda',
                postal_code: '10250',
                district: { district_name: 'Colombo' },
                area: { area_name: 'Nugegoda' }
            }],
            items: []
        }
    };
}

test('COD pending and shipped orders remain draft', () => {
    assert.equal(deriveInvoiceLifecycle(invoice()).document_status, 'draft');
    assert.equal(deriveInvoiceLifecycle(invoice({ orderStatus: 'shipped' })).document_status, 'draft');
});

test('COD becomes final only after completion and confirmed payment', () => {
    const completed = deriveInvoiceLifecycle(invoice({
        paymentStatus: 'paid',
        orderPaymentStatus: 'paid',
        orderStatus: 'delivered',
        deliveryStatus: 'delivered',
        paymentDate: '2026-11-20T04:00:00Z'
    }));
    assert.equal(completed.document_status, 'final');
    assert.equal(completed.payment_date, '2026-11-20T04:00:00Z');

    const unpaid = deriveInvoiceLifecycle(invoice({
        orderStatus: 'delivered',
        deliveryStatus: 'delivered'
    }));
    assert.equal(unpaid.document_status, 'draft');
    assert.equal(unpaid.amount_paid, 0);
    assert.equal(unpaid.outstanding_balance, 6820);
});

test('confirmed card, Koko, and Mintpay payments finalize before delivery', () => {
    for (const method of ['card', 'koko', 'mintpay']) {
        const lifecycle = deriveInvoiceLifecycle(invoice({
            method,
            paymentStatus: 'paid',
            orderPaymentStatus: 'paid'
        }));
        assert.equal(lifecycle.document_status, 'final', method);
        assert.equal(lifecycle.payment_method, method);
    }
});

test('failed online payment never produces a final paid invoice', () => {
    const lifecycle = deriveInvoiceLifecycle(invoice({
        method: 'card',
        paymentStatus: 'failed',
        orderPaymentStatus: 'unpaid'
    }));
    assert.equal(lifecycle.document_status, 'draft');
    assert.equal(lifecycle.amount_paid, 0);
});

test('list lifecycle filters include paid online orders with legacy draft invoice rows', () => {
    const paidCard = invoice({
        method: 'card',
        paymentStatus: 'paid',
        orderPaymentStatus: 'paid'
    });
    paidCard.status = 'draft';
    const summary = invoiceSummary(paidCard);

    assert.equal(summary.document_status, 'final');
    assert.deepEqual(
        filterInvoiceSummaries([summary], { status: 'final', paymentMethod: 'card' }),
        [summary]
    );
    assert.deepEqual(filterInvoiceSummaries([summary], { status: 'draft' }), []);
});

test('invoice detail uses saved district and area without exposing city', () => {
    const detail = invoiceDetail(invoice(), { name: 'South West' });
    assert.deepEqual(detail.delivery_address, {
        address_line_1: '20 Lake Road',
        address_line_2: null,
        district: 'Colombo',
        area: 'Nugegoda',
        postal_code: '10250'
    });
    assert.equal(Object.hasOwn(detail.delivery_address, 'city'), false);
    assert.equal(detail.customer.name, 'Asha Perera');
    assert.equal(detail.customer.email, 'asha@example.test');
    assert.deepEqual(detail.totals, {
        subtotal: 7350,
        discount: 980,
        actual_product_value: 6370,
        tax: 0,
        delivery_charge: 450,
        total: 6820,
        has_discount: true
    });
});
