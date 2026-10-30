
'use strict';

const express = require('express');
const router = express.Router();

const orderItemController = require('../controllers/orderItemController');
const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');

router.get(
    '/',
    authMiddleware,
    requirePermission('order_items.view'),
    orderItemController.getAllOrderItems
);

router.get(
    '/:id',
    authMiddleware,
    requirePermission('order_items.view'),
    orderItemController.getOrderItemById
);

module.exports = router;
