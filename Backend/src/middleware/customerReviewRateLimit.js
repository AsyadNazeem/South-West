'use strict';

const { rateLimit } = require('express-rate-limit');

const customerReviewSubmitLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
        message: 'Too many review submissions. Please try again later.',
    },
    handler: (req, res, next, options) => {
        res.set('Retry-After', String(Math.ceil(options.windowMs / 1000)));
        return res.status(options.statusCode).json(options.message);
    },
});

module.exports = { customerReviewSubmitLimiter };
