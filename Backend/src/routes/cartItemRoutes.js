'use strict';

const express = require('express');
const router = express.Router();

const {
    getCartItems,
    getCartItemById,
    createCartItem,
    updateCartItem,
    deleteCartItem
} = require('../controllers/cartItemController');

const authMiddleware = require('../middleware/authMiddleware');

router.get(
    '/',
    authMiddleware,
    getCartItems
);

router.get(
    '/:id',
    authMiddleware,
    getCartItemById
);

router.post(
    '/',
    authMiddleware,
    createCartItem
);

router.put(
    '/:id',
    authMiddleware,
    updateCartItem
);

router.delete(
    '/:id',
    authMiddleware,
    deleteCartItem
);

module.exports = router;
