'use strict';

const nodemailer = require('nodemailer');

const transporters = new Map();

const SENDERS = {
    noreply: 'noreply@southwest.lk',
    info: 'info@southwest.lk',
    support: 'support@southwest.lk',
    sales: 'sales@southwest.lk',
    orders: 'orders@southwest.lk',
    admin: 'admin@southwest.lk'
};

function getTransporter(senderKey = 'noreply') {
    if (transporters.has(senderKey)) {
        return transporters.get(senderKey);
    }

    const provider = (process.env.EMAIL_PROVIDER || 'smtp')
        .trim()
        .toLowerCase();

    let config;

    if (provider === 'mailpit') {
        config = {
            host: process.env.MAILPIT_HOST || '127.0.0.1',
            port: Number(process.env.MAILPIT_PORT || 1025),
            secure: false
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
            auth: { user, pass }
        };
    } else if (provider === 'smtp') {
        const suffix = senderKey.toUpperCase();

        const user =
            process.env[`SMTP_USER_${suffix}`] ||
            process.env.SMTP_USER;

        const pass =
            process.env[`SMTP_PASS_${suffix}`] ||
            process.env.SMTP_PASS;

        if (!process.env.SMTP_HOST) {
            throw new Error('Email delivery is not configured');
        }

        config = {
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 587),
            secure: process.env.SMTP_SECURE === 'true'
        };

        if (user && pass) {
            config.auth = { user, pass };
        }
    } else {
        throw new Error(`Unsupported email provider: ${provider}`);
    }

    const transporter = nodemailer.createTransport(config);
    transporters.set(senderKey, transporter);

    return transporter;
}

function getSender(senderKey = 'noreply') {
    const address =
        process.env[`EMAIL_FROM_${senderKey.toUpperCase()}`] ||
        SENDERS[senderKey] ||
        SENDERS.noreply;

    const name = process.env.SMTP_FROM_NAME || 'South West';

    return `${name} <${address}>`;
}

async function sendEmail(senderKey, message) {
    return getTransporter(senderKey).sendMail({
        ...message,
        from: getSender(senderKey)
    });
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

    await sendEmail('noreply', {
        to: email,
        subject,
        text: [
            message,
            '',
            'This code expires in 10 minutes and can only be used once.',
            'If you did not request this code, you can ignore this email.'
        ].join('\n')
    });
}

async function sendCustomerPasswordSetupInvitation(
    email,
    customerCode,
    token
) {
    const frontendUrl = process.env.CUSTOMER_APP_URL;

    if (!frontendUrl) {
        throw new Error('CUSTOMER_APP_URL is not configured');
    }

    const setupUrl = new URL('/set-password', frontendUrl);
    setupUrl.searchParams.set('token', token);

    await sendEmail('noreply', {
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
            'If you were not expecting this invitation, you can ignore this email.'
        ].join('\n')
    });
}

function formatOrderDetails({
    orderNumber,
    customerName,
    customerEmail,
    phone,
    address,
    items,
    subtotal,
    discountAmount,
    shippingAmount,
    totalAmount,
    paymentMethod,
    paymentStatus
}) {
    const itemLines = (items || []).map((item, index) =>
        `${index + 1}. ${item.name} | Qty: ${item.quantity} | ` +
        `Unit price: LKR ${Number(item.unitPrice || 0).toFixed(2)} | ` +
        `Line total: LKR ${Number(item.lineTotal || 0).toFixed(2)}`
    );

    const addressLines = address
        ? [
            address.recipient_name,
            address.phone,
            address.address_line_1,
            address.address_line_2,
            address.city,
            address.state,
            address.postal_code,
            address.country
        ].filter(Boolean)
        : [];

    return [
        `Order: ${orderNumber}`,
        `Customer: ${customerName || 'Customer'}`,
        `Email: ${customerEmail || 'Not provided'}`,
        `Phone: ${phone || address?.phone || 'Not provided'}`,
        '',
        'DELIVERY ADDRESS',
        ...addressLines,
        '',
        'ORDER ITEMS',
        ...(itemLines.length ? itemLines : ['No item details available']),
        '',
        'PAYMENT SUMMARY',
        `Subtotal: LKR ${Number(subtotal || 0).toFixed(2)}`,
        `Discount: LKR ${Number(discountAmount || 0).toFixed(2)}`,
        `Delivery: LKR ${Number(shippingAmount || 0).toFixed(2)}`,
        `Total: LKR ${Number(totalAmount || 0).toFixed(2)}`,
        `Payment method: ${paymentMethod || 'Not provided'}`,
        `Payment status: ${paymentStatus || 'Unpaid'}`
    ].join('\n');
}

async function sendOrderConfirmationEmail(details) {
    if (!details.customerEmail) {
        throw new Error('Customer email is missing');
    }

    await sendEmail('orders', {
        to: details.customerEmail,
        subject: `South West order confirmation: ${details.orderNumber}`,
        text: [
            `Hi ${details.customerName || 'Customer'},`,
            '',
            `Thank you for shopping with South West. Your order ${details.orderNumber} has been received.`,
            '',
            formatOrderDetails(details),
            '',
            'We will keep you updated on your order.',
            '',
            'Thank you,',
            'South West'
        ].join('\n')
    });
}

async function sendAdminNewOrderEmail(details) {
    const recipients = (process.env.ORDER_NOTIFICATION_EMAIL || '')
        .split(',')
        .map(email => email.trim())
        .filter(Boolean);

    if (!recipients.length) {
        throw new Error('ORDER_NOTIFICATION_EMAIL is not configured');
    }

    await sendEmail('admin', {
        to: recipients,
        subject: `New South West order: ${details.orderNumber}`,
        text: [
            'A new order has been placed.',
            '',
            formatOrderDetails(details)
        ].join('\n')
    });
}

async function sendDeliveryTrackingEmail({
    email,
    customerName,
    orderNumber,
    trackingNumber,
    courierName,
    expectedDeliveryDate
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
            year: 'numeric'
        })
        : 'Not yet available';

    await sendEmail('orders', {
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
            'Thank you for shopping with South West.'
        ].join('\n')
    });
}

async function sendOrderStatusEmail({
    email,
    customerName,
    orderNumber,
    statusLabel,
    reason
}) {
    if (!email) {
        throw new Error('Customer email is missing');
    }

    const lines = [
        `Hi ${customerName || 'Customer'},`,
        '',
        `Your South West order ${orderNumber} has been updated.`,
        '',
        `New status: ${statusLabel}`
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

    await sendEmail('orders', {
        to: email,
        subject: `Update on your South West order ${orderNumber}`,
        text: lines.join('\n')
    });
}

module.exports = {
    sendVerificationCode,
    sendCustomerPasswordSetupInvitation,
    sendDeliveryTrackingEmail,
    sendOrderStatusEmail,
    sendOrderConfirmationEmail,
    sendAdminNewOrderEmail
};
