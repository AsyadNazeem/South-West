
'use strict';

const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
    if (transporter) return transporter;

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

    const config = {
        host: SMTP_HOST,
        port: Number(SMTP_PORT || 587),
        secure: SMTP_SECURE === 'true',
    };

    // Add authentication only when credentials are configured.
    if (SMTP_USER && SMTP_PASS) {
        config.auth = {
            user: SMTP_USER,
            pass: SMTP_PASS,
        };
    }

    transporter = nodemailer.createTransport(config);

    return transporter;
}

async function sendVerificationCode(email, code, purpose) {
    const subject =
        purpose === 'activation'
            ? 'Activate your South West customer account'
            : 'Verify your South West email address';

    await getTransporter().sendMail({
        from:
            process.env.SMTP_FROM ||
            process.env.SMTP_USER ||
            'South West Dev <dev@southwest.local>',
        to: email,
        subject,
        text: [
            `Your South West verification code is: ${code}`,
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
        from:
            process.env.SMTP_FROM ||
            process.env.SMTP_USER ||
            'South West <noreply@southwest.local>',
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


module.exports = {
    sendVerificationCode,
    sendCustomerPasswordSetupInvitation,
};
