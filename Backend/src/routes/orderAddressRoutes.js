'use strict';

const express = require('express');
const router = express.Router();

const {
    getOrderAddresses,
    getOrderAddressById,
    createOrderAddress,
    updateOrderAddress,
    deleteOrderAddress
} = require('../controllers/orderAddressController');

const authenticate = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');

router.get(
    '/',
    authenticate,
    requirePermission('order_addresses.view'),
    getOrderAddresses
);

router.get(
    '/:id',
    authenticate,
    requirePermission('order_addresses.view'),
    getOrderAddressById
);

router.post(
    '/',
    authenticate,
    requirePermission('order_addresses.create'),
    createOrderAddress
);

router.put(
    '/:id',
    authenticate,
    requirePermission('order_addresses.update'),
    updateOrderAddress
);

router.delete(
    '/:id',
    authenticate,
    requirePermission('order_addresses.delete'),
    deleteOrderAddress
);

module.exports = router;
