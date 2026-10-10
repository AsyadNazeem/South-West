'use strict';

const express = require('express');
const router = express.Router();

const productReviewController = require('../controllers/productReviewController');

const authMiddleware = require('../middleware/authMiddleware');
const {requirePermission} = require('../middleware/requirePermission');

// Get all reviews
router.get(
    '/',
    authMiddleware,
    requirePermission('product_reviews.view'),
    productReviewController.getAllProductReviews
);

// Get review by ID
router.get(
    '/:id',
    authMiddleware,
    requirePermission('product_reviews.view'),
    productReviewController.getProductReviewById
);

// Create review
router.post(
    '/',
    authMiddleware,
    requirePermission('product_reviews.create'),
    productReviewController.createProductReview
);

// Update review
router.put(
    '/:id',
    authMiddleware,
    requirePermission('product_reviews.update'),
    productReviewController.updateProductReview
);

// Delete review
router.delete(
    '/:id',
    authMiddleware,
    requirePermission('product_reviews.delete'),
    productReviewController.deleteProductReview
);

module.exports = router;
