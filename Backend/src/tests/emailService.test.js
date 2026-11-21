'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();

const ENV_KEYS = [
    'EMAIL_PROVIDER',
    'EMAIL_FROM',
    'MAILPIT_HOST',
    'MAILPIT_PORT',
    'BREVO_SMTP_LOGIN',
    'BREVO_SMTP_KEY',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_SECURE',
    'SMTP_USER',
    'SMTP_PASS',
    'SMTP_FROM',
    'CUSTOMER_APP_URL',
    'ORDER_NOTIFICATION_EMAIL',
];

function loadEmailService(values = {}) {
    const originalEnv = {};

    for (const key of ENV_KEYS) {
        originalEnv[key] = process.env[key];
        delete process.env[key];
    }

    Object.assign(process.env, values);

    let transportConfig;
    const sentMessages = [];

    const service = proxyquire('../services/emailService', {
        nodemailer: {
            createTransport(config) {
                transportConfig = config;

                return {
                    async sendMail(message) {
                        sentMessages.push(message);
                        return { messageId: 'test-message-id' };
                    },
                };
            },
        },
    });

    function restoreEnv() {
        for (const key of ENV_KEYS) {
            if (originalEnv[key] === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = originalEnv[key];
            }
        }
    }

    return {
        service,
        sentMessages,
        get transportConfig() {
            return transportConfig;
        },
        restoreEnv,
    };
}

test('Mailpit uses local SMTP without authentication', async (t) => {
    const context = loadEmailService({
        EMAIL_PROVIDER: 'mailpit',
    });
    t.after(context.restoreEnv);

    await context.service.sendVerificationCode(
        'customer@example.com',
        '123456',
        'registration'
    );

    assert.deepEqual(context.transportConfig, {
        host: '127.0.0.1',
        port: 1025,
        secure: false,
    });

    assert.equal(context.sentMessages.length, 1);
    assert.equal(context.sentMessages[0].to, 'customer@example.com');
    assert.match(context.sentMessages[0].text, /123456/);
    assert.match(context.sentMessages[0].html, /southwest\.lk\/SWLogo\.png/);
    assert.match(context.sentMessages[0].html, /123456/);
    assert.match(context.sentMessages[0].html, /If you did not request it/);
    assert.doesNotMatch(context.sentMessages[0].html, /If youdid not request it/);
});

test('Mailpit accepts custom host and port', async (t) => {
    const context = loadEmailService({
        EMAIL_PROVIDER: 'mailpit',
        MAILPIT_HOST: 'localhost',
        MAILPIT_PORT: '2525',
    });
    t.after(context.restoreEnv);

    await context.service.sendVerificationCode(
        'customer@example.com',
        '123456',
        'activation'
    );

    assert.equal(context.transportConfig.host, 'localhost');
    assert.equal(context.transportConfig.port, 2525);
});

test('Brevo uses its SMTP relay and configured credentials', async (t) => {
    const context = loadEmailService({
        EMAIL_PROVIDER: 'brevo',
        BREVO_SMTP_LOGIN: 'smtp-login@example.com',
        BREVO_SMTP_KEY: 'test-smtp-key',
    });
    t.after(context.restoreEnv);

    await context.service.sendVerificationCode(
        'customer@example.com',
        '123456',
        'password_change'
    );

    assert.deepEqual(context.transportConfig, {
        host: 'smtp-relay.brevo.com',
        port: 587,
        secure: false,
        auth: {
            user: 'smtp-login@example.com',
            pass: 'test-smtp-key',
        },
    });

    assert.match(context.sentMessages[0].subject, /password-change code/i);
});

test('Brevo rejects missing SMTP credentials', async (t) => {
    const context = loadEmailService({
        EMAIL_PROVIDER: 'brevo',
        BREVO_SMTP_LOGIN: 'smtp-login@example.com',
    });
    t.after(context.restoreEnv);

    await assert.rejects(
        context.service.sendVerificationCode(
            'customer@example.com',
            '123456',
            'registration'
        ),
        /Brevo SMTP credentials are not configured/
    );

    assert.equal(context.transportConfig, undefined);
});

test('generic SMTP remains compatible with existing configuration', async (t) => {
    const context = loadEmailService({
        EMAIL_PROVIDER: 'smtp',
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: '465',
        SMTP_SECURE: 'true',
        SMTP_USER: 'user@example.com',
        SMTP_PASS: 'test-password',
    });
    t.after(context.restoreEnv);

    await context.service.sendVerificationCode(
        'customer@example.com',
        '123456',
        'registration'
    );

    assert.deepEqual(context.transportConfig, {
        host: 'smtp.example.com',
        port: 465,
        secure: true,
        auth: {
            user: 'user@example.com',
            pass: 'test-password',
        },
    });
});

test('password invitation retains the customer setup URL and token', async (t) => {
    const context = loadEmailService({
        EMAIL_PROVIDER: 'mailpit',
        CUSTOMER_APP_URL: 'http://localhost:5174',
        EMAIL_FROM: 'South West <noreply@southwest.lk>',
    });
    t.after(context.restoreEnv);

    await context.service.sendCustomerPasswordSetupInvitation(
        'customer@example.com',
        'WEB-000123',
        'sample-token'
    );

    const message = context.sentMessages[0];

    assert.equal(message.from, 'South West <noreply@southwest.lk>');
    assert.equal(message.to, 'customer@example.com');
    assert.match(message.text, /WEB-000123/);
    assert.match(
        message.text,
        /http:\/\/localhost:5174\/set-password\?token=sample-token/
    );
});

test('password reset email uses a fragment token and describes expiry and safe disregard', async (t) => {
    const context = loadEmailService({
        EMAIL_PROVIDER: 'mailpit',
        CUSTOMER_APP_URL: 'https://shop.example.test',
    });
    t.after(context.restoreEnv);

    await context.service.sendCustomerPasswordReset('customer@example.com', 'secure-token');
    const message = context.sentMessages[0];
    assert.equal(message.to, 'customer@example.com');
    assert.match(message.text, /https:\/\/shop\.example\.test\/reset-password#token=secure-token/);
    assert.match(message.text, /expires in 20 minutes/i);
    assert.match(message.text, /ignore this email/i);
});

test('delivery tracking email retains courier and tracking details', async (t) => {
    const context = loadEmailService({
        EMAIL_PROVIDER: 'mailpit',
    });
    t.after(context.restoreEnv);

    await context.service.sendDeliveryTrackingEmail({
        email: 'customer@example.com',
        customerName: 'Test Customer',
        orderNumber: 'SW-1001',
        trackingNumber: 'TRACK-123',
        courierName: 'Test Courier',
        trackingUrl: 'https://courier.example/track/TRACK-123',
    });

    const message = context.sentMessages[0];

    assert.match(message.subject, /SW-1001/);
    assert.match(message.text, /Test Courier/);
    assert.match(message.text, /TRACK-123/);
    assert.match(message.text, /Track Your Order: https:\/\/courier\.example\/track\/TRACK-123/);
    assert.match(message.html, /href="https:\/\/courier\.example\/track\/TRACK-123"/);
    assert.match(message.html, /Track Your Order/);
    assert.match(message.html, /handed over to the courier/);
    assert.doesNotMatch(message.html, /handed over tothe courier/);
});

test('tracking email omits the link button when no tracking URL is available', async (t) => {
    const context = loadEmailService({ EMAIL_PROVIDER: 'mailpit' });
    t.after(context.restoreEnv);
    await context.service.sendDeliveryTrackingEmail({
        email: 'customer@example.com',
        orderNumber: 'SW-1004',
        trackingNumber: 'TRACK-456',
        courierName: 'Courier'
    });
    assert.doesNotMatch(context.sentMessages[0].html, /Track Your Order/);
    assert.doesNotMatch(context.sentMessages[0].text, /Track Your Order:/);
});

test('order status email retains status and optional reason', async (t) => {
    const context = loadEmailService({
        EMAIL_PROVIDER: 'mailpit',
    });
    t.after(context.restoreEnv);

    await context.service.sendOrderStatusEmail({
        email: 'customer@example.com',
        customerName: 'Test Customer',
        orderNumber: 'SW-1002',
        statusLabel: 'Cancelled',
        reason: 'Customer request',
    });

    const message = context.sentMessages[0];

    assert.match(message.subject, /SW-1002/);
    assert.match(message.text, /New status: Cancelled/);
    assert.match(message.text, /Reason: Customer request/);
});

test('tracking and order status emails reject missing customer email', async (t) => {
    const context = loadEmailService({
        EMAIL_PROVIDER: 'mailpit',
    });
    t.after(context.restoreEnv);

    await assert.rejects(
        context.service.sendDeliveryTrackingEmail({
            trackingNumber: 'TRACK-123',
            courierName: 'Test Courier',
        }),
        /Customer email is missing/
    );

    await assert.rejects(
        context.service.sendOrderStatusEmail({
            orderNumber: 'SW-1003',
            statusLabel: 'Delivered',
        }),
        /Customer email is missing/
    );
});

test('order confirmation uses orders sender and includes order details', async (t) => {
    const context = loadEmailService({
        EMAIL_PROVIDER: 'mailpit'
    });
    t.after(context.restoreEnv);

    await context.service.sendOrderConfirmationEmail({
        orderNumber: 'SWO-TEST-001',
        customerName: 'Test Customer',
        customerEmail: 'customer@example.com',
        phone: '0771234567',
        address: {
            recipient_name: 'Test Customer',
            address_line_1: 'Test Street',
            city: 'Colombo',
            country: 'Sri Lanka'
        },
        items: [{
            name: 'Test Laptop',
            quantity: 2,
            unitPrice: 50000,
            lineTotal: 100000
        }],
        subtotal: 100000,
        discountAmount: 5000,
        shippingAmount: 500,
        totalAmount: 95500,
        paymentMethod: 'cash',
        paymentStatus: 'Unpaid',
        invoiceAttachment: {
            filename: 'SWO-TEST-001-Draft-Invoice.pdf',
            content: Buffer.from('%PDF-test'),
            contentType: 'application/pdf'
        }
    });

    const message = context.sentMessages[0];

    assert.equal(message.from, 'South West <orders@southwest.lk>');
    assert.equal(message.to, 'customer@example.com');
    assert.match(message.subject, /SWO-TEST-001/);
    assert.match(message.text, /Test Laptop/);
    assert.match(message.html, /Your order has been received/);
    assert.match(message.html, /Payment status/);
    assert.match(message.text, /95500\.00/);
    assert.equal(message.attachments[0].contentType, 'application/pdf');
    assert.equal(message.attachments[0].filename, 'SWO-TEST-001-Draft-Invoice.pdf');
});

test('admin notification uses admin sender and configured Gmail recipient', async (t) => {
    const context = loadEmailService({
        EMAIL_PROVIDER: 'mailpit',
        ORDER_NOTIFICATION_EMAIL: 'admin@gmail.com'
    });
    t.after(context.restoreEnv);

    await context.service.sendAdminNewOrderEmail({
        orderNumber: 'SWO-TEST-002',
        customerName: 'Test Customer',
        customerEmail: 'customer@example.com',
        phone: '0771234567',
        address: {
            recipient_name: 'Test Customer',
            address_line_1: 'Test Street',
            city: 'Colombo',
            country: 'Sri Lanka'
        },
        items: [{
            name: 'Test SSD',
            quantity: 1,
            unitPrice: 15000,
            lineTotal: 15000
        }],
        subtotal: 15000,
        discountAmount: 0,
        shippingAmount: 500,
        totalAmount: 15500,
        paymentMethod: 'cash',
        paymentStatus: 'Unpaid'
    });

    const message = context.sentMessages[0];

    assert.equal(message.from, 'South West <admin@southwest.lk>');
    assert.deepEqual(message.to, ['admin@gmail.com']);
    assert.match(message.subject, /SWO-TEST-002/);
    assert.match(message.text, /Test SSD/);
    assert.match(message.text, /customer@example.com/);
});

test('admin notification rejects missing notification recipient', async (t) => {
    const context = loadEmailService({
        EMAIL_PROVIDER: 'mailpit'
    });
    t.after(context.restoreEnv);

    await assert.rejects(
        context.service.sendAdminNewOrderEmail({
            orderNumber: 'SWO-TEST-003'
        }),
        /ORDER_NOTIFICATION_EMAIL is not configured/
    );
});

test('warranty updates escape customer text and omit internal notes and evidence', async t => {
    const mail = loadEmailService({ EMAIL_PROVIDER: 'mailpit', CUSTOMER_APP_URL: 'https://fixture.invalid' });
    t.after(mail.restoreEnv);
    await mail.service.sendWarrantyUpdate('customer@example.invalid', { id: 13, reference: 'WC-TEST', product: '<b>Camera</b>' },
        { id: 42, created_at:new Date(0), previous_status:'Submitted', new_status: 'Under Review', message: '<i>Received</i>', internal_note: 'private fixture' });
    const [sent] = mail.sentMessages;
    assert.match(sent.html,/&lt;b&gt;Camera/);
    assert.match(sent.html,/&lt;i&gt;Received/);
    assert.match(sent.html,/https:\/\/fixture.invalid\/account\/warranty-claims\/13/);
    assert.doesNotMatch(sent.html + sent.text,/private fixture/);
    assert.equal(sent.attachments,undefined);
    assert.equal(sent.messageId,'<warranty-42@southwest.lk>');
});


test('each warranty transition identifies both statuses and event time', async t => {
    const mail = loadEmailService({ EMAIL_PROVIDER:'mailpit' });
    t.after(mail.restoreEnv);
    const transitions = [['Submitted','Under Review'],['Under Review','More Evidence Required'],
        ['More Evidence Required','Evidence Submitted'],['Evidence Submitted','Approved'],['Under Review','Rejected'],
        ['Approved','Processing'],['Processing','Resolved'],['Resolved','Closed']];
    for (const [previous_status,new_status] of transitions) {
        await mail.service.sendWarrantyUpdate('fixture@example.invalid',{id:2,product:'Camera',reference:'WC-2'},
            {id:3,previous_status,new_status,created_at:new Date('2026-11-21T06:00:00Z')});
        const message = mail.sentMessages.at(-1);
        for (const part of [previous_status,new_status,'21/11/2026','11:30','Camera','WC-2']) assert.ok(message.text.includes(part));
    }
});

test('new claim email identifies purchase and initial evidence without private attachments', async t => {
    const mail = loadEmailService({EMAIL_PROVIDER:'mailpit'});
    t.after(mail.restoreEnv);
    await mail.service.sendAdminWarrantyClaim({id:6,email:'reviewer@example.invalid'},
        {id:4,reference:'WC-4',customer_name:'Buyer',order_number:'ORDER4',invoice_number:'INV4',
            product:'Camera',reason:'<b>Damaged</b>'}, {id:1,created_at:new Date()},3,1);
    const [message] = mail.sentMessages;
    for (const part of ['WC-4','Buyer','ORDER4','INV4','Camera','3 photos','1 videos','/admin/sales/warranty-claims/4']) assert.ok(message.text.includes(part));
    assert.match(message.html,/&lt;b&gt;Damaged/);
    assert.equal(message.attachments,undefined);
});
