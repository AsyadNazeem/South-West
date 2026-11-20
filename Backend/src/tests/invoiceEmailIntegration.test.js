'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = relative => fs.readFileSync(
    path.join(__dirname, '..', relative),
    'utf8'
);

test('registered and guest COD checkout use the saved invoice attachment service', () => {
    for (const controller of [
        read('controllers/customerCheckoutController.js'),
        read('controllers/guestCheckoutController.js')
    ]) {
        assert.match(controller, /paymentM(?:ethod|_method) === 'cash'[\s\S]*getOrderInvoiceAttachment\(order\.id\)/);
        assert.doesNotMatch(controller, /generateInvoicePdf\(/);
        assert.doesNotMatch(controller, /Invoice\.create\([\s\S]*Invoice\.create\(/);
    }
});

test('COD completion requests a final attachment only after lifecycle completion', () => {
    const delivery = read('controllers/deliveryController.js');
    assert.match(delivery, /getOrderInvoiceAttachment\([\s\S]*finalOnly: true/);
    assert.match(delivery, /previousStatus !== 'delivered'/);
    assert.match(delivery, /order\.payment_status === 'paid'/);
});

test('future online payment integration remains internal and manual confirmation stays disabled', () => {
    const service = read('services/paidOrderInvoiceEmailService.js');
    const paymentController = read('controllers/paymentController.js');
    const routes = read('routes/invoiceRoutes.js');

    assert.match(service, /sendPaidOrderConfirmationWithInvoice/);
    assert.match(service, /after[\s\S]*transaction has committed successfully/i);
    assert.match(paymentController, /Online payments require verified provider confirmation/);
    assert.doesNotMatch(routes, /paidOrderInvoiceEmail|sendPaidOrderConfirmation/);
});
