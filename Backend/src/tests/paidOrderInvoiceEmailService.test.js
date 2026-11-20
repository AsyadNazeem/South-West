'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();

function harness(overrides = {}) {
    const invoice = {
        id: 91,
        invoice_number: 'SWI-EMAIL-91',
        invoice_date: '2026-11-20T00:00:00Z',
        status: 'paid',
        subtotal: '900.00',
        discount_amount: '50.00',
        tax_amount: '0.00',
        shipping_amount: '150.00',
        total_amount: '1000.00',
        final_email_status: null,
        ...overrides.invoice
    };
    const payment = {
        payment_method: 'card',
        payment_status: 'paid',
        payment_reference: 'PAY-91',
        amount: '1000.00',
        payment_date: '2026-11-20T01:00:00Z',
        ...overrides.payment
    };
    const order = {
        id: 51,
        order_number: 'SWO-EMAIL-51',
        order_date: '2026-11-20T00:00:00Z',
        status: 'confirmed',
        payment_status: 'paid',
        customer_email: 'guest@example.com',
        customer: null,
        addresses: [{
            address_type: 'shipping',
            recipient_name: 'Guest Customer',
            phone: '0771234567',
            address_line_1: '1 Main Road',
            district: { district_name: 'Colombo' },
            area: { area_name: 'Colombo 03' },
            postal_code: '00300'
        }],
        items: [{
            item: { item_name: 'Test Product' },
            variant: { variant_name: 'Blue' },
            quantity: 1,
            unit_price: '900.00',
            line_total: '900.00'
        }],
        payments: [payment],
        invoices: [invoice],
        deliveries: [],
        ...overrides.order
    };
    const calls = { emails: [], updates: [], attempts: 0 };
    let failuresRemaining = overrides.emailFailures || 0;
    let releaseEmail = null;
    const emailGate = overrides.holdEmail
        ? new Promise(resolve => { releaseEmail = resolve; })
        : null;

    const Invoice = {
        async update(values) {
            calls.updates.push(values);
            if (values.final_email_status === 'sending') {
                if (!['failed', null].includes(invoice.final_email_status)) return [0];
                invoice.final_email_status = 'sending';
                calls.attempts += 1;
                return [1];
            }
            Object.assign(invoice, values);
            return [1];
        }
    };

    const service = proxyquire('../services/paidOrderInvoiceEmailService', {
        '../models': { Invoice },
        './invoicePdfService': {
            async loadOrderInvoiceData() {
                return overrides.missingOrder ? null : order;
            },
            async generateInvoiceDocument() {
                return {
                    content: Buffer.from('%PDF-admin-invoice'),
                    contentType: 'application/pdf',
                    documentStatus: overrides.documentStatus || 'final',
                    filename: 'SouthWest-Invoice-SWI-EMAIL-91-Final.pdf'
                };
            }
        },
        './emailService': {
            async sendOrderConfirmationEmail(details) {
                calls.emails.push(details);
                if (emailGate) await emailGate;
                if (failuresRemaining > 0) {
                    failuresRemaining -= 1;
                    throw new Error('Synthetic SMTP failure');
                }
            }
        }
    });

    return { calls, invoice, order, releaseEmail, service };
}

for (const paymentMethod of ['card', 'koko', 'mintpay']) {
    test(`verified ${paymentMethod} payment sends one final Admin PDF`, async () => {
        const h = harness({ payment: { payment_method: paymentMethod } });
        const result = await h.service.sendPaidOrderConfirmationWithInvoice(51);

        assert.equal(result.status, 'sent');
        assert.equal(h.calls.emails.length, 1);
        assert.equal(h.calls.emails[0].customerEmail, 'guest@example.com');
        assert.equal(h.calls.emails[0].invoiceAttachment.content.toString(), '%PDF-admin-invoice');
        assert.equal(h.calls.emails[0].subtotal, '900.00');
        assert.equal(h.calls.emails[0].totalAmount, '1000.00');
        assert.equal(h.invoice.final_email_status, 'sent');
    });
}

test('registered customer email is used when the order has no guest email', async () => {
    const h = harness({
        order: {
            customer_email: null,
            customer: {
                first_name: 'Registered', last_name: 'Customer',
                email: 'registered@example.com'
            }
        }
    });
    const result = await h.service.sendPaidOrderConfirmationWithInvoice(51);
    assert.equal(result.status, 'sent');
    assert.equal(h.calls.emails[0].customerEmail, 'registered@example.com');
});

test('pending, failed, and partially paid orders do not send a final invoice', async () => {
    for (const payment_status of ['pending', 'failed', 'partially_paid']) {
        const h = harness({
            payment: { payment_status },
            order: { payment_status: payment_status === 'partially_paid'
                ? 'partially_paid'
                : 'unpaid' }
        });
        const result = await h.service.sendPaidOrderConfirmationWithInvoice(51);
        assert.equal(result.status, 'skipped');
        assert.equal(h.calls.emails.length, 0);
    }
});

test('missing customer email and missing invoice are skipped safely', async () => {
    const missingEmail = harness({
        order: { customer_email: null, customer: null }
    });
    assert.deepEqual(
        await missingEmail.service.sendPaidOrderConfirmationWithInvoice(51),
        { status: 'skipped', reason: 'customer_email_missing' }
    );

    const missingInvoice = harness({ order: { invoices: [] } });
    assert.deepEqual(
        await missingInvoice.service.sendPaidOrderConfirmationWithInvoice(51),
        { status: 'skipped', reason: 'invoice_not_found' }
    );
});

test('repeated and concurrent calls cannot send duplicate emails', async () => {
    const h = harness({ holdEmail: true });
    const first = h.service.sendPaidOrderConfirmationWithInvoice(51);
    await new Promise(resolve => setImmediate(resolve));
    const secondResult = await h.service.sendPaidOrderConfirmationWithInvoice(51);

    assert.deepEqual(secondResult, { status: 'skipped', reason: 'already_claimed' });
    assert.equal(h.calls.emails.length, 1);
    h.releaseEmail();
    assert.equal((await first).status, 'sent');

    const repeated = await h.service.sendPaidOrderConfirmationWithInvoice(51);
    assert.deepEqual(repeated, { status: 'skipped', reason: 'already_sent' });
    assert.equal(h.calls.emails.length, 1);
});

test('failed email is recorded and can be retried safely', async () => {
    const h = harness({ emailFailures: 1 });
    const originalError = console.error;
    console.error = () => {};
    try {
        assert.equal(
            (await h.service.sendPaidOrderConfirmationWithInvoice(51)).status,
            'failed'
        );
        assert.equal(h.invoice.final_email_status, 'failed');
        assert.equal(
            (await h.service.sendPaidOrderConfirmationWithInvoice(51)).status,
            'sent'
        );
    } finally {
        console.error = originalError;
    }
    assert.equal(h.calls.emails.length, 2);
    assert.equal(h.calls.attempts, 2);
});
