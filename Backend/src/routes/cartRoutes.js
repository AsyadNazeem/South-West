'use strict';

const express = require('express');

const router = express.Router();

const authenticate = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/permissionMiddleware');

const {
    getCarts,
    getCartById,
    createCart,
    updateCart,
    deleteCart
} = require('../controllers/cartController');

// GET ALL CARTS
router.get(
    '/',
    authenticate,
    requirePermission('orders.view'),
    getCarts
);

// GET CART BY ID
router.get(
    '/:id',
    authenticate,
    requirePermission('orders.view'),
    getCartById
);

// CREATE CART
router.post(
    '/',
    authenticate,
    requirePermission('orders.create'),
    createCart
);

// UPDATE CART
router.put(
    '/:id',
    authenticate,
    requirePermission('orders.update'),
    updateCart
);

// ABANDON CART
router.delete(
    '/:id',
    authenticate,
    requirePermission('orders.delete'),
    deleteCart
);

module.exports = router;
