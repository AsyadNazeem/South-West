
const express = require('express');

const router = express.Router();

const customerAuthController = require('../controllers/customerAuthController');
const customerAuthMiddleware = require('../middleware/customerAuthMiddleware');

// Public authentication endpoints
router.post('/register', customerAuthController.register);
router.post('/verify-email', customerAuthController.verifyEmail);
router.post('/activate', customerAuthController.activate);
router.post('/login', customerAuthController.login);

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
