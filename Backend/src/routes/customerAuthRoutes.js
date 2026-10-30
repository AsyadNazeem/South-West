
const express = require('express');

const router = express.Router();

const customerAuthController = require('../controllers/customerAuthController');
const customerPasswordSetupController = require('../controllers/customerPasswordSetupController');
const customerAuthMiddleware = require('../middleware/customerAuthMiddleware');
const customerGoogleAuthController =
    require('../controllers/customerGoogleAuthController');


const customerPasswordChangeController =
    require('../controllers/customerPasswordChangeController');

    
const {
    customerLoginLimiter,
    customerRegistrationLimiter,
    customerVerificationLimiter,
    customerActivationLimiter,
    customerPasswordSetupValidationLimiter,
    customerPasswordSetupLimiter,
    customerPasswordChangeCodeLimiter,
    customerPasswordChangeLimiter,
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


router.post(
    '/password-change/request-code',
    customerAuthMiddleware,
    customerPasswordChangeCodeLimiter,
    customerPasswordChangeController.requestCode
);

router.post(
    '/password-change/confirm',
    customerAuthMiddleware,
    customerPasswordChangeLimiter,
    customerPasswordChangeController.changePassword
);


router.get('/google', customerGoogleAuthController.start);

router.get(
    '/google/callback',
    customerGoogleAuthController.callback
);

router.post(
    '/google/exchange',
    customerGoogleAuthController.exchange
);

module.exports = router;
