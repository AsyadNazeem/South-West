const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const db = require('../models');
const {
    Customer,
    CustomerSession,
    CustomerEmailVerification,
    CustomerPasswordResetToken,
} = db;

const { Op } = require('sequelize');
const { sendVerificationCode, sendCustomerPasswordReset } = require('../services/emailService');
const { recordAuditLog } = require('../services/auditLogService');

const CODE_EXPIRY_MINUTES = 10;
const MAX_CODE_ATTEMPTS = 5;
const BCRYPT_ROUNDS = 12;
const PASSWORD_RESET_EXPIRY_MINUTES = 20;
const PASSWORD_RESET_COOLDOWN_MS = 60 * 1000;
const REGISTRATION_CODE_COOLDOWN_MS = 60 * 1000;

// ============================================================
// HELPERS
// ============================================================

function normalizeEmail(email) {
    return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function normalizePhone(phone) {
    return typeof phone === 'string' ? phone.trim() : '';
}

function hashSessionToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

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

function hashPasswordResetToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function generateVerificationCode() {
    return crypto.randomInt(100000, 1000000).toString();
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

function publicCustomer(customer) {
    const data = customer.toJSON();
    delete data.password_hash;
    return data;
}

function createCustomerToken(customer, sessionId) {
    const secret = process.env.CUSTOMER_JWT_SECRET;

    if (!secret) {
        throw new Error('Customer JWT secret is not configured');
    }

    return jwt.sign(
        {
            customerId: customer.id,
            sessionId,
            type: 'customer',
        },
        secret,
        {
            expiresIn: process.env.CUSTOMER_JWT_EXPIRES_IN || '1d',
            issuer: 'south-west-api',
            audience: 'south-west-customers',
        }
    );
}

/**
 * Safely records a customer authentication event.
 *
 * Never pass passwords, verification codes, JWTs, or raw
 * authorization headers to this function.
 *
 * userId remains null because audit_logs.user_id references
 * staff users, not customer accounts.
 */
async function auditCustomerAuthSafely({
                                           action,
                                           req,
                                           customerId = null,
                                           description,
                                       }) {
    try {
        await recordAuditLog({
            userId: null,
            action,
            module: 'CUSTOMER_AUTH',
            entityType: 'Customer',
            entityId: customerId,
            description,
            newValues: {
                customer_id: customerId,
                event: action,
            },
            ipAddress: req.ip || null,
            userAgent: req.get('user-agent') || null,
            requestId: req.id || null,
        });
    } catch (error) {
        // Do not expose audit persistence errors to customers.
        console.error('Customer auth audit failed:', error.message);
    }
}

async function createVerificationCode(customer, purpose, transaction) {
    const email = normalizeEmail(customer.email);

    if (!email) {
        const error = new Error('A valid email address is required');
        error.status = 400;
        throw error;
    }

    const code = generateVerificationCode();
    const codeHash = hashVerificationCode(code);
    const now = new Date();

    const expiresAt = new Date(
        now.getTime() + CODE_EXPIRY_MINUTES * 60 * 1000
    );

    // Invalidate earlier unused codes for this customer and purpose.
    const options = {
        where: {
            customer_id: customer.id,
            purpose,
            consumed_at: null,
        },
        ...(transaction ? { transaction } : {}),
    };
    await CustomerEmailVerification.update(
        { consumed_at: now },
        options
    );

    const verification = await CustomerEmailVerification.create({
        customer_id: customer.id,
        email,
        code_hash: codeHash,
        purpose,
        expires_at: expiresAt,
        attempts: 0,
        consumed_at: null,
    }, transaction ? { transaction } : undefined);

    return { verification, email, code };
}

async function deliverVerificationCode({ verification, email, code }, purpose) {
    // Never log or return the verification code.
    try {
        await sendVerificationCode(email, code, purpose);
    } catch (emailError) {
        // An undelivered verification code must never remain usable.
        await verification.update({ consumed_at: new Date() });
        throw emailError;
    }
}

async function issueVerificationCode(customer, purpose) {
    const prepared = await createVerificationCode(customer, purpose);
    await deliverVerificationCode(prepared, purpose);
}

async function resendRegistrationCode(customer) {
    let transaction;
    let prepared;
    try {
        transaction = await db.sequelize.transaction();
        const lockedCustomer = await Customer.findByPk(customer.id, {
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
        if (!lockedCustomer || !lockedCustomer.is_active || lockedCustomer.email_verified_at) {
            await transaction.rollback();
            return false;
        }

        const latestRegistrationCode = await CustomerEmailVerification.findOne({
            where: {
                customer_id: lockedCustomer.id,
                purpose: 'registration',
            },
            order: [['created_at', 'DESC']],
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        const latestCreatedAt = latestRegistrationCode
            ? new Date(latestRegistrationCode.created_at).getTime()
            : NaN;
        if (Number.isFinite(latestCreatedAt) && Date.now() - latestCreatedAt < REGISTRATION_CODE_COOLDOWN_MS) {
            await transaction.commit();
            return false;
        }

        prepared = await createVerificationCode(lockedCustomer, 'registration', transaction);
        await transaction.commit();
        transaction = null;
    } catch (error) {
        if (transaction) await transaction.rollback().catch(() => {});
        throw error;
    }

    await deliverVerificationCode(prepared, 'registration');
    return true;
}

// ============================================================
// REGISTER
// ============================================================

exports.register = async (req, res) => {
    let customer = null;

    try {
        const firstName =
            typeof req.body.first_name === 'string'
                ? req.body.first_name.trim()
                : '';

        const lastName =
            typeof req.body.last_name === 'string'
                ? req.body.last_name.trim()
                : '';

        const email = normalizeEmail(req.body.email);
        const phone = normalizePhone(req.body.phone);
        const password = req.body.password;

        if (!firstName || !lastName || !email || !phone) {
            await auditCustomerAuthSafely({
                action: 'CUSTOMER_REGISTER_FAILED',
                req,
                description: 'Customer registration rejected: required fields missing.',
            });

            return res.status(400).json({
                message: 'First name, last name, email and phone are required.',
            });
        }

        if (firstName.length > 100 || lastName.length > 100) {
            await auditCustomerAuthSafely({
                action: 'CUSTOMER_REGISTER_FAILED',
                req,
                description: 'Customer registration rejected: name length invalid.',
            });

            return res.status(400).json({
                message: 'Names must not exceed 100 characters.',
            });
        }

        if (email.length > 255 || phone.length > 30) {
            await auditCustomerAuthSafely({
                action: 'CUSTOMER_REGISTER_FAILED',
                req,
                description: 'Customer registration rejected: contact field too long.',
            });

            return res.status(400).json({
                message: 'Email or phone number is too long.',
            });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            await auditCustomerAuthSafely({
                action: 'CUSTOMER_REGISTER_FAILED',
                req,
                description: 'Customer registration rejected: invalid email format.',
            });

            return res.status(400).json({
                message: 'Enter a valid email address.',
            });
        }

        if (!validatePassword(password)) {
            await auditCustomerAuthSafely({
                action: 'CUSTOMER_REGISTER_FAILED',
                req,
                description: 'Customer registration rejected: password policy not met.',
            });

            return res.status(400).json({
                message:
                    'Password must be at least 8 characters and no more than 72 UTF-8 bytes.',
            });
        }

        const existingEmail = await Customer.findAll({
            where: { email },
            limit: 2,
        });

        if (existingEmail.length > 0) {
            const pending = existingEmail.length === 1 &&
                existingEmail[0].is_active &&
                !existingEmail[0].email_verified_at &&
                existingEmail[0].password_hash;

            if (pending) {
                try {
                    await resendRegistrationCode(existingEmail[0]);
                } catch (emailError) {
                    console.error('Customer registration recovery email failed:', emailError.message);
                    return res.status(503).json({
                        message: 'Registration is pending verification, but we could not send a code. Please try again shortly.',
                        verification_required: true,
                        customer: { email },
                    });
                }

                return res.status(200).json({
                    message: 'Registration is already pending verification. Check your email for a verification code.',
                    verification_required: true,
                    customer: { email },
                });
            }

            await auditCustomerAuthSafely({
                action: 'CUSTOMER_REGISTER_FAILED',
                req,
                description: 'Customer registration rejected: email already registered.',
            });

            return res.status(409).json({
                message:
                    'An account with these details may already exist. Try account activation or login.',
            });
        }

        const existingPhone = await Customer.findOne({
            where: { phone },
            attributes: ['id'],
        });

        if (existingPhone) {
            await auditCustomerAuthSafely({
                action: 'CUSTOMER_REGISTER_FAILED',
                req,
                description: 'Customer registration rejected: phone already registered.',
            });

            return res.status(409).json({
                message: 'This phone number is already associated with an account.',
            });
        }

        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const temporaryCode = `TMP-${crypto.randomBytes(16).toString('hex')}`;

        // Create the customer and final customer code atomically.
        await db.sequelize.transaction(async (transaction) => {
            customer = await Customer.create(
                {
                    customer_code: temporaryCode,
                    first_name: firstName,
                    last_name: lastName,
                    email,
                    phone,
                    password_hash: passwordHash,
                    email_verified_at: null,
                    phone_verified_at: null,
                    is_active: true,
                },
                { transaction }
            );

            const generatedCode =
                `WEB-${String(customer.id).padStart(6, '0')}`;

            const codeAlreadyExists = await Customer.findOne({
                where: { customer_code: generatedCode },
                transaction,
                attributes: ['id'],
            });

            if (codeAlreadyExists) {
                throw new Error(
                    'Generated customer code conflicts with an existing record'
                );
            }

            await customer.update(
                { customer_code: generatedCode },
                { transaction }
            );
        });

        try {
            await issueVerificationCode(customer, 'registration');
        } catch (emailError) {
            console.error(
                'Customer registration email delivery failed:',
                emailError.message
            );

            await auditCustomerAuthSafely({
                action: 'CUSTOMER_REGISTER_EMAIL_FAILED',
                req,
                customerId: customer.id,
                description:
                    'Customer created, but registration verification email delivery failed.',
            });

            return res.status(503).json({
                message:
                    'Your account is pending email verification, but we could not send the code. Please contact support before retrying.',
            });
        }

        await auditCustomerAuthSafely({
            action: 'CUSTOMER_REGISTER_SUCCESS',
            req,
            customerId: customer.id,
            description: 'Customer registration initiated successfully.',
        });

        return res.status(201).json({
            message:
                'Registration started. Check your email for the verification code.',
            customer: {
                id: customer.id,
                customer_code: customer.customer_code,
                email: customer.email,
            },
        });
    } catch (error) {
        console.error('Customer registration error:', error.message);

        await auditCustomerAuthSafely({
            action: 'CUSTOMER_REGISTER_ERROR',
            req,
            customerId: customer ? customer.id : null,
            description: 'Unexpected error during customer registration.',
        });

        if (error.status) {
            return res.status(error.status).json({
                message: error.message,
            });
        }

        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                message: 'These account details may already be registered.',
            });
        }

        return res.status(500).json({
            message: 'Unable to register customer.',
        });
    }
};

// ============================================================
// REGISTRATION OTP RECOVERY
// ============================================================

exports.resendRegistrationCode = async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const genericMessage = 'If registration is pending for this email, a verification code has been sent.';

    if (email && email.length <= 255) {
        try {
            const matches = await Customer.findAll({ where: { email }, limit: 2 });
            if (matches.length === 1) {
                const customer = matches[0];
                if (customer.is_active && customer.password_hash && !customer.email_verified_at) {
                    await resendRegistrationCode(customer);
                }
            }
        } catch (error) {
            // Keep the public response identical for unknown, verified and failed requests.
            console.error('Customer registration recovery error:', error.message);
        }
    }

    return res.status(200).json({ message: genericMessage, verification_required: true, email });
};

// ============================================================
// PASSWORD RESET
// ============================================================

exports.forgotPassword = async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const genericMessage = 'If an account exists with this email address, you will receive instructions to reset your password.';

    if (!email || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: 'Enter a valid email address.' });
    }

    let transaction;
    let resetRecord;
    let rawToken;
    let recipient;

    try {
        transaction = await db.sequelize.transaction();
        const customer = await Customer.findOne({
            where: { email },
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (customer && customer.is_active && customer.email_verified_at) {
            const cooldownSince = new Date(Date.now() - PASSWORD_RESET_COOLDOWN_MS);
            const recentRequest = await CustomerPasswordResetToken.findOne({
                where: { customer_id: customer.id, created_at: { [Op.gt]: cooldownSince } },
                transaction,
                lock: transaction.LOCK.UPDATE,
            });

            if (!recentRequest) {
                const now = new Date();
                rawToken = crypto.randomBytes(32).toString('base64url');
                const tokenHash = hashPasswordResetToken(rawToken);
                await CustomerPasswordResetToken.update(
                    { used_at: now },
                    { where: { customer_id: customer.id, used_at: null }, transaction }
                );
                resetRecord = await CustomerPasswordResetToken.create({
                    customer_id: customer.id,
                    token_hash: tokenHash,
                    expires_at: new Date(now.getTime() + PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000),
                    used_at: null,
                }, { transaction });
                recipient = email;
            }
        }

        await transaction.commit();
        transaction = null;

        if (resetRecord) {
            // Do not make the public response wait on SMTP; that would create
            // an account-existence timing signal. Delivery failures consume
            // the token so an undelivered link cannot be used.
            void sendCustomerPasswordReset(recipient, rawToken).catch(async () => {
                try {
                    await resetRecord.update({ used_at: new Date() });
                } catch {
                    // Keep the response generic and avoid logging token data.
                }
                console.error('Customer password reset email delivery failed.');
            });
        }

        return res.status(200).json({ message: genericMessage });
    } catch (error) {
        if (transaction) await transaction.rollback().catch(() => {});
        console.error('Customer forgot-password request failed.');
        return res.status(200).json({ message: genericMessage });
    }
};

exports.resetPassword = async (req, res) => {
    const token = typeof req.body.token === 'string' ? req.body.token.trim() : '';
    const newPassword = req.body.newPassword;

    if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) {
        return res.status(400).json({ message: 'This password reset link is invalid or expired.' });
    }
    if (!validatePassword(newPassword)) {
        return res.status(400).json({ message: 'Password must be at least 8 characters and no more than 72 UTF-8 bytes.' });
    }

    let transaction;
    try {
        const tokenHash = hashPasswordResetToken(token);
        const tokenCandidate = await CustomerPasswordResetToken.findOne({
            where: {
                token_hash: tokenHash,
                used_at: null,
                expires_at: { [Op.gt]: new Date() },
            },
        });
        if (!tokenCandidate) {
            return res.status(400).json({ message: 'This password reset link is invalid or expired.' });
        }

        transaction = await db.sequelize.transaction();
        const customer = await Customer.findByPk(tokenCandidate.customer_id, {
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
        if (!customer || !customer.is_active || !customer.email_verified_at) {
            await transaction.rollback();
            transaction = null;
            return res.status(400).json({ message: 'This password reset link is invalid or expired.' });
        }

        const now = new Date();
        const resetRecord = await CustomerPasswordResetToken.findOne({
            where: {
                token_hash: tokenHash,
                customer_id: customer.id,
                used_at: null,
                expires_at: { [Op.gt]: now },
            },
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (!resetRecord) {
            await transaction.rollback();
            transaction = null;
            return res.status(400).json({ message: 'This password reset link is invalid or expired.' });
        }

        const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
        await customer.update({ password_hash: passwordHash }, { transaction });
        await resetRecord.update({ used_at: now }, { transaction });
        await CustomerPasswordResetToken.update(
            { used_at: now },
            { where: { customer_id: customer.id, used_at: null }, transaction }
        );
        await CustomerSession.update(
            { revoked_at: now },
            { where: { customer_id: customer.id, revoked_at: null }, transaction }
        );

        await transaction.commit();
        transaction = null;
        return res.status(200).json({ message: 'Your password has been reset. You can now sign in.' });
    } catch (error) {
        if (transaction) await transaction.rollback().catch(() => {});
        console.error('Customer password reset failed.');
        return res.status(500).json({ message: 'Unable to reset your password. Please try again.' });
    }
};

// ============================================================
// ACCOUNT ACTIVATION REQUEST
// ============================================================

exports.activate = async (req, res) => {
    try {
        const customerCode =
            typeof req.body.customer_code === 'string'
                ? req.body.customer_code.trim()
                : '';

        const email = normalizeEmail(req.body.email);

        if (!customerCode || !email) {
            await auditCustomerAuthSafely({
                action: 'CUSTOMER_ACTIVATION_FAILED',
                req,
                description: 'Customer activation request rejected: required fields missing.',
            });

            return res.status(400).json({
                message: 'Customer code and registered email are required.',
            });
        }

        const matches = await Customer.findAll({
            where: {
                customer_code: customerCode,
                email,
                is_active: true,
            },
            limit: 2,
        });

        if (
            matches.length !== 1 ||
            matches[0].password_hash ||
            matches[0].email_verified_at
        ) {
            await auditCustomerAuthSafely({
                action: 'CUSTOMER_ACTIVATION_FAILED',
                req,
                description: 'Customer activation request rejected.',
            });

            return res.status(200).json({
                message:
                    'If the account is eligible, a verification code has been sent to its registered email.',
            });
        }

        const customer = matches[0];

        await issueVerificationCode(customer, 'activation');

        await auditCustomerAuthSafely({
            action: 'CUSTOMER_ACTIVATION_REQUESTED',
            req,
            customerId: customer.id,
            description: 'Customer account activation verification requested.',
        });

        return res.status(200).json({
            message:
                'If the account is eligible, a verification code has been sent to its registered email.',
        });
    } catch (error) {
        console.error('Customer activation error:', error.message);

        await auditCustomerAuthSafely({
            action: 'CUSTOMER_ACTIVATION_ERROR',
            req,
            description: 'Unexpected error during customer activation request.',
        });

        return res.status(200).json({
            message:
                'If the account is eligible, a verification code has been sent to its registered email.',
        });
    }
};

// ============================================================
// EMAIL VERIFICATION / ACCOUNT ACTIVATION
// ============================================================

exports.verifyEmail = async (req, res) => {
    let transaction = null;
    let customerId = null;

    try {
        const email = normalizeEmail(req.body.email);
        const code =
            typeof req.body.code === 'string' ? req.body.code.trim() : '';
        const purpose = req.body.purpose;
        const password = req.body.password;

        if (
            !email ||
            !/^\d{6}$/.test(code) ||
            !['registration', 'activation'].includes(purpose)
        ) {
            await auditCustomerAuthSafely({
                action: 'CUSTOMER_EMAIL_VERIFICATION_FAILED',
                req,
                description: 'Customer email verification rejected: invalid request.',
            });

            return res.status(400).json({
                message:
                    'A valid email, six-digit code and purpose are required.',
            });
        }

        if (purpose === 'activation' && !validatePassword(password)) {
            await auditCustomerAuthSafely({
                action: 'CUSTOMER_EMAIL_VERIFICATION_FAILED',
                req,
                description: 'Account activation rejected: password policy not met.',
            });

            return res.status(400).json({
                message:
                    'For activation, provide a password of at least 8 characters and no more than 72 UTF-8 bytes.',
            });
        }

        const codeHash = hashVerificationCode(code);
        const now = new Date();

        transaction = await db.sequelize.transaction();

        const verification = await CustomerEmailVerification.findOne({
            where: {
                email,
                purpose,
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

            await auditCustomerAuthSafely({
                action: 'CUSTOMER_EMAIL_VERIFICATION_FAILED',
                req,
                description:
                    'Customer email verification rejected: code invalid or expired.',
            });

            return res.status(400).json({
                message: 'The verification code is invalid or expired.',
            });
        }

        customerId = verification.customer_id;

        if (verification.attempts >= MAX_CODE_ATTEMPTS) {
            await verification.update(
                { consumed_at: now },
                { transaction }
            );

            await transaction.commit();
            transaction = null;

            await auditCustomerAuthSafely({
                action: 'CUSTOMER_EMAIL_VERIFICATION_LOCKED',
                req,
                customerId,
                description:
                    'Customer email verification locked after too many attempts.',
            });

            return res.status(429).json({
                message: 'Too many verification attempts. Request a new code.',
            });
        }

        if (!safeCompareHex(verification.code_hash, codeHash)) {
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

            await auditCustomerAuthSafely({
                action:
                    attempts >= MAX_CODE_ATTEMPTS
                        ? 'CUSTOMER_EMAIL_VERIFICATION_LOCKED'
                        : 'CUSTOMER_EMAIL_VERIFICATION_FAILED',
                req,
                customerId,
                description:
                    'Customer email verification rejected: code mismatch.',
            });

            return res.status(400).json({
                message:
                    attempts >= MAX_CODE_ATTEMPTS
                        ? 'Too many attempts. Request a new code.'
                        : 'The verification code is invalid or expired.',
            });
        }

        const customer = await Customer.findByPk(customerId, {
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (
            !customer ||
            normalizeEmail(customer.email) !== email ||
            !customer.is_active
        ) {
            await transaction.rollback();
            transaction = null;

            await auditCustomerAuthSafely({
                action: 'CUSTOMER_EMAIL_VERIFICATION_FAILED',
                req,
                customerId,
                description:
                    'Customer email verification rejected: account unavailable.',
            });

            return res.status(400).json({
                message: 'The account cannot be verified.',
            });
        }

        if (purpose === 'registration') {
            if (customer.email_verified_at) {
                await verification.update(
                    { consumed_at: now },
                    { transaction }
                );

                await transaction.commit();
                transaction = null;

                await auditCustomerAuthSafely({
                    action: 'CUSTOMER_EMAIL_ALREADY_VERIFIED',
                    req,
                    customerId: customer.id,
                    description: 'Customer email was already verified.',
                });

                return res.status(200).json({
                    message: 'Email is already verified. You can log in.',
                });
            }

            await customer.update(
                { email_verified_at: now },
                { transaction }
            );
        } else {
            if (customer.password_hash || customer.email_verified_at) {
                await transaction.rollback();
                transaction = null;

                await auditCustomerAuthSafely({
                    action: 'CUSTOMER_ACCOUNT_ACTIVATION_FAILED',
                    req,
                    customerId: customer.id,
                    description:
                        'Customer account activation rejected: account already activated.',
                });

                return res.status(400).json({
                    message: 'The account cannot be activated.',
                });
            }

            const passwordHash = await bcrypt.hash(
                password,
                BCRYPT_ROUNDS
            );

            await customer.update(
                {
                    password_hash: passwordHash,
                    email_verified_at: now,
                },
                { transaction }
            );
        }

        await verification.update(
            { consumed_at: now },
            { transaction }
        );

        await transaction.commit();
        transaction = null;

        await auditCustomerAuthSafely({
            action:
                purpose === 'registration'
                    ? 'CUSTOMER_EMAIL_VERIFIED'
                    : 'CUSTOMER_ACCOUNT_ACTIVATED',
            req,
            customerId: customer.id,
            description:
                purpose === 'registration'
                    ? 'Customer email verified successfully.'
                    : 'Customer account activated successfully.',
        });

        return res.status(200).json({
            message:
                purpose === 'registration'
                    ? 'Email verified. You can now log in.'
                    : 'Account activated successfully. You can now log in.',
        });
    } catch (error) {
        if (transaction) {
            await transaction.rollback().catch(() => {});
        }

        console.error('Customer email verification error:', error.message);

        await auditCustomerAuthSafely({
            action: 'CUSTOMER_EMAIL_VERIFICATION_ERROR',
            req,
            customerId,
            description:
                'Unexpected error during customer email verification.',
        });

        return res.status(500).json({
            message: 'Unable to verify email.',
        });
    }
};

// ============================================================
// LOGIN
// ============================================================

exports.login = async (req, res) => {
    try {
        const identifier =
            typeof req.body.identifier === 'string'
                ? req.body.identifier.trim()
                : '';

        const password = req.body.password;

        if (!identifier || typeof password !== 'string') {
            await auditCustomerAuthSafely({
                action: 'CUSTOMER_LOGIN_FAILED',
                req,
                description: 'Customer login rejected: required fields missing.',
            });

            return res.status(400).json({
                message: 'Email or phone number and password are required.',
            });
        }

        const isEmail = identifier.includes('@');

        const where = isEmail
            ? { email: normalizeEmail(identifier) }
            : { phone: normalizePhone(identifier) };

        const customers = await Customer.findAll({
            where,
            limit: 2,
        });

        if (customers.length !== 1 || !customers[0].password_hash) {
            await auditCustomerAuthSafely({
                action: 'CUSTOMER_LOGIN_FAILED',
                req,
                description:
                    'Customer login rejected: invalid credentials or account status.',
            });

            return res.status(401).json({
                message: 'Invalid credentials or account not activated.',
            });
        }

        const customer = customers[0];

        const passwordMatches = await bcrypt.compare(password, customer.password_hash);

        if (!customer.email_verified_at) {
            if (isEmail && passwordMatches && customer.is_active) {
                return res.status(403).json({
                    code: 'EMAIL_VERIFICATION_REQUIRED',
                    verification_required: true,
                    message: 'Verify your email before logging in.',
                    email: normalizeEmail(customer.email),
                });
            }
            return res.status(401).json({ message: 'Invalid credentials or account not activated.' });
        }

        if (!customer.is_active) {
            return res.status(401).json({ message: 'Invalid credentials or account not activated.' });
        }

        if (!isEmail && !customer.phone_verified_at) {
            await auditCustomerAuthSafely({
                action: 'CUSTOMER_LOGIN_FAILED',
                req,
                customerId: customer.id,
                description:
                    'Customer login rejected: phone verification required.',
            });

            return res.status(401).json({
                message: 'Verify your phone number before logging in with it.',
            });
        }

        if (!passwordMatches) {
            await auditCustomerAuthSafely({
                action: 'CUSTOMER_LOGIN_FAILED',
                req,
                customerId: customer.id,
                description: 'Customer login rejected: invalid credentials.',
            });

            return res.status(401).json({
                message: 'Invalid credentials or account not activated.',
            });
        }

        const sessionId = crypto.randomUUID();
        const token = createCustomerToken(customer, sessionId);
        const decoded = jwt.decode(token);

        if (!decoded || !decoded.exp) {
            throw new Error('Unable to determine customer token expiry');
        }

        const expiresAt = new Date(decoded.exp * 1000);

        await CustomerSession.create({
            session_uuid: sessionId,
            customer_id: customer.id,
            token_hash: hashSessionToken(token),
            expires_at: expiresAt,
            revoked_at: null,
            ip_address: req.ip || null,
            user_agent: req.get('user-agent') || null,
        });

        await auditCustomerAuthSafely({
            action: 'CUSTOMER_LOGIN_SUCCESS',
            req,
            customerId: customer.id,
            description: 'Customer logged in successfully.',
        });

        return res.status(200).json({
            message: 'Login successful.',
            token,
            expires_at: expiresAt.toISOString(),
            customer: publicCustomer(customer),
        });
    } catch (error) {
        console.error('Customer login error:', error.message);

        await auditCustomerAuthSafely({
            action: 'CUSTOMER_LOGIN_ERROR',
            req,
            description: 'Unexpected error during customer login.',
        });

        return res.status(500).json({
            message: 'Unable to log in.',
        });
    }
};

// ============================================================
// LOGOUT
// ============================================================

exports.logout = async (req, res) => {
    try {
        if (!req.customer || !req.customer.id) {
            await auditCustomerAuthSafely({
                action: 'CUSTOMER_LOGOUT_FAILED',
                req,
                description:
                    'Customer logout rejected because authentication context was missing.',
            });

            return res.status(401).json({
                message: 'Customer authentication is required.',
            });
        }

        const authorization = req.headers.authorization;

        if (
            !authorization ||
            !authorization.startsWith('Bearer ')
        ) {
            await auditCustomerAuthSafely({
                action: 'CUSTOMER_LOGOUT_FAILED',
                req,
                description:
                    'Customer logout rejected because authentication token was missing.',
            });

            return res.status(401).json({
                message: 'Authentication token is required.',
            });
        }

        const token = authorization.slice(7).trim();

        if (!token) {
            await auditCustomerAuthSafely({
                action: 'CUSTOMER_LOGOUT_FAILED',
                req,
                description:
                    'Customer logout rejected because authentication token was empty.',
            });

            return res.status(401).json({
                message: 'Authentication token is required.',
            });
        }

        const tokenHash = hashSessionToken(token);

        const session = await CustomerSession.findOne({
            where: {
                token_hash: tokenHash,
                customer_id: req.customer.id,
                revoked_at: null,
            },
            attributes: ['customer_id'],
        });

        await CustomerSession.update(
            { revoked_at: new Date() },
            {
                where: {
                    token_hash: tokenHash,
                    customer_id: req.customer.id,
                    revoked_at: null,
                },
            }
        );

        await auditCustomerAuthSafely({
            action: session
                ? 'CUSTOMER_LOGOUT_SUCCESS'
                : 'CUSTOMER_LOGOUT_FAILED',
            req,
            customerId: session ? session.customer_id : null,
            description: session
                ? 'Customer session revoked successfully.'
                : 'No active matching customer session was found during logout.',
        });

        // Preserve the existing generic logout response.
        return res.status(200).json({
            message: 'Logout successful.',
        });
    } catch (error) {
        console.error('Customer logout error:', error.message);

        await auditCustomerAuthSafely({
            action: 'CUSTOMER_LOGOUT_ERROR',
            req,
            description: 'Unexpected error during customer logout.',
        });

        return res.status(500).json({
            message: 'Unable to log out.',
        });
    }
};

// ============================================================
// CURRENT CUSTOMER PROFILE
// ============================================================

exports.me = async (req, res) => {
    try {
        if (!req.customer || !req.customer.id) {
            await auditCustomerAuthSafely({
                action: 'CUSTOMER_PROFILE_ACCESS_FAILED',
                req,
                description:
                    'Customer profile access rejected because authentication context was missing.',
            });

            return res.status(401).json({
                message: 'Customer authentication is required.',
            });
        }

        const customer = await Customer.findByPk(req.customer.id);

        if (!customer || !customer.is_active) {
            await auditCustomerAuthSafely({
                action: 'CUSTOMER_PROFILE_ACCESS_FAILED',
                req,
                customerId: req.customer.id,
                description:
                    'Customer profile access rejected because account was unavailable.',
            });

            return res.status(401).json({
                message: 'Customer account is unavailable.',
            });
        }

        await auditCustomerAuthSafely({
            action: 'CUSTOMER_PROFILE_ACCESS',
            req,
            customerId: customer.id,
            description: 'Customer accessed their profile.',
        });

        return res.status(200).json({
            customer: publicCustomer(customer),
        });
    } catch (error) {
        console.error('Customer profile error:', error.message);

        await auditCustomerAuthSafely({
            action: 'CUSTOMER_PROFILE_ACCESS_ERROR',
            req,
            customerId:
                req.customer && req.customer.id
                    ? req.customer.id
                    : null,
            description:
                'Unexpected error while retrieving customer profile.',
        });

        return res.status(500).json({
            message: 'Unable to retrieve customer profile.',
        });
    }
};
