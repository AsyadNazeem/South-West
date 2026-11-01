
'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');

const db = require('../models');
const {
    Customer,
    CustomerSession,
    CustomerEmailVerification,
} = db;

const { sendVerificationCode } = require('../services/emailService');

const CODE_EXPIRY_MINUTES = 10;
const MAX_CODE_ATTEMPTS = 5;
const BCRYPT_ROUNDS = 12;

function hashVerificationCode(code) {
    const secret = process.env.CUSTOMER_VERIFICATION_SECRET;

    if (!secret) {
        throw new Error('Customer verification secret is not configured');
    }

    return crypto
        .createHmac('sha256', secret)
        .update(code)
        .digest('hex');
}

function safeCompareHex(first, second) {
    if (
        typeof first !== 'string' ||
        typeof second !== 'string' ||
        !/^[a-f0-9]{64}$/i.test(first) ||
        !/^[a-f0-9]{64}$/i.test(second)
    ) {
        return false;
    }

    return crypto.timingSafeEqual(
        Buffer.from(first, 'hex'),
        Buffer.from(second, 'hex')
    );
}

function validatePassword(password) {
    return (
        typeof password === 'string' &&
        password.length >= 8 &&
        Buffer.byteLength(password, 'utf8') <= 72
    );
}

function audit(action, req, customerId) {
    // Do not log passwords, OTPs, or authentication tokens.
    console.info(JSON.stringify({
        event: action,
        customer_id: customerId,
        ip: req.ip || null,
        request_id: req.id || null,
        timestamp: new Date().toISOString(),
    }));
}

exports.requestCode = async (req, res) => {
    const customer = req.customer;
    let verification = null;
    let transaction = null;

    try {
        if (!customer || !customer.is_active || !customer.email) {
            return res.status(400).json({
                message: 'A valid customer email address is required.',
            });
        }

        transaction = await db.sequelize.transaction();

        // Serialise password-change code requests for this customer.
        const lockedCustomer = await Customer.findByPk(customer.id, {
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (
            !lockedCustomer ||
            !lockedCustomer.is_active ||
            !lockedCustomer.email
        ) {
            await transaction.rollback();
            transaction = null;

            return res.status(400).json({
                message: 'A valid customer email address is required.',
            });
        }

        const email = lockedCustomer.email.trim().toLowerCase();
        const now = new Date();

        const code = crypto.randomInt(100000, 1000000).toString();
        const codeHash = hashVerificationCode(code);
        const expiresAt = new Date(
            now.getTime() + CODE_EXPIRY_MINUTES * 60 * 1000
        );

        // Invalidate previous unused codes inside the same transaction.
        await CustomerEmailVerification.update(
            { consumed_at: now },
            {
                where: {
                    customer_id: lockedCustomer.id,
                    purpose: 'password_change',
                    consumed_at: null,
                },
                transaction,
            }
        );

        verification = await CustomerEmailVerification.create(
            {
                customer_id: lockedCustomer.id,
                email,
                code_hash: codeHash,
                purpose: 'password_change',
                expires_at: expiresAt,
                attempts: 0,
                consumed_at: null,
            },
            { transaction }
        );

        await transaction.commit();
        transaction = null;

        // Send only after the database transaction has committed.
        try {
            await sendVerificationCode(email, code, 'password_change');
        } catch (emailError) {
            // A code that could not be delivered must not remain usable.
            await verification.update({ consumed_at: new Date() });
            throw emailError;
        }

        audit('CUSTOMER_PASSWORD_CHANGE_CODE_SENT', req, lockedCustomer.id);

        return res.status(200).json({
            message: 'A password-change code has been sent to your registered email address.',
            expires_in_seconds: CODE_EXPIRY_MINUTES * 60,
        });
    } catch (error) {
        if (transaction) {
            await transaction.rollback().catch(() => {});
        }

        console.error('Password-change code request failed:', error.message);

        return res.status(500).json({
            message: 'Unable to send the password-change code. Please try again later.',
        });
    }
};

exports.changePassword = async (req, res) => {
    const customerId = req.customer?.id;

    const code =
        typeof req.body.code === 'string'
            ? req.body.code.trim()
            : '';

    const newPassword = req.body.newPassword;
    let transaction;

    if (!customerId) {
        return res.status(401).json({
            message: 'Customer authentication required.',
        });
    }

    if (!/^\d{6}$/.test(code)) {
        return res.status(400).json({
            message: 'Enter the six-digit code sent to your email.',
        });
    }

    if (!validatePassword(newPassword)) {
        return res.status(400).json({
            message: 'Your new password must be at least 8 characters and no more than 72 UTF-8 bytes.',
        });
    }

    try {
        transaction = await db.sequelize.transaction();

        const now = new Date();

        const verification = await CustomerEmailVerification.findOne({
            where: {
                customer_id: customerId,
                purpose: 'password_change',
                consumed_at: null,
                expires_at: { [Op.gt]: now },
            },
            order: [['created_at', 'DESC']],
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (!verification) {
            await transaction.rollback();
            transaction = null;

            return res.status(400).json({
                message: 'The code is invalid or expired. Request a new code.',
            });
        }

        if (verification.attempts >= MAX_CODE_ATTEMPTS) {
            await verification.update(
                { consumed_at: now },
                { transaction }
            );

            await transaction.commit();
            transaction = null;

            return res.status(429).json({
                message: 'Too many attempts. Request a new code.',
            });
        }

        const submittedHash = hashVerificationCode(code);

        if (!safeCompareHex(verification.code_hash, submittedHash)) {
            const attempts = verification.attempts + 1;

            await verification.update(
                {
                    attempts,
                    ...(attempts >= MAX_CODE_ATTEMPTS
                        ? { consumed_at: now }
                        : {}),
                },
                { transaction }
            );

            await transaction.commit();
            transaction = null;

            return res.status(
                attempts >= MAX_CODE_ATTEMPTS ? 429 : 400
            ).json({
                message: attempts >= MAX_CODE_ATTEMPTS
                    ? 'Too many attempts. Request a new code.'
                    : 'The code is invalid or expired.',
            });
        }

        const customer = await Customer.findByPk(customerId, {
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (
            !customer ||
            !customer.is_active ||
            customer.email.trim().toLowerCase() !==
                verification.email.trim().toLowerCase()
        ) {
            await transaction.rollback();
            transaction = null;

            return res.status(400).json({
                message: 'The customer account is unavailable or the email has changed.',
            });
        }

        const passwordHash = await bcrypt.hash(
            newPassword,
            BCRYPT_ROUNDS
        );

        await customer.update(
            { password_hash: passwordHash },
            { transaction }
        );

        await verification.update(
            { consumed_at: now },
            { transaction }
        );

        // Revoke every active session, including the current session.
        await CustomerSession.update(
            { revoked_at: now },
            {
                where: {
                    customer_id: customerId,
                    revoked_at: null,
                },
                transaction,
            }
        );

        await transaction.commit();
        transaction = null;

        audit('CUSTOMER_PASSWORD_CHANGED', req, customerId);

        return res.status(200).json({
            message: 'Password changed successfully. Please log in again.',
            requiresLogin: true,
        });
    } catch (error) {
        if (transaction) {
            await transaction.rollback().catch(() => {});
        }

        console.error('Customer password change failed:', error.message);

        return res.status(500).json({
            message: 'Unable to change your password. Please try again.',
        });
    }
};
