'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    generateInvoiceDocument,
    generateInvoicePdf,
    invoiceFilename
} = require('../services/invoicePdfService');

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
        addresses: [{
            address_type: 'shipping', recipient_name: 'Test Customer',
            phone: '0712345678', address_line_1: '1 Main Road',
            address_line_2: 'Apartment 2', city: 'Do Not Print City',
            district: { district_name: 'Kurunegala' },
            area: { area_name: 'Kuliyapitiya' }, postal_code: '60200'
        }],
        payments: [{ payment_method: 'cash', payment_status: 'unpaid' }],
        items: [{ name: 'Test Product', variant_name: 'Large Blue', quantity: 2, unit_price: '12500.00', line_total: '25000.00' }],
        ...overrides
    };
}

test('draft PDF identifies COD as unpaid and presents the reconciled invoice summary', async () => {
    const pdf = await generateInvoicePdf(order(), { draft: true });
    const content = pdf.toString('binary');
    assert.equal(content.slice(0, 8), '%PDF-1.4');
    assert.match(content, /DRAFT INVOICE/);
    assert.match(content, /Payment Status: unpaid/);
    assert.match(content, /Delivery Charge: Rs\. 800\.00/);
    assert.match(content, /Actual Product Value: Rs\. 24,900\.00/);
    assert.match(content, /Outstanding: Rs\. 25,700\.00/);
    assert.match(content, /0712345678/);
    assert.match(content, /District: Kurunegala/);
    assert.match(content, /Delivery Area: Kuliyapitiya/);
    assert.doesNotMatch(content, /Do Not Print City/);
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
    assert.equal(invoiceFilename('SWI-123', true), 'SouthWest-Invoice-SWI-123-Draft.pdf');
    assert.equal(invoiceFilename('SWI-123'), 'SouthWest-Invoice-SWI-123-Final.pdf');
});

test('saved invoice snapshots drive both draft and final documents', async () => {
    const invoice = {
        invoice_number: 'SWI-SNAPSHOT-1',
        invoice_date: '2026-11-20T00:00:00Z',
        subtotal: '1000.00',
        discount_amount: '100.00',
        tax_amount: '50.00',
        shipping_amount: '150.00',
        total_amount: '1100.00'
    };
    const draft = await generateInvoiceDocument(invoice, order({
        subtotal: '9999.00',
        discount_amount: '0.00',
        tax_amount: '0.00',
        shipping_amount: '0.00',
        total_amount: '9999.00'
    }));

    assert.equal(draft.documentStatus, 'draft');
    assert.equal(draft.filename, 'SouthWest-Invoice-SWI-SNAPSHOT-1-Draft.pdf');
    assert.match(draft.content.toString('binary'), /Subtotal: Rs\. 1,000\.00/);
    assert.match(draft.content.toString('binary'), /FINAL TOTAL: Rs\. 1,100\.00/);

    const final = await generateInvoiceDocument(invoice, order({
        status: 'delivered',
        payment_status: 'paid',
        payments: [{
            payment_method: 'cash', payment_status: 'paid', amount: '1100.00'
        }],
        deliveries: [{ delivery_status: 'delivered' }]
    }));

    assert.equal(final.documentStatus, 'final');
    assert.equal(final.filename, 'SouthWest-Invoice-SWI-SNAPSHOT-1-Final.pdf');
    assert.doesNotMatch(final.content.toString('binary'), /DRAFT INVOICE/);
});

test('COD requires confirmed payment and completion before a final PDF', async () => {
    const invoice = {
        invoice_number: 'SWI-COD-1', subtotal: 100, discount_amount: 0,
        tax_amount: 0, shipping_amount: 0, total_amount: 100
    };
    const deliveredButUnpaid = await generateInvoiceDocument(invoice, order({
        status: 'delivered',
        payments: [{ payment_method: 'cash', payment_status: 'unpaid', amount: 100 }],
        deliveries: [{ delivery_status: 'delivered' }]
    }));
    assert.equal(deliveredButUnpaid.documentStatus, 'draft');

    const paidButNotCompleted = await generateInvoiceDocument(invoice, order({
        status: 'shipped',
        payment_status: 'paid',
        payments: [{ payment_method: 'cash', payment_status: 'paid', amount: 100 }],
        deliveries: [{ delivery_status: 'dispatched' }]
    }));
    assert.equal(paidButNotCompleted.documentStatus, 'draft');
});

test('verified Card, Koko, and Mintpay payments produce final PDFs', async () => {
    for (const payment_method of ['card', 'koko', 'mintpay']) {
        const document = await generateInvoiceDocument({
            invoice_number: `SWI-${payment_method}`,
            subtotal: 100,
            discount_amount: 0,
            tax_amount: 0,
            shipping_amount: 0,
            total_amount: 100
        }, order({
            payment_status: 'paid',
            payments: [{ payment_method, payment_status: 'paid', amount: 100 }]
        }));
        assert.equal(document.documentStatus, 'final');
    }
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

test('long product names and SKUs stay inside dedicated table columns', async () => {
    const pdf = await generateInvoicePdf(order({
        items: [{
            item: {
                item_name: 'Extra Long Product Name That Must Not Overlap Other Invoice Columns',
                item_code: 'EXTREMELY-LONG-SKU-VALUE-1234567890'
            },
            variant: {
                variant_name: 'Extra Long Variant Name',
                attributes: { Color: 'Ocean Blue', Size: 'Extra Large' }
            },
            quantity: 1,
            unit_price: 100,
            discount_amount: 0,
            line_total: 100
        }]
    }), { draft: true });
    const content = pdf.toString('binary');
    assert.match(content, /Extra Long Product Name/);
    assert.match(content, /EXTREMELY-LON/);
    assert.match(content, /Extra Long Variant/);
    assert.match(content, /172 529 Td \(EXTREMELY-LONG-SKU/);
    assert.match(content, /245 529 Td \(Extra Long Variant/);
});

test('long invoice keeps totals, shipping and payment summary together on the final page', async () => {
    const items = Array.from({ length: 24 }, (_, index) => ({
        name: `Product ${index + 1}`, quantity: 1, unit_price: 10, line_total: 10
    }));
    const pdf = await generateInvoicePdf(order({
        items,
        subtotal: '240.00',
        discount_amount: '10.00',
        shipping_amount: '30.00',
        total_amount: '260.00',
        payments: [{ payment_method: 'mintpay', payment_status: 'unpaid' }]
    }), { draft: true });
    const streams = [...pdf.toString('binary').matchAll(/stream\n([\s\S]*?)\nendstream/g)].map(match => match[1]);
    const lastPage = streams.find(stream => stream.includes('Product 24'));

    assert.ok(lastPage, 'final-page content stream should contain the last item');
    assert.match(lastPage, /Subtotal: Rs\. 240\.00/);
    assert.match(lastPage, /Discount: - Rs\. 10\.00/);
    assert.match(lastPage, /Actual Product Value: Rs\. 230\.00/);
    assert.match(lastPage, /Tax: Rs\. 0\.00/);
    assert.match(lastPage, /Delivery Charge: Rs\. 30\.00/);
    assert.match(lastPage, /FINAL TOTAL: Rs\. 260\.00/);
    assert.match(lastPage, /Payment Method: Mintpay/);
    assert.match(lastPage, /Payment Status: unpaid/);
    assert.match(lastPage, /Amount Paid: Rs\. 0\.00/);
    assert.match(lastPage, /Outstanding: Rs\. 260\.00/);
});

test('20-item invoice generates a two-page PDF for footer inspection', async () => {
    const fs = require('node:fs');
    const path = require('node:path');

    const items = Array.from({ length: 20 }, (_, index) => ({
        name: `Sample Product ${String(index + 1).padStart(2, '0')}`,
        quantity: 1,
        unit_price: '1250.00',
        line_total: '1250.00'
    }));

    const pdf = await generateInvoicePdf(order({
        items,
        subtotal: '25000.00',
        discount_amount: '100.00',
        shipping_amount: '800.00',
        total_amount: '25700.00'
    }), { draft: true });

    const content = pdf.toString('binary');

    assert.match(content, /Sample Product 01/);
    assert.match(content, /Sample Product 20/);
    assert.match(content, /\/Count 2\b/);
    assert.match(content, /Page 2 of 2/);

    const output = path.join(__dirname, '../../tmp/SouthWest-20-Item-Invoice.pdf');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, pdf);

    console.log(`20-item invoice preview: ${output}`);
});
