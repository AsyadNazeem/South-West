'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const controllers = {
    orders: read('controllers/orderController.js'),
    payments: read('controllers/paymentController.js'),
    invoices: read('controllers/invoiceController.js'),
    deliveries: read('controllers/deliveryController.js')
};

test('all four Sales list controllers apply shared phone search in the database query', () => {
    for (const [name, source] of Object.entries(controllers)) {
        assert.match(source, /buildOrderPhoneSearch\(search/, name);
        assert.match(source, /findAndCountAll\([\s\S]*replacements/, name);
    }
});

test('phone search remains combined with existing status and method filters', () => {
    assert.match(controllers.orders, /where\.status = status/);
    assert.match(controllers.orders, /where\.payment_status = paymentStatus/);
    for (const name of ['payments', 'invoices', 'deliveries']) {
        assert.match(controllers[name], /req\.query\.status|requestedStatus/, name);
    }
    assert.match(controllers.payments, /where\.payment_method = req\.query\.method/);
    assert.match(controllers.deliveries, /where\.delivery_method = req\.query\.method/);
});

test('Sales list routes retain their existing view permissions', () => {
    assert.match(read('routes/orderRoutes.js'), /requirePermission\('orders\.view'\)[\s\S]*getOrderSummaries/);
    assert.match(read('routes/paymentRoutes.js'), /requirePermission\('payments\.view'\)[\s\S]*getPayments/);
    assert.match(read('routes/invoiceRoutes.js'), /requirePermission\('invoices\.view'\)[\s\S]*getInvoices/);
    assert.match(read('routes/deliveryRoutes.js'), /requirePermission\('deliveries\.view'\)[\s\S]*getAllDeliveries/);
});

test('pagination is still applied by each backend list controller', () => {
    for (const [name, source] of Object.entries(controllers)) {
        assert.match(source, /\blimit(?:\s*:|\s*,)/, name);
        assert.match(source, /\boffset(?:\s*:|\s*,)/, name);
        assert.match(source, /totalPages/, name);
    }
});
