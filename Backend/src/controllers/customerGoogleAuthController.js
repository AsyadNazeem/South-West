
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { Op } = require('sequelize');

const db = require('../models');
const { Customer, CustomerSession, CustomerOAuthCode } = db;
const { recordAuditLog } = require('../services/auditLogService');

const STATE_COOKIE = 'sw_google_oauth_state';
const STATE_MAX_AGE_MS = 10 * 60 * 1000;
const HANDOFF_TTL_MS = 5 * 60 * 1000;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL;
const CUSTOMER_FRONTEND_URL = process.env.CUSTOMER_FRONTEND_URL;
const GOOGLE_OAUTH_STATE_SECRET = process.env.GOOGLE_OAUTH_STATE_SECRET;

const googleConfigured = Boolean(
    GOOGLE_CLIENT_ID &&
    GOOGLE_CLIENT_SECRET &&
    GOOGLE_CALLBACK_URL &&
    CUSTOMER_FRONTEND_URL &&
    GOOGLE_OAUTH_STATE_SECRET &&
    GOOGLE_OAUTH_STATE_SECRET.length >= 32
);

const oauthClient = googleConfigured
    ? new OAuth2Client(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_CALLBACK_URL
    )
    : null;

function normalizeEmail(email) {
    return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function hash(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

function safeEqual(first, second) {
    if (typeof first !== 'string' || typeof second !== 'string') {
        return false;
    }

    const a = Buffer.from(first);
    const b = Buffer.from(second);

    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function createStateSignature(state, issuedAt) {
    return crypto
        .createHmac('sha256', GOOGLE_OAUTH_STATE_SECRET)
        .update(`${state}.${issuedAt}`)
        .digest('hex');
}

function cookieOptions(maxAge) {
    const secure = process.env.NODE_ENV === 'production';

    return [
        `${STATE_COOKIE}=`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Max-Age=${Math.max(0, Math.floor(maxAge / 1000))}`,
        ...(secure ? ['Secure'] : []),
    ].join('; ');
}

function setStateCookie(res, value, maxAge) {
    const secure = process.env.NODE_ENV === 'production';

    res.setHeader('Set-Cookie', [
        `${STATE_COOKIE}=${value}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Max-Age=${Math.max(0, Math.floor(maxAge / 1000))}`,
        ...(secure ? ['Secure'] : []),
    ].join('; '));
}

function clearStateCookie(res) {
    res.setHeader('Set-Cookie', cookieOptions(0));
}

function readCookie(req, name) {
    const header = req.headers.cookie;

    if (typeof header !== 'string') return null;

    for (const part of header.split(';')) {
        const separator = part.indexOf('=');

        if (separator < 0) continue;

        const key = part.slice(0, separator).trim();
        const value = part.slice(separator + 1).trim();

        if (key === name) return value;
    }

    return null;
}

function verifyState(req, receivedState) {
    const value = readCookie(req, STATE_COOKIE);

    if (
        typeof value !== 'string' ||
        typeof receivedState !== 'string' ||
        value.length > 512
    ) {
        return false;
    }

    const parts = value.split('.');

    if (parts.length !== 3) return false;

    const [cookieState, issuedAtString, signature] = parts;
    const issuedAt = Number(issuedAtString);

    if (
        !cookieState ||
        !Number.isSafeInteger(issuedAt) ||
        !/^[a-f0-9]{64}$/i.test(signature)
    ) {
        return false;
    }

    const age = Date.now() - issuedAt;

    if (age < 0 || age > STATE_MAX_AGE_MS) return false;

    const expectedSignature = createStateSignature(
        cookieState,
        issuedAtString
    );

    return (
        safeEqual(cookieState, receivedState) &&
        safeEqual(signature, expectedSignature)
    );
}

function frontendUrl(path) {
    const base = new URL(CUSTOMER_FRONTEND_URL);

    // Never accept a redirect destination supplied by the request.
    base.pathname = path;
    base.search = '';
    base.hash = '';

    return base;
}

function redirectFailure(res, reason) {
    const target = frontendUrl('/login');
    target.searchParams.set('google_error', reason);

    return res.redirect(303, target.toString());
}

function createCustomerToken(customer, sessionId) {
    const secret = process.env.CUSTOMER_JWT_SECRET;

    if (!secret) {
        throw new Error('CUSTOMER_JWT_SECRET is not configured');
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
            algorithm: 'HS256',
        }
    );
}

function publicCustomer(customer) {
    const data = customer.toJSON();

    delete data.password_hash;
    delete data.google_id;

    return data;
}

async function auditSafely(req, action, customerId = null, description) {
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
        console.error('Google auth audit failed:', error.message);
    }
}

function requireGoogleConfig(res) {
    if (googleConfigured) return true;

    console.error('Google OAuth environment configuration is incomplete.');

    res.status(503).json({
        message: 'Google sign-in is not configured.',
    });

    return false;
}

// GET /customer-auth/google
exports.start = async (req, res) => {
    if (!requireGoogleConfig(res)) return;

    try {
        const state = crypto.randomBytes(32).toString('hex');
        const issuedAt = String(Date.now());
        const signature = createStateSignature(state, issuedAt);
        const stateCookie = `${state}.${issuedAt}.${signature}`;

        setStateCookie(res, stateCookie, STATE_MAX_AGE_MS);

        const authorizationUrl = oauthClient.generateAuthUrl({
            access_type: 'online',
            prompt: 'select_account',
            scope: ['openid', 'email', 'profile'],
            state,
        });

        return res.redirect(302, authorizationUrl);
    } catch (error) {
        console.error('Google OAuth start failed:', error.message);
        clearStateCookie(res);

        return res.status(500).json({
            message: 'Unable to start Google sign-in.',
        });
    }
};

// GET /customer-auth/google/callback
exports.callback = async (req, res) => {
    if (!googleConfigured) {
        return redirectFailure(res, 'not_configured');
    }

    clearStateCookie(res);

    try {
        if (req.query.error) {
            return redirectFailure(res, 'cancelled');
        }

        const authorizationCode = req.query.code;
        const receivedState = req.query.state;

        if (
            typeof authorizationCode !== 'string' ||
            authorizationCode.length > 4096 ||
            !verifyState(req, receivedState)
        ) {
            await auditSafely(
                req,
                'CUSTOMER_GOOGLE_LOGIN_FAILED',
                null,
                'Google callback rejected because authorization code or state was invalid.'
            );

            return redirectFailure(res, 'invalid_state');
        }

        const { tokens } = await oauthClient.getToken({
            code: authorizationCode,
            redirect_uri: GOOGLE_CALLBACK_URL,
        });

        if (!tokens.id_token) {
            return redirectFailure(res, 'google_verification_failed');
        }

        const ticket = await oauthClient.verifyIdToken({
            idToken: tokens.id_token,
            audience: GOOGLE_CLIENT_ID,
        });

        const profile = ticket.getPayload();

        if (
            !profile ||
            typeof profile.sub !== 'string' ||
            !profile.sub ||
            profile.email_verified !== true
        ) {
            return redirectFailure(res, 'unverified_email');
        }

        const email = normalizeEmail(profile.email);

        if (
            !email ||
            email.length > 255 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ) {
            return redirectFailure(res, 'invalid_google_profile');
        }

        let customer = await Customer.findOne({
            where: { google_id: profile.sub },
        });

        if (customer) {
            if (
                normalizeEmail(customer.email) !== email ||
                !customer.is_active
            ) {
                return redirectFailure(res, 'account_unavailable');
            }
        } else {
            const emailCustomer = await Customer.findOne({
                where: {
                    email: { [Op.eq]: email },
                },
            });

            if (emailCustomer) {
                await auditSafely(
                    req,
                    'CUSTOMER_GOOGLE_EXISTING_ACCOUNT',
                    emailCustomer.id,
                    'Google sign-in refused because this email already belongs to an account. Password login is required.'
                );

                return redirectFailure(res, 'existing_account');
            }

            const firstName =
                typeof profile.given_name === 'string'
                    ? profile.given_name.trim().slice(0, 100)
                    : '';

            const lastName =
                typeof profile.family_name === 'string'
                    ? profile.family_name.trim().slice(0, 100)
                    : '';

            if (!firstName || !lastName) {
                return redirectFailure(res, 'profile_incomplete');
            }

            // Use a transaction to create the customer and normal WEB code.
            customer = await db.sequelize.transaction(async (transaction) => {
                const temporaryCode =
                    `TMP-${crypto.randomBytes(16).toString('hex')}`;

                const created = await Customer.create(
                    {
                        customer_code: temporaryCode,
                        first_name: firstName,
                        last_name: lastName,
                        email,
                        phone: null,
                        password_hash: null,
                        google_id: profile.sub,
                        email_verified_at: new Date(),
                        is_active: true,
                    },
                    { transaction }
                );

                const customerCode =
                    `WEB-${String(created.id).padStart(6, '0')}`;

                const conflict = await Customer.findOne({
                    where: { customer_code: customerCode },
                    attributes: ['id'],
                    transaction,
                });

                if (conflict) {
                    throw new Error('Generated customer code conflict');
                }

                await created.update(
                    { customer_code: customerCode },
                    { transaction }
                );

                return created;
            });

            await auditSafely(
                req,
                'CUSTOMER_GOOGLE_REGISTER_SUCCESS',
                customer.id,
                'Customer account created using Google sign-in.'
            );
        }

        // Issue a random, short-lived, single-use handoff code.
        const rawCode = crypto.randomBytes(32).toString('base64url');
        const codeHash = hash(rawCode);
        const expiresAt = new Date(Date.now() + HANDOFF_TTL_MS);

        await CustomerOAuthCode.create({
            code_hash: codeHash,
            customer_id: customer.id,
            expires_at: expiresAt,
            consumed_at: null,
        });

        await auditSafely(
            req,
            'CUSTOMER_GOOGLE_LOGIN_SUCCESS',
            customer.id,
            'Google identity verified; one-time login handoff issued.'
        );

        const target = frontendUrl('/auth/google/callback');
        target.searchParams.set('code', rawCode);

        return res.redirect(303, target.toString());
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return redirectFailure(res, 'account_conflict');
        }

        console.error('Google OAuth callback failed:', error.message);

        await auditSafely(
            req,
            'CUSTOMER_GOOGLE_LOGIN_ERROR',
            null,
            'Unexpected error during Google OAuth callback.'
        );

        return redirectFailure(res, 'google_login_failed');
    }
};

// POST /customer-auth/google/exchange
// Body: { "code": "one-time-code-from-callback" }
exports.exchange = async (req, res) => {
    if (!googleConfigured) {
        return res.status(503).json({
            message: 'Google sign-in is not configured.',
        });
    }

    const rawCode =
        typeof req.body?.code === 'string' ? req.body.code : '';

    if (
        rawCode.length < 32 ||
        rawCode.length > 256 ||
        !/^[A-Za-z0-9_-]+$/.test(rawCode)
    ) {
        return res.status(400).json({
            message: 'Invalid or expired Google sign-in code.',
        });
    }

    const transaction = await db.sequelize.transaction();

    try {
        const now = new Date();

        const handoff = await CustomerOAuthCode.findOne({
            where: {
                code_hash: hash(rawCode),
                consumed_at: null,
                expires_at: { [Op.gt]: now },
            },
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (!handoff) {
            await transaction.rollback();

            return res.status(401).json({
                message: 'Google sign-in code is invalid or expired.',
            });
        }

        const customer = await Customer.findByPk(handoff.customer_id, {
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (
            !customer ||
            !customer.is_active ||
            !customer.google_id ||
            !customer.email_verified_at
        ) {
            await transaction.rollback();

            return res.status(401).json({
                message: 'Customer account is unavailable.',
            });
        }

        // Consume the code in the same transaction as session creation.
        await handoff.update(
            { consumed_at: now },
            { transaction }
        );

        const sessionId = crypto.randomUUID();
        const token = createCustomerToken(customer, sessionId);
        const decoded = jwt.decode(token);

        if (!decoded || !decoded.exp) {
            throw new Error('Unable to determine JWT expiry');
        }

        const expiresAt = new Date(decoded.exp * 1000);

        await CustomerSession.create(
            {
                session_uuid: sessionId,
                customer_id: customer.id,
                token_hash: hash(token),
                expires_at: expiresAt,
                revoked_at: null,
                ip_address: req.ip || null,
                user_agent: req.get('user-agent') || null,
            },
            { transaction }
        );

        await transaction.commit();

        await auditSafely(
            req,
            'CUSTOMER_GOOGLE_SESSION_CREATED',
            customer.id,
            'Google login handoff exchanged for a customer session.'
        );

        return res.status(200).json({
            message: 'Google sign-in successful.',
            token,
            expires_at: expiresAt.toISOString(),
            customer: publicCustomer(customer),
        });
    } catch (error) {
        await transaction.rollback().catch(() => {});

        console.error('Google OAuth exchange failed:', error.message);

        await auditSafely(
            req,
            'CUSTOMER_GOOGLE_EXCHANGE_ERROR',
            null,
            'Unexpected error during Google sign-in code exchange.'
        );

        return res.status(500).json({
            message: 'Unable to complete Google sign-in.',
        });
    }
};
