'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { generateInvoicePdf, invoiceFilename } = require('../services/invoicePdfService');

function order(overrides = {}) {
    return {
        order_number: 'SWO-TEST-42',
        invoice_number: 'SWI-TEST-42',
        order_date: '2026-11-11T00:00:00Z',
        payment_status: 'unpaid',
        subtotal: '25000.00',
        discount_amount: '100.00',
        shipping_amount: '800.00',
        normal_delivery_amount: '500.00',
        additional_shipping_amount: '300.00',
        total_amount: '25700.00',
        customer_email: 'customer@example.com',
        addresses: [{ address_type: 'shipping', recipient_name: 'Test Customer', address_line_1: '1 Main Road', city: 'Colombo' }],
        payments: [{ payment_method: 'cash', payment_status: 'unpaid' }],
        items: [{ name: 'Test Product', variant_name: 'Large Blue', quantity: 2, unit_price: '12500.00', line_total: '25000.00' }],
        ...overrides
    };
}

test('draft PDF identifies COD as unpaid and keeps shipping components separate', async () => {
    const pdf = await generateInvoicePdf(order(), { draft: true });
    const content = pdf.toString('binary');
    assert.equal(content.slice(0, 8), '%PDF-1.4');
    assert.match(content, /DRAFT INVOICE/);
    assert.match(content, /Payment status: Unpaid - payment not collected/);
    assert.match(content, /Delivery: Rs\. 500\.00/);
    assert.match(content, /Additional shipping: Rs\. 300\.00/);
    assert.match(content, /Large Blue/);
    assert.match(content, /\/Subtype \/Image/);
});

test('full invoice generation requires trusted paid order state', async () => {
    await assert.rejects(
        generateInvoicePdf(order(), { draft: false }),
        /requires a paid order/
    );
    const pdf = await generateInvoicePdf(order({ payment_status: 'paid' }));
    assert.match(pdf.toString('binary'), /INVOICE/);
    assert.doesNotMatch(pdf.toString('binary'), /DRAFT INVOICE/);
});

test('invoice filenames distinguish draft documents', () => {
    assert.equal(invoiceFilename('SWO-123', true), 'South-West-Order-SWO-123-Draft-Invoice.pdf');
    assert.equal(invoiceFilename('SWO-123'), 'South-West-Order-SWO-123-Invoice.pdf');
});

test('long orders paginate without dropping item rows', async () => {
    const items = Array.from({ length: 24 }, (_, index) => ({
        name: `Product ${index + 1}`, quantity: 1, unit_price: 10, line_total: 10
    }));
    const pdf = await generateInvoicePdf(order({ items }), { draft: true });
    const content = pdf.toString('binary');
    assert.match(content, /\/Count 2/);
    assert.match(content, /Product 1/);
    assert.match(content, /Product 24/);
    assert.match(content, /Page 2 of 2/);
});

test('long invoice keeps totals, shipping and payment summary together on the final page', async () => {
    const items = Array.from({ length: 24 }, (_, index) => ({
        name: `Product ${index + 1}`, quantity: 1, unit_price: 10, line_total: 10
    }));
    const pdf = await generateInvoicePdf(order({
        items,
        subtotal: '240.00',
        discount_amount: '10.00',
        normal_delivery_amount: '25.00',
        additional_shipping_amount: '5.00',
        total_amount: '260.00',
        payments: [{ payment_method: 'mintpay', payment_status: 'unpaid' }]
    }), { draft: true });
    const streams = [...pdf.toString('binary').matchAll(/stream\n([\s\S]*?)\nendstream/g)].map(match => match[1]);
    const lastPage = streams.find(stream => stream.includes('Product 24'));

    assert.ok(lastPage, 'final-page content stream should contain the last item');
    assert.match(lastPage, /350 496 Td \(Subtotal: Rs\. 240\.00\)/);
    assert.match(lastPage, /350 479 Td \(Discount: - Rs\. 10\.00\)/);
    assert.match(lastPage, /350 462 Td \(Delivery: Rs\. 25\.00\)/);
    assert.match(lastPage, /350 445 Td \(Additional shipping: Rs\. 5\.00\)/);
    assert.match(lastPage, /350 426 Td \(TOTAL: Rs\. 260\.00\)/);
    assert.match(lastPage, /34 404 Td \(Payment method: Mintpay\)/);
    assert.match(lastPage, /34 389 Td \(Payment status: Unpaid - payment not collected\)/);
});
