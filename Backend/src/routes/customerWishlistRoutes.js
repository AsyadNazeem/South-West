
'use strict';

const express = require('express');
const router = express.Router();

const customerAuth = require('../middleware/customerAuthMiddleware');

const {
    getMyWishlist,
    addMyWishlistItem,
    removeMyWishlistItem
} = require('../controllers/customerWishlistController');

router.use(customerAuth);

router.get('/', getMyWishlist);
router.post('/items', addMyWishlistItem);
router.delete('/items/:itemId', removeMyWishlistItem);

module.exports = router;
