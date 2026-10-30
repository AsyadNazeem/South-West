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
const customerAuth = require('../middleware/customerAuthMiddleware');


/*
|--------------------------------------------------------------------------
| Wishlists
|--------------------------------------------------------------------------
*/


// Get all wishlist items for a customer
router.get(
    '/customers/:customerId/wishlist',
    customerAuth,
    getCustomerWishlist
);


// Get a specific wishlist item
router.get(
    '/wishlists/:id',
    customerAuth,
    getCustomerWishlist
);


// Add item to wishlist
router.post(
    '/customers/:customerId/wishlist',
    customerAuth,
    getCustomerWishlist
);


// Remove specific wishlist record
router.delete(
    '/wishlists/:id',
    customerAuth,
    getCustomerWishlist
);


// Remove specific item from customer's wishlist
router.delete(
    '/customers/:customerId/wishlist/items/:itemId',
    customerAuth,
    getCustomerWishlist
);


// Clear customer's entire wishlist
router.delete(
    '/customers/:customerId/wishlist',
    customerAuth,
    getCustomerWishlist
);


module.exports = router;
