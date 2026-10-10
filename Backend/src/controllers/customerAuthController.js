
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const db = require('../models');
const {
    Customer,
    CustomerSession,
    CustomerEmailVerification,
} = db;

const { Op } = require('sequelize');
const { sendVerificationCode } = require('../services/emailService');

const CODE_EXPIRY_MINUTES = 10;
const MAX_CODE_ATTEMPTS = 5;
const BCRYPT_ROUNDS = 12;

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

async function issueVerificationCode(customer, purpose) {
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

    // Invalidate earlier unused codes for the same customer and purpose.
    await CustomerEmailVerification.update(
        { consumed_at: now },
        {
            where: {
                customer_id: customer.id,
                purpose,
                consumed_at: null,
            },
        }
    );

    await CustomerEmailVerification.create({
        customer_id: customer.id,
        email,
        code_hash: codeHash,
        purpose,
        expires_at: expiresAt,
        attempts: 0,
        consumed_at: null,
    });

    // Only report success if the email provider accepts the message.
    await sendVerificationCode(email, code, purpose);
}

exports.register = async (req, res) => {
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
            return res.status(400).json({
                message: 'First name, last name, email and phone are required.',
            });
        }

        if (firstName.length > 100 || lastName.length > 100) {
            return res.status(400).json({
                message: 'Names must not exceed 100 characters.',
            });
        }

        if (email.length > 255 || phone.length > 30) {
            return res.status(400).json({
                message: 'Email or phone number is too long.',
            });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                message: 'Enter a valid email address.',
            });
        }

        if (!validatePassword(password)) {
            return res.status(400).json({
                message: 'Password must be at least 8 characters and no more than 72 UTF-8 bytes.',
            });
        }

        const existingEmail = await Customer.findAll({
            where: { email },
            attributes: ['id'],
            limit: 2,
        });

        if (existingEmail.length > 0) {
            return res.status(409).json({
                message: 'An account with these details may already exist. Try account activation or login.',
            });
        }

        const existingPhone = await Customer.findOne({
            where: { phone },
            attributes: ['id'],
        });

        if (existingPhone) {
            return res.status(409).json({
                message: 'This phone number is already associated with an account.',
            });
        }

        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const temporaryCode = `TMP-${crypto.randomBytes(16).toString('hex')}`;

        let customer;

        // Generate the final WEB customer code using the database ID.
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
            // Do not expose provider details or the verification code.
            console.error(
                'Customer registration email delivery failed:',
                emailError.message
            );

            return res.status(503).json({
                message: 'Your account is pending email verification, but we could not send the code. Please contact support before retrying.',
            });
        }

        return res.status(201).json({
            message: 'Registration started. Check your email for the verification code.',
            customer: {
                id: customer.id,
                customer_code: customer.customer_code,
                email: customer.email,
            },
        });
    } catch (error) {
        console.error('Customer registration error:', error.message);

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

exports.activate = async (req, res) => {
    try {
        const customerCode =
            typeof req.body.customer_code === 'string'
                ? req.body.customer_code.trim()
                : '';

        const email = normalizeEmail(req.body.email);

        if (!customerCode || !email) {
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

        // Fail closed if existing data makes the match ambiguous.
        if (
            matches.length !== 1 ||
            matches[0].password_hash ||
            matches[0].email_verified_at
        ) {
            return res.status(400).json({
                message: 'The account cannot be activated with these details.',
            });
        }

        await issueVerificationCode(matches[0], 'activation');

        return res.status(200).json({
            message: 'If the account is eligible, a verification code has been sent to its registered email.',
        });
    } catch (error) {
        console.error('Customer activation error:', error.message);

        return res.status(error.status || 503).json({
            message: error.status
                ? error.message
                : 'Unable to send the activation code.',
        });
    }
};

exports.verifyEmail = async (req, res) => {
    let transaction;

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
            return res.status(400).json({
                message: 'A valid email, six-digit code and purpose are required.',
            });
        }

        if (purpose === 'activation' && !validatePassword(password)) {
            return res.status(400).json({
                message: 'For activation, provide a password of at least 8 characters and no more than 72 UTF-8 bytes.',
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

            return res.status(400).json({
                message: 'The verification code is invalid or expired.',
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

            return res.status(400).json({
                message:
                    attempts >= MAX_CODE_ATTEMPTS
                        ? 'Too many attempts. Request a new code.'
                        : 'The verification code is invalid or expired.',
            });
        }

        const customer = await Customer.findByPk(
            verification.customer_id,
            {
                transaction,
                lock: transaction.LOCK.UPDATE,
            }
        );

        if (
            !customer ||
            normalizeEmail(customer.email) !== email ||
            !customer.is_active
        ) {
            await transaction.rollback();
            transaction = null;

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

        return res.status(500).json({
            message: 'Unable to verify email.',
        });
    }
};

exports.login = async (req, res) => {
    try {
        const identifier =
            typeof req.body.identifier === 'string'
                ? req.body.identifier.trim()
                : '';

        const password = req.body.password;

        if (!identifier || typeof password !== 'string') {
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

        if (
            customers.length !== 1 ||
            !customers[0].password_hash ||
            !customers[0].is_active ||
            !customers[0].email_verified_at
        ) {
            return res.status(401).json({
                message: 'Invalid credentials or account not activated.',
            });
        }

        const customer = customers[0];

        // Phone login is only allowed after phone verification.
        if (!isEmail && !customer.phone_verified_at) {
            return res.status(401).json({
                message: 'Verify your phone number before logging in with it.',
            });
        }

        const passwordMatches = await bcrypt.compare(
            password,
            customer.password_hash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                message: 'Invalid credentials or account not activated.',
            });
        }

        // Random JWT session token; store only its SHA-256 hash.
        const sessionId = crypto.randomUUID();

        const token = createCustomerToken(customer, sessionId);
        const decoded = jwt.decode(token);

        if (!decoded || !decoded.exp) {
            throw new Error('Unable to determine customer token expiry');
        }

        await CustomerSession.create({
            customer_id: customer.id,
            token_hash: hashSessionToken(token),
            expires_at: new Date(decoded.exp * 1000),
            revoked_at: null,
            ip_address: req.ip || null,
            user_agent: req.get('user-agent') || null,
        });

        return res.status(200).json({
            message: 'Login successful.',
            token,
            expires_at: new Date(decoded.exp * 1000).toISOString(),
            customer: publicCustomer(customer),
        });
    } catch (error) {
        console.error('Customer login error:', error.message);

        return res.status(500).json({
            message: 'Unable to log in.',
        });
    }
};

exports.logout = async (req, res) => {
    try {
        const authorization = req.headers.authorization;

        if (
            !authorization ||
            !authorization.startsWith('Bearer ')
        ) {
            return res.status(401).json({
                message: 'Authentication token is required.',
            });
        }

        const token = authorization.slice(7).trim();

        if (!token) {
            return res.status(401).json({
                message: 'Authentication token is required.',
            });
        }

        await CustomerSession.update(
            { revoked_at: new Date() },
            {
                where: {
                    token_hash: hashSessionToken(token),
                    revoked_at: null,
                },
            }
        );

        return res.status(200).json({
            message: 'Logout successful.',
        });
    } catch (error) {
        console.error('Customer logout error:', error.message);

        return res.status(500).json({
            message: 'Unable to log out.',
        });
    }
};

exports.me = async (req, res) => {
    try {
        // This must be set by customer-specific authentication middleware.
        if (!req.customer || !req.customer.id) {
            return res.status(401).json({
                message: 'Customer authentication is required.',
            });
        }

        const customer = await Customer.findByPk(req.customer.id);

        if (!customer || !customer.is_active) {
            return res.status(401).json({
                message: 'Customer account is unavailable.',
            });
        }

        return res.status(200).json({
            customer: publicCustomer(customer),
        });
    } catch (error) {
        console.error('Customer profile error:', error.message);

        return res.status(500).json({
            message: 'Unable to retrieve customer profile.',
        });
    }
};
