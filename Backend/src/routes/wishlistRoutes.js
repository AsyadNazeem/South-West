'use strict';

const express = require('express');

const router = express.Router();

const {
    getCustomerWishlist,
    getWishlistItem,
    removeFromWishlist,
    removeItemFromCustomerWishlist,
    clearCustomerWishlist,
    createWishlist
} = require('../controllers/wishlistController');

const authenticate = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');


/*
|--------------------------------------------------------------------------
| Wishlists
|--------------------------------------------------------------------------
*/


// Get all wishlist items for a customer
router.get(
    '/customers/:customerId/wishlist',
    authenticate,
    requirePermission('wishlists.view'),
    getCustomerWishlist
);


// Get a specific wishlist item
router.get(
    '/wishlists/:id',
    authenticate,
    requirePermission('wishlists.view'),
    getWishlistItem
);


// Add item to wishlist
router.post(
    '/customers/:customerId/wishlist',
    authenticate,
    requirePermission('wishlists.create'),
    createWishlist
);


// Remove specific wishlist record
router.delete(
    '/wishlists/:id',
    authenticate,
    requirePermission('wishlists.delete'),
    removeFromWishlist
);


// Remove specific item from customer's wishlist
router.delete(
    '/customers/:customerId/wishlist/items/:itemId',
    authenticate,
    requirePermission('wishlists.delete'),
    removeItemFromCustomerWishlist
);


// Clear customer's entire wishlist
router.delete(
    '/customers/:customerId/wishlist',
    authenticate,
    requirePermission('wishlists.delete'),
    clearCustomerWishlist
);


module.exports = router;
