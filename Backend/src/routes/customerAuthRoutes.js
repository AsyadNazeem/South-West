
const express = require('express');

const router = express.Router();

const customerAuthController = require('../controllers/customerAuthController');
const customerPasswordSetupController = require('../controllers/customerPasswordSetupController');
const customerAuthMiddleware = require('../middleware/customerAuthMiddleware');

const {
    customerLoginLimiter,
    customerRegistrationLimiter,
    customerVerificationLimiter,
    customerActivationLimiter,
    customerPasswordSetupValidationLimiter,
    customerPasswordSetupLimiter,
} = require('../middleware/customerAuthRateLimit');

// Public authentication endpoints
router.post(
    '/register',
    customerRegistrationLimiter,
    customerAuthController.register
);

router.post(
    '/verify-email',
    customerVerificationLimiter,
    customerAuthController.verifyEmail
);

router.post(
    '/activate',
    customerActivationLimiter,
    customerAuthController.activate
);

// Password setup for staff-created customers
router.post(
    '/validate-password-setup',
    customerPasswordSetupValidationLimiter,
    customerPasswordSetupController.validatePasswordSetup
);

router.post(
    '/set-password',
    customerPasswordSetupLimiter,
    customerPasswordSetupController.setCustomerPassword
);

router.post(
    '/login',
    customerLoginLimiter,
    customerAuthController.login
);

// Authenticated customer endpoints
router.post(
    '/logout',
    customerAuthMiddleware,
    customerAuthController.logout
);

router.get(
    '/me',
    customerAuthMiddleware,
    customerAuthController.me
);

module.exports = router;
