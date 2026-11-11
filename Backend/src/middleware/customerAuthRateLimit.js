const { rateLimit } = require('express-rate-limit');

const commonOptions = {
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many requests. Please try again later.',
    },
    handler: (req, res, next, options) => {
        res.set('Retry-After', String(Math.ceil(options.windowMs / 1000)));

        return res.status(options.statusCode).json(options.message);
    },
};

// Limits repeated attempts from a single client IP.
// Configure proxy trust correctly before deploying behind a reverse proxy.
const customerLoginLimiter = rateLimit({
    ...commonOptions,
    windowMs: 15 * 60 * 1000,
    limit: 10,
});

const customerRegistrationLimiter = rateLimit({
    ...commonOptions,
    windowMs: 60 * 60 * 1000,
    limit: 5,
});

const customerVerificationLimiter = rateLimit({
    ...commonOptions,
    windowMs: 15 * 60 * 1000,
    limit: 10,
});

const customerActivationLimiter = rateLimit({
    ...commonOptions,
    windowMs: 15 * 60 * 1000,
    limit: 5,
});

const customerRegistrationRecoveryLimiter = rateLimit({
    ...commonOptions,
    windowMs: 15 * 60 * 1000,
    limit: 3,
});

const customerForgotPasswordLimiter = rateLimit({
    ...commonOptions,
    windowMs: 15 * 60 * 1000,
    limit: 3,
});

const customerResetPasswordLimiter = rateLimit({
    ...commonOptions,
    windowMs: 15 * 60 * 1000,
    limit: 10,
});

const customerPasswordSetupValidationLimiter = rateLimit({
    ...commonOptions,
    windowMs: 15 * 60 * 1000,
    limit: 20,
});

const customerPasswordSetupLimiter = rateLimit({
    ...commonOptions,
    windowMs: 15 * 60 * 1000,
    limit: 5,
});


const customerPasswordChangeCodeLimiter = rateLimit({
    ...commonOptions,
    windowMs: 15 * 60 * 1000,
    limit: 3,
});

const customerPasswordChangeLimiter = rateLimit({
    ...commonOptions,
    windowMs: 15 * 60 * 1000,
    limit: 10,
});


module.exports = {
    customerLoginLimiter,
    customerRegistrationLimiter,
    customerVerificationLimiter,
    customerActivationLimiter,
    customerRegistrationRecoveryLimiter,
    customerForgotPasswordLimiter,
    customerResetPasswordLimiter,
    customerPasswordSetupValidationLimiter,
    customerPasswordSetupLimiter,
    customerPasswordChangeCodeLimiter,
    customerPasswordChangeLimiter,

};
