
'use strict';

const express = require('express');
const router = express.Router();

const customerAuth = require('../middleware/customerAuthMiddleware');
const { checkout } = require('../controllers/customerCheckoutController');

router.use(customerAuth);

router.post('/', checkout);

module.exports = router;
