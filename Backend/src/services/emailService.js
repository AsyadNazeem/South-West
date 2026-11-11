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

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
}

function brandedEmail({ heading, preheader, body }) {
    const logo = process.env.SOUTH_WEST_LOGO_URL || 'https://southwest.lk/SWLogo.png';
    return `<!doctype html><html><body style="margin:0;background:#f5f6f4;font-family:Arial,sans-serif;color:#252a27"><div style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader || heading)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f6f4;padding:24px 12px"><tr><td align="center"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#fff;border-radius:8px;overflow:hidden"><tr><td style="background:#193c32;padding:20px 28px"><img src="${escapeHtml(logo)}" alt="South West" width="150" style="display:block;max-width:150px;height:auto"></td></tr><tr><td style="padding:28px"><h1 style="font-size:22px;line-height:1.3;margin:0 0 20px;color:#193c32">${escapeHtml(heading)}</h1>${body}<p style="border-top:1px solid #e4e8e5;padding-top:18px;margin:28px 0 0;color:#68716c;font-size:13px;line-height:1.6">South West · <a href="https://southwest.lk" style="color:#193c32">southwest.lk</a><br>For help, contact support@southwest.lk</p></td></tr></table></td></tr></table></body></html>`;
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
        html: brandedEmail({
            heading: isActivation ? 'Verify your email address' : isPasswordChange ? 'Confirm your password change' : 'Your verification code',
            preheader: 'Your South West verification code',
            body: `<p style="font-size:15px;line-height:1.6">Use this code to continue:</p><p style="background:#f1f5f2;border-radius:6px;padding:18px;text-align:center;font-size:30px;font-weight:bold;letter-spacing:8px;color:#193c32">${escapeHtml(code)}</p><p style="font-size:14px;line-height:1.6">This code expires in 10 minutes and can only be used once. Do not share it with anyone. If you did not request it, you can ignore this email.</p>`
        }),
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

async function sendCustomerPasswordReset(email, token) {
    const frontendUrl = process.env.CUSTOMER_APP_URL;
    if (!frontendUrl) throw new Error('CUSTOMER_APP_URL is not configured');

    const resetUrl = new URL('/reset-password', frontendUrl);
    // URL fragments are not sent in HTTP requests or Referer headers.
    resetUrl.hash = `token=${encodeURIComponent(token)}`;

    await sendEmail('noreply', {
        to: email,
        subject: 'Reset your South West password',
        html: brandedEmail({
            heading: 'Reset your password',
            preheader: 'A password reset was requested for your South West account.',
            body: `<p style="font-size:15px;line-height:1.6">Use the button below to choose a new password. This link expires in 20 minutes and can only be used once.</p><p style="margin:24px 0"><a href="${escapeHtml(resetUrl.toString())}" style="display:inline-block;background:#193c32;color:#fff;text-decoration:none;padding:13px 22px;border-radius:5px;font-weight:bold">Reset password</a></p><p style="font-size:14px;line-height:1.6">If you did not request a password reset, you can ignore this email.</p>`
        }),
        text: [
            'A password reset was requested for your South West account.',
            '',
            'Use this secure link to create a new password:',
            resetUrl.toString(),
            '',
            'This link expires in 20 minutes and can only be used once.',
            'If you did not request a password reset, you can ignore this email.',
            '',
            'South West',
        ].join('\n'),
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
    normalDeliveryAmount,
    additionalShippingAmount,
    totalAmount,
    paymentMethod,
    paymentStatus
}) {
    const itemLines = (items || []).map((item, index) =>
        `${index + 1}. ${item.name}${item.variantName ? ` - ${item.variantName}` : ''} | Qty: ${item.quantity} | ` +
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
        `Delivery: LKR ${Number(normalDeliveryAmount ?? shippingAmount ?? 0).toFixed(2)}`,
        ...(Number(additionalShippingAmount || 0) > 0 ? [`Additional shipping: LKR ${Number(additionalShippingAmount).toFixed(2)}`] : []),
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
        html: brandedEmail({
            heading: 'Your order has been received',
            preheader: `Order ${details.orderNumber} confirmation`,
            body: `<p style="font-size:15px;line-height:1.6">Hi ${escapeHtml(details.customerName || 'Customer')}, thank you for shopping with South West. Your order <strong>${escapeHtml(details.orderNumber)}</strong> has been received.</p><div style="background:#f1f5f2;border-left:4px solid #193c32;padding:14px 16px;margin:20px 0"><strong>Payment method:</strong> ${escapeHtml(details.paymentMethod || 'Not provided')}<br><strong>Payment status:</strong> ${escapeHtml(details.paymentStatus || 'Unpaid')}</div><pre style="white-space:pre-wrap;font:14px/1.6 Arial,sans-serif;background:#fafbf9;padding:16px;border:1px solid #e6eae7;border-radius:5px">${escapeHtml(formatOrderDetails(details))}</pre><p style="font-size:14px;line-height:1.6">We will keep you updated on your order.</p>`
        }),
        attachments: details.invoiceAttachment ? [details.invoiceAttachment] : undefined,
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
        html: brandedEmail({
            heading: 'New order received',
            preheader: `New South West order ${details.orderNumber}`,
            body: `<pre style="white-space:pre-wrap;font:14px/1.6 Arial,sans-serif">${escapeHtml(formatOrderDetails(details))}</pre>`
        }),
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
    expectedDeliveryDate,
    trackingUrl,
    orderDetails
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
    const itemSummaryText = (orderDetails?.items || []).map(item =>
        `- ${item.name}${item.variantName ? ` (${item.variantName})` : ''} | Qty: ${item.quantity} | ${item.lineTotal}`
    );
    const itemSummaryHtml = (orderDetails?.items || []).map(item =>
        `<p style="margin:8px 0;font-size:14px">${escapeHtml(item.name)}${item.variantName ? ` - ${escapeHtml(item.variantName)}` : ''} × ${escapeHtml(item.quantity)} <span style="float:right">${escapeHtml(item.lineTotal)}</span></p>`
    ).join('');

    await sendEmail('orders', {
        to: email,
        subject: `Your South West order ${orderNumber} has been dispatched`,
        html: brandedEmail({
            heading: 'Your order has been dispatched',
            preheader: `Tracking details for order ${orderNumber}`,
            body: `<p style="font-size:15px;line-height:1.6">Hi ${escapeHtml(customerName || 'Customer')}, your South West order <strong>${escapeHtml(orderNumber)}</strong> has been handed over to the courier.</p><div style="background:#f1f5f2;padding:16px;border-radius:5px;font-size:14px;line-height:1.8"><strong>Courier:</strong> ${escapeHtml(courierName)}<br><strong>Tracking number:</strong> ${escapeHtml(trackingNumber)}<br><strong>Expected delivery:</strong> ${escapeHtml(expectedDeliveryText)}${orderDetails ? `<br><strong>Payment:</strong> ${escapeHtml(orderDetails.paymentMethod)} (${escapeHtml(orderDetails.paymentStatus)})<br><strong>Order total:</strong> ${escapeHtml(orderDetails.totalAmount)}` : ''}</div>${trackingUrl ? `<p style="margin:24px 0"><a href="${escapeHtml(trackingUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#193c32;color:#fff;text-decoration:none;padding:13px 22px;border-radius:5px;font-weight:bold">Track Your Order</a></p>` : ''}${itemSummaryHtml}<p style="font-size:14px;line-height:1.6">You can view your order and tracking details in your South West customer account.</p>`
        }),
        attachments: orderDetails?.invoiceAttachment ? [orderDetails.invoiceAttachment] : undefined,
        text: [
            `Hi ${customerName || 'Customer'},`,
            '',
            `Your South West order ${orderNumber} has been handed over to the courier.`,
            '',
            `Courier: ${courierName}`,
            `Tracking number: ${trackingNumber}`,
            `Expected delivery: ${expectedDeliveryText}`,
            ...(trackingUrl ? ['', `Track Your Order: ${trackingUrl}`] : []),
            ...itemSummaryText,
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
    reason,
    orderDetails,
    trackingNumber,
    courierName,
    expectedDeliveryDate
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

    if (trackingNumber || courierName) {
        lines.push('', `Courier: ${courierName || 'Not available'}`);
        lines.push(`Tracking number: ${trackingNumber || 'Not available'}`);
        lines.push(`Expected delivery: ${expectedDeliveryDate ? formatDate(expectedDeliveryDate) : 'Not available'}`);
    }

    lines.push(
        '',
        'You can view your order in your South West customer account.',
        '',
        'Thank you for shopping with South West.'
    );

    if (orderDetails) {
        lines.push('', `Payment method: ${orderDetails.paymentMethod || 'Not provided'}`);
        lines.push(`Payment status: ${orderDetails.paymentStatus || 'Unpaid'}`);
        lines.push(`Order total: ${orderDetails.totalAmount || 'Not available'}`);
        for (const item of orderDetails.items || []) {
            lines.push(`- ${item.name}${item.variantName ? ` (${item.variantName})` : ''}, Qty ${item.quantity}, ${item.lineTotal}`);
        }
    }

    await sendEmail('orders', {
        to: email,
        subject: `Update on your South West order ${orderNumber}`,
        html: brandedEmail({
            heading: statusLabel,
            preheader: `Update on order ${orderNumber}`,
            body: `<p style="font-size:15px;line-height:1.6">Hi ${escapeHtml(customerName || 'Customer')}, ${escapeHtml(getStatusMessage(statusLabel))} Your South West order <strong>${escapeHtml(orderNumber)}</strong> has been updated.</p>${reason ? `<p style="background:#fff6e8;padding:12px;border-left:3px solid #bd7c21">${escapeHtml(reason)}</p>` : ''}${trackingNumber || courierName ? `<div style="background:#f1f5f2;padding:14px;line-height:1.8"><strong>Courier:</strong> ${escapeHtml(courierName || 'Not available')}<br><strong>Tracking:</strong> ${escapeHtml(trackingNumber || 'Not available')}<br><strong>Expected delivery:</strong> ${escapeHtml(expectedDeliveryDate ? formatDate(expectedDeliveryDate) : 'Not available')}</div>` : ''}${orderDetails ? `<div style="background:#f1f5f2;padding:14px;margin-top:16px;line-height:1.8"><strong>Payment method:</strong> ${escapeHtml(orderDetails.paymentMethod || 'Not provided')}<br><strong>Payment status:</strong> ${escapeHtml(orderDetails.paymentStatus || 'Unpaid')}<br><strong>Order total:</strong> ${escapeHtml(orderDetails.totalAmount || 'Not available')}</div>${(orderDetails.items || []).map(item => `<p style="margin:8px 0;font-size:14px">${escapeHtml(item.name)}${item.variantName ? ` - ${escapeHtml(item.variantName)}` : ''} × ${escapeHtml(item.quantity)} <span style="float:right">${escapeHtml(item.lineTotal)}</span></p>`).join('')}` : ''}<p style="font-size:14px;line-height:1.6">You can view your order in your South West customer account.</p>`
        }),
        attachments: orderDetails?.invoiceAttachment ? [orderDetails.invoiceAttachment] : undefined,
        text: lines.join('\n')
    });
}

function formatDate(value) {
    return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getStatusMessage(statusLabel) {
    const messages = {
        'Order Confirmed': 'We have confirmed your order.',
        'Order Ready to Deliver': 'Your order is being prepared for delivery.',
        'Order Handed Over to Courier': 'Your order has been handed to the courier.',
        'Order Completed': 'Your order has been completed and delivered.',
        'Order Returned': 'Your order has been marked as returned.',
        'Order Cancelled': 'Your order has been cancelled.'
    };
    return messages[statusLabel] || 'There is an update to your order.';
}

module.exports = {
    sendVerificationCode,
    sendCustomerPasswordSetupInvitation,
    sendCustomerPasswordReset,
    sendDeliveryTrackingEmail,
    sendOrderStatusEmail,
    sendOrderConfirmationEmail,
    sendAdminNewOrderEmail
};
