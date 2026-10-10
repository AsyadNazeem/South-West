const express = require('express');
const router = express.Router();

const orderItemController = require('../controllers/orderItemController');

const authMiddleware = require('../middleware/authMiddleware');
const {requirePermission} = require('../middleware/requirePermission');

// GET all
router.get(
    '/',
    authMiddleware,
    requirePermission('order_items.view'),
    orderItemController.getAllOrderItems
);

// GET by ID
router.get(
    '/:id',
    authMiddleware,
    requirePermission('order_items.view'),
    orderItemController.getOrderItemById
);

// CREATE
router.post(
    '/',
    authMiddleware,
    requirePermission('order_items.create'),
    orderItemController.createOrderItem
);

// UPDATE
router.put(
    '/:id',
    authMiddleware,
    requirePermission('order_items.update'),
    orderItemController.updateOrderItem
);

// DELETE
router.delete(
    '/:id',
    authMiddleware,
    requirePermission('order_items.delete'),
    orderItemController.deleteOrderItem
);

module.exports = router;
