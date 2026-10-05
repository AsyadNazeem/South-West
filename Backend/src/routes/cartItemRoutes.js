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
const requirePermission = require('../middleware/permissionMiddleware');

router.get(
    '/',
    authMiddleware,
    requirePermission('orders.view'),
    getCartItems
);

router.get(
    '/:id',
    authMiddleware,
    requirePermission('orders.view'),
    getCartItemById
);

router.post(
    '/',
    authMiddleware,
    requirePermission('orders.create'),
    createCartItem
);

router.put(
    '/:id',
    authMiddleware,
    requirePermission('orders.update'),
    updateCartItem
);

router.delete(
    '/:id',
    authMiddleware,
    requirePermission('orders.delete'),
    deleteCartItem
);

module.exports = router;
