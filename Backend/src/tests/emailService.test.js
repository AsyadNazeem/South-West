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
    });

    const message = context.sentMessages[0];

    assert.match(message.subject, /SW-1001/);
    assert.match(message.text, /Test Courier/);
    assert.match(message.text, /TRACK-123/);
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
        paymentStatus: 'Unpaid'
    });

    const message = context.sentMessages[0];

    assert.equal(message.from, 'South West <orders@southwest.lk>');
    assert.equal(message.to, 'customer@example.com');
    assert.match(message.subject, /SWO-TEST-001/);
    assert.match(message.text, /Test Laptop/);
    assert.match(message.text, /95500\.00/);
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
