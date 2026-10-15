
const express = require('express');
const router = express.Router();

const orderController = require('../controllers/orderController');
const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');

router.get(
    '/',
    authMiddleware,
    requirePermission('orders.view'),
    orderController.getAllOrders
);

router.get(
    '/:id',
    authMiddleware,
    requirePermission('orders.view'),
    orderController.getOrderById
);

router.post(
    '/',
    authMiddleware,
    requirePermission('orders.create'),
    orderController.createOrder
);

router.put(
    '/:id',
    authMiddleware,
    requirePermission('orders.update'),
    orderController.updateOrder
);

router.delete(
    '/:id',
    authMiddleware,
    requirePermission('orders.cancel'),
    orderController.deleteOrder
);

module.exports = router;
