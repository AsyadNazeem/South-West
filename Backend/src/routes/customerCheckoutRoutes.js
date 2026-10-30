'use strict';

const express = require('express');
const router = express.Router();

const customerAuth = require('../middleware/customerAuthMiddleware');
const {
    checkout,
    quote,
    createCheckoutSession,
} = require('../controllers/customerCheckoutController');

router.use(customerAuth);
router.post('/session', createCheckoutSession);

router.post('/quote', quote);
router.post('/', checkout);

module.exports = router;