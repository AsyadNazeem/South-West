
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const db = require('../models');
const { Customer, CustomerSession } = db;
const { Op } = require('sequelize');

function hashSessionToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

async function customerAuthMiddleware(req, res, next) {
    try {
        const authorization = req.headers.authorization;

        if (
            !authorization ||
            !authorization.startsWith('Bearer ')
        ) {
            return res.status(401).json({
                message: 'Customer authentication required.',
            });
        }

        const token = authorization.slice(7).trim();

        if (!token) {
            return res.status(401).json({
                message: 'Customer authentication required.',
            });
        }

        const secret = process.env.CUSTOMER_JWT_SECRET;

        if (!secret) {
            console.error('CUSTOMER_JWT_SECRET is not configured');

            return res.status(500).json({
                message: 'Authentication service is not configured.',
            });
        }

        const decoded = jwt.verify(token, secret, {
            issuer: 'south-west-api',
            audience: 'south-west-customers',
            algorithms: ['HS256'],
        });

        // Reject staff tokens and tokens without a valid customer identity.
        if (
            decoded.type !== 'customer' ||
            !decoded.customerId ||
            !decoded.sessionId
        ) {
            return res.status(401).json({
                message: 'Invalid customer authentication token.',
            });
        }

        const session = await CustomerSession.findOne({
            where: {
                token_hash: hashSessionToken(token),
                revoked_at: null,
                expires_at: { [Op.gt]: new Date() },
            },
        });

        if (!session || String(session.customer_id) !== String(decoded.customerId)) {
            return res.status(401).json({
                message: 'Customer session is invalid or expired.',
            });
        }

        const customer = await Customer.findByPk(decoded.customerId);

        if (!customer || !customer.is_active) {
            return res.status(401).json({
                message: 'Customer account is unavailable.',
            });
        }

        req.customer = customer;
        req.customerSession = session;

        return next();
    } catch (error) {
        if (
            error.name === 'JsonWebTokenError' ||
            error.name === 'TokenExpiredError' ||
            error.name === 'NotBeforeError'
        ) {
            return res.status(401).json({
                message: 'Invalid or expired customer token.',
            });
        }

        console.error('Customer authentication error:', error.message);

        return res.status(500).json({
            message: 'Unable to authenticate customer.',
        });
    }
}

module.exports = customerAuthMiddleware;
