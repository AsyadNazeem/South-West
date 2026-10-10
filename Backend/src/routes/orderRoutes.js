const express = require('express');

const router = express.Router();

const orderController = require('../controllers/orderController');

const authMiddleware = require('../middleware/authMiddleware');
const {requirePermission} = require('../middleware/requirePermission');


// Get all orders
router.get(
    '/',
    authMiddleware,
    requirePermission('orders.view'),
    orderController.getAllOrders
);


// Get order by ID
router.get(
    '/:id',
    authMiddleware,
    requirePermission('orders.view'),
    orderController.getOrderById
);


// Create order
router.post(
    '/',
    authMiddleware,
    requirePermission('orders.create'),
    orderController.createOrder
);


// Update order
router.put(
    '/:id',
    authMiddleware,
    requirePermission('orders.update'),
    orderController.updateOrder
);


// Delete order
router.delete(
    '/:id',
    authMiddleware,
    requirePermission('orders.cancel'),
    orderController.deleteOrder
);


module.exports = router;
