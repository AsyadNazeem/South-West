
const express = require('express');
const router = express.Router();

const orderController = require('../controllers/orderController');
const orderStatusController = require('../controllers/orderStatusController');
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


router.patch(
    '/:id/status',
    authMiddleware,
    requirePermission('orders.update'),
    orderStatusController.updateOrderStatus
);

router.delete(
    '/:id',
    authMiddleware,
    requirePermission('orders.cancel'),
    orderController.deleteOrder
);

module.exports = router;
