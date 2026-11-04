'use strict';

const { rateLimit } = require('express-rate-limit');

const commonOptions = {
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
        message: 'Too many checkout requests. Please try again later.'
    },
    handler: (req, res, next, options) => {
        res.set('Retry-After', String(Math.ceil(options.windowMs / 1000)));
        return res.status(options.statusCode).json(options.message);
    }
};

const createGuestCheckoutSessionLimiter = rateLimit({
    ...commonOptions,
    windowMs: 15 * 60 * 1000,
    limit: 10
});

const guestCheckoutQuoteLimiter = rateLimit({
    ...commonOptions,
    windowMs: 15 * 60 * 1000,
    limit: 30
});

const guestCheckoutCartLimiter = rateLimit({
    ...commonOptions,
    windowMs: 15 * 60 * 1000,
    limit: 60
});

const guestCheckoutSubmitLimiter = rateLimit({
    ...commonOptions,
    windowMs: 15 * 60 * 1000,
    limit: 5
});

module.exports = {
    createGuestCheckoutSessionLimiter,
    guestCheckoutQuoteLimiter,
    guestCheckoutCartLimiter,
    guestCheckoutSubmitLimiter
};
