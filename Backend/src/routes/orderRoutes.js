const express = require('express');

const router = express.Router();

const orderController = require('../controllers/orderController');

const authMiddleware = require('../middleware/authMiddleware');
const permissionMiddleware = require('../middleware/permissionMiddleware');


// Get all orders
router.get(
    '/',
    authMiddleware,
    permissionMiddleware('orders.view'),
    orderController.getAllOrders
);


// Get order by ID
router.get(
    '/:id',
    authMiddleware,
    permissionMiddleware('orders.view'),
    orderController.getOrderById
);


// Create order
router.post(
    '/',
    authMiddleware,
    permissionMiddleware('orders.create'),
    orderController.createOrder
);


// Update order
router.put(
    '/:id',
    authMiddleware,
    permissionMiddleware('orders.update'),
    orderController.updateOrder
);


// Delete order
router.delete(
    '/:id',
    authMiddleware,
    permissionMiddleware('orders.cancel'),
    orderController.deleteOrder
);


module.exports = router;
