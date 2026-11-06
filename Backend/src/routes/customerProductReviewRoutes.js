'use strict';

const express = require('express');
const router = express.Router();

const customerAuth = require('../middleware/customerAuthMiddleware');
const optionalCustomerAuth = require('../middleware/optionalCustomerAuthMiddleware');
const { customerReviewSubmitLimiter } = require('../middleware/customerReviewRateLimit');
const controller = require('../controllers/customerProductReviewController');

// Public product review list and rating summary.
router.get('/products/:itemId', controller.getProductReviews);

// Signed-in customer's own reviews.
router.get('/my', customerAuth, controller.getMyReviews);

// Guests and signed-in customers can submit reviews.
router.post('/', customerReviewSubmitLimiter, optionalCustomerAuth, controller.createCustomerReview);

module.exports = router;
