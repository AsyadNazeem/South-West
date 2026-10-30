
'use strict';

const express = require('express');
const router = express.Router();

const {
    getOrderAddresses,
    getOrderAddressById
} = require('../controllers/orderAddressController');

const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');

router.get(
    '/',
    authMiddleware,
    requirePermission('order_addresses.view'),
    getOrderAddresses
);

router.get(
    '/:id',
    authMiddleware,
    requirePermission('order_addresses.view'),
    getOrderAddressById
);

module.exports = router;
