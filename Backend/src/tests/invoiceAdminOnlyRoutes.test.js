'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const invoiceRoutes = read('routes/invoiceRoutes.js');
const customerRoutes = read('routes/customerOrderRoutes.js');
const guestRoutes = read('routes/guestCheckoutRoutes.js');
const invoiceController = read('controllers/invoiceController.js');
const invoicePdfService = read('services/invoicePdfService.js');

test('all invoice endpoints require admin authentication and invoices.view', () => {
    assert.match(invoiceRoutes, /authenticate[\s\S]*requirePermission\('invoices\.view'\)[\s\S]*getInvoices/);
    assert.match(invoiceRoutes, /authenticate[\s\S]*requirePermission\('invoices\.view'\)[\s\S]*downloadInvoicePdf/);
    assert.match(invoiceRoutes, /authenticate[\s\S]*requirePermission\('invoices\.view'\)[\s\S]*getInvoiceById/);
});

test('customer and guest routes do not expose invoice documents', () => {
    assert.doesNotMatch(customerRoutes, /document|invoice/i);
    assert.doesNotMatch(guestRoutes, /orders\/:orderId\/document|orderDocumentController/);
});

test('admin invoice reads never create duplicate invoice records', () => {
    assert.doesNotMatch(invoiceController, /Invoice\.create|Invoice\.build|bulkCreate/);
    assert.doesNotMatch(invoiceRoutes, /router\.(post|put|patch|delete)/);
});

test('downloadable PDFs use the stored invoice monetary snapshot', () => {
    for (const field of [
        'subtotal', 'discount_amount', 'tax_amount', 'shipping_amount', 'total_amount'
    ]) {
        assert.match(invoicePdfService, new RegExp(`${field}: invoice\\.${field}`));
    }
    assert.match(invoiceController, /generateInvoiceDocument\(invoice\)/);
});
