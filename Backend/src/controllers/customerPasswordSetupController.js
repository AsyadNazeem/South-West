
'use strict';

const bcrypt = require('bcryptjs');
const db = require('../models');
const { recordAuditLog } = require('../services/auditLogService');
const {
    hashToken,
    TOKEN_EXPIRY_MINUTES,
} = require('../services/customerPasswordSetupService');

const BCRYPT_ROUNDS = 12;

function validatePassword(password) {
    return (
        typeof password === 'string' &&
        password.length >= 8 &&
        Buffer.byteLength(password, 'utf8') <= 72
    );
}

async function validatePasswordSetup(req, res) {
    try {
        const { token } = req.body;

        if (typeof token !== 'string' || token.length !== 64) {
            return res.status(400).json({
                message: 'This password setup link is invalid or expired.',
            });
        }

        const setupToken = await db.CustomerPasswordSetupToken.findOne({
            where: {
                token_hash: hashToken(token),
                used_at: null,
            },

            include: [{
                model: db.Customer,
                as: 'customer',
                required: true,
            }],

        });

        if (
            !setupToken ||
            new Date(setupToken.expires_at) <= new Date() ||
            setupToken.customer?.password_hash
        ) {
            return res.status(400).json({
                message: 'This password setup link is invalid or expired.',
            });
        }

        return res.json({
            valid: true,
            customerCode: setupToken.customer.customer_code,
            expiresInMinutes: TOKEN_EXPIRY_MINUTES,
        });
    } catch (error) {
        console.error('Validate customer password setup error:', error);

        return res.status(500).json({
            message: 'Unable to validate the password setup link.',
        });
    }
}

async function setCustomerPassword(req, res) {
    const { token, password, confirmPassword } = req.body;

    if (typeof token !== 'string' || token.length !== 64) {
        return res.status(400).json({
            message: 'This password setup link is invalid or expired.',
        });
    }

    if (!validatePassword(password)) {
        return res.status(400).json({
            message: 'Password must be at least 8 characters and no more than 72 UTF-8 bytes.',
        });
    }

    if (password !== confirmPassword) {
        return res.status(400).json({
            message: 'Passwords do not match.',
        });
    }

    try {
        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

        const result = await db.sequelize.transaction(async (transaction) => {
            const setupToken = await db.CustomerPasswordSetupToken.findOne({
                where: {
                    token_hash: hashToken(token),
                    used_at: null,
                },
                transaction,
                lock: transaction.LOCK.UPDATE,
            });

            if (
                !setupToken ||
                new Date(setupToken.expires_at) <= new Date()
            ) {
                return { error: 'invalid' };
            }

            const customer = await db.Customer.findByPk(
                setupToken.customer_id,
                {
                    transaction,
                    lock: transaction.LOCK.UPDATE,
                }
            );

            if (!customer || customer.password_hash) {
                return { error: 'invalid' };
            }

            customer.password_hash = passwordHash;

            // Possession of the invitation verifies access to this email address.
            if (!customer.email_verified_at) {
                customer.email_verified_at = new Date();
            }

            await customer.save({ transaction });

            await recordAuditLog({
                userId: null,
                action: 'CUSTOMER_PASSWORD_SETUP_COMPLETED',
                module: 'customer_authentication',
                entityType: 'Customer',
                entityId: String(customer.id),
                description: 'Customer completed initial password setup',
                newValues: { customer_id: customer.id, email_verified: Boolean(customer.email_verified_at) },
                ipAddress: req.ip || null,
                userAgent: req.get('user-agent') || null,
                requestId: req.id || req.requestId || null,
                transaction
            });

            setupToken.used_at = new Date();
            await setupToken.save({ transaction });

            // Invalidate any other outstanding setup invitations.
            await db.CustomerPasswordSetupToken.update(
                { used_at: new Date() },
                {
                    where: {
                        customer_id: customer.id,
                        used_at: null,
                    },
                    transaction,
                }
            );

            return { success: true };
        });

        if (result.error) {
            return res.status(400).json({
                message: 'This password setup link is invalid or expired.',
            });
        }

        return res.json({
            message: 'Password created successfully. You can now log in.',
        });
    } catch (error) {
        console.error('Set customer password error:', error);

        return res.status(500).json({
            message: 'Unable to set your password. Please try again.',
        });
    }
}

module.exports = {
    validatePasswordSetup,
    setCustomerPassword,
};
