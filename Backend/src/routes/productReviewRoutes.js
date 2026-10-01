'use strict';

const express = require('express');
const router = express.Router();

const productReviewController = require('../controllers/productReviewController');

const authMiddleware = require('../middleware/authMiddleware');
const permissionMiddleware = require('../middleware/permissionMiddleware');

// Get all reviews
router.get(
    '/',
    authMiddleware,
    permissionMiddleware('product_reviews.view'),
    productReviewController.getAllProductReviews
);

// Get review by ID
router.get(
    '/:id',
    authMiddleware,
    permissionMiddleware('product_reviews.view'),
    productReviewController.getProductReviewById
);

// Create review
router.post(
    '/',
    authMiddleware,
    permissionMiddleware('product_reviews.create'),
    productReviewController.createProductReview
);

// Update review
router.put(
    '/:id',
    authMiddleware,
    permissionMiddleware('product_reviews.update'),
    productReviewController.updateProductReview
);

// Delete review
router.delete(
    '/:id',
    authMiddleware,
    permissionMiddleware('product_reviews.delete'),
    productReviewController.deleteProductReview
);

module.exports = router;
