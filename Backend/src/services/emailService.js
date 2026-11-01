
'use strict';

const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
    if (transporter) return transporter;

    const provider = (process.env.EMAIL_PROVIDER || 'smtp')
        .trim()
        .toLowerCase();

    let config;

    if (provider === 'mailpit') {
        config = {
            host: process.env.MAILPIT_HOST || '127.0.0.1',
            port: Number(process.env.MAILPIT_PORT || 1025),
            secure: false,
        };
    } else if (provider === 'brevo') {
        const user = process.env.BREVO_SMTP_LOGIN;
        const pass = process.env.BREVO_SMTP_KEY;

        if (!user || !pass) {
            throw new Error('Brevo SMTP credentials are not configured');
        }

        config = {
            host: 'smtp-relay.brevo.com',
            port: 587,
            secure: false,
            auth: { user, pass },
        };
    } else if (provider === 'smtp') {
        const {
            SMTP_HOST,
            SMTP_PORT,
            SMTP_SECURE,
            SMTP_USER,
            SMTP_PASS,
        } = process.env;

        if (!SMTP_HOST) {
            throw new Error('Email delivery is not configured');
        }

        config = {
            host: SMTP_HOST,
            port: Number(SMTP_PORT || 587),
            secure: SMTP_SECURE === 'true',
        };

        if (SMTP_USER && SMTP_PASS) {
            config.auth = {
                user: SMTP_USER,
                pass: SMTP_PASS,
            };
        }
    } else {
        throw new Error(`Unsupported email provider: ${provider}`);
    }

    transporter = nodemailer.createTransport(config);
    return transporter;
}

function getSender(defaultSender) {
    return (
        process.env.EMAIL_FROM ||
        process.env.SMTP_FROM ||
        process.env.SMTP_USER ||
        defaultSender
    );
}

async function sendVerificationCode(email, code, purpose) {
    const isActivation = purpose === 'activation';
    const isPasswordChange = purpose === 'password_change';

    const subject = isPasswordChange
        ? 'Your South West password-change code'
        : isActivation
            ? 'Activate your South West customer account'
            : 'Verify your South West email address';

    const message = isPasswordChange
        ? `Your South West password-change code is: ${code}`
        : `Your South West verification code is: ${code}`;

    await getTransporter().sendMail({
        from: getSender('South West Dev <dev@southwest.local>'),
        to: email,
        subject,
        text: [
            message,
            '',
            'This code expires in 10 minutes and can only be used once.',
            'If you did not request this code, you can ignore this email.',
        ].join('\n'),
    });
}

async function sendCustomerPasswordSetupInvitation(email, customerCode, token) {
    const frontendUrl = process.env.CUSTOMER_APP_URL;

    if (!frontendUrl) {
        throw new Error('CUSTOMER_APP_URL is not configured');
    }

    const setupUrl = new URL('/set-password', frontendUrl);
    setupUrl.searchParams.set('token', token);

    await getTransporter().sendMail({
        from: getSender('South West <noreply@southwest.local>'),
        to: email,
        subject: 'Set up your South West customer account',
        text: [
            'Welcome to South West!',
            '',
            `Your customer code is: ${customerCode}`,
            '',
            'Use the link below to set your account password:',
            setupUrl.toString(),
            '',
            'This link expires in 10 minutes and can only be used once.',
            'If you were not expecting this invitation, you can ignore this email.',
        ].join('\n'),
    });
}

async function sendDeliveryTrackingEmail({
    email,
    customerName,
    orderNumber,
    trackingNumber,
    courierName,
    expectedDeliveryDate,
}) {
    if (!email) {
        throw new Error('Customer email is missing');
    }

    if (!trackingNumber || !courierName) {
        throw new Error('Tracking number and courier are required');
    }

    const expectedDeliveryText = expectedDeliveryDate
        ? new Date(expectedDeliveryDate).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
          })
        : 'Not yet available';

    await getTransporter().sendMail({
        from: getSender('South West <noreply@southwest.local>'),
        to: email,
        subject: `Your South West order ${orderNumber} has been dispatched`,
        text: [
            `Hi ${customerName || 'Customer'},`,
            '',
            `Your South West order ${orderNumber} has been handed over to the courier.`,
            '',
            `Courier: ${courierName}`,
            `Tracking number: ${trackingNumber}`,
            `Expected delivery: ${expectedDeliveryText}`,
            '',
            'You can view your order and tracking details in your South West customer account.',
            '',
            'Thank you for shopping with South West.',
        ].join('\n'),
    });
}

async function sendOrderStatusEmail({
    email,
    customerName,
    orderNumber,
    statusLabel,
    reason,
}) {
    if (!email) {
        throw new Error('Customer email is missing');
    }

    const subject = `Update on your South West order ${orderNumber}`;

    const lines = [
        `Hi ${customerName || 'Customer'},`,
        '',
        `Your South West order ${orderNumber} has been updated.`,
        '',
        `New status: ${statusLabel}`,
    ];

    if (reason) {
        lines.push('', `Reason: ${reason}`);
    }

    lines.push(
        '',
        'You can view your order in your South West customer account.',
        '',
        'Thank you for shopping with South West.'
    );

    await getTransporter().sendMail({
        from: getSender('South West <noreply@southwest.local>'),
        to: email,
        subject,
        text: lines.join('\n'),
    });
}

module.exports = {
    sendVerificationCode,
    sendCustomerPasswordSetupInvitation,
    sendDeliveryTrackingEmail,
    sendOrderStatusEmail,
};
