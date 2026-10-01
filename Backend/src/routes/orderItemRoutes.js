const express = require('express');
const router = express.Router();

const orderItemController = require('../controllers/orderItemController');

const authMiddleware = require('../middleware/authMiddleware');
const permissionMiddleware = require('../middleware/permissionMiddleware');

// GET all
router.get(
    '/',
    authMiddleware,
    permissionMiddleware('order_items.view'),
    orderItemController.getAllOrderItems
);

// GET by ID
router.get(
    '/:id',
    authMiddleware,
    permissionMiddleware('order_items.view'),
    orderItemController.getOrderItemById
);

// CREATE
router.post(
    '/',
    authMiddleware,
    permissionMiddleware('order_items.create'),
    orderItemController.createOrderItem
);

// UPDATE
router.put(
    '/:id',
    authMiddleware,
    permissionMiddleware('order_items.update'),
    orderItemController.updateOrderItem
);

// DELETE
router.delete(
    '/:id',
    authMiddleware,
    permissionMiddleware('order_items.delete'),
    orderItemController.deleteOrderItem
);

module.exports = router;
