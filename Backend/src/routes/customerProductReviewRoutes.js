
'use strict';

const express = require('express');
const router = express.Router();

const customerAuth = require('../middleware/customerAuthMiddleware');
const controller = require('../controllers/customerProductReviewController');

// Public product review list and rating summary.
router.get('/products/:itemId', controller.getProductReviews);

// Signed-in customer's own reviews.
router.get('/my', customerAuth, controller.getMyReviews);

// Submit a review.
router.post('/', customerAuth, controller.createCustomerReview);

module.exports = router;
