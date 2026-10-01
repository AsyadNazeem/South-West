'use strict';

const express = require('express');
const router = express.Router();

const deliveryController = require('../controllers/deliveryController');

const authMiddleware = require('../middleware/authMiddleware');
const permissionMiddleware = require('../middleware/permissionMiddleware');


// Get all deliveries
router.get(
    '/',
    authMiddleware,
    permissionMiddleware('deliveries.view'),
    deliveryController.getAllDeliveries
);


// Get delivery by ID
router.get(
    '/:id',
    authMiddleware,
    permissionMiddleware('deliveries.view'),
    deliveryController.getDeliveryById
);


// Create delivery
router.post(
    '/',
    authMiddleware,
    permissionMiddleware('deliveries.create'),
    deliveryController.createDelivery
);


// Update delivery
router.put(
    '/:id',
    authMiddleware,
    permissionMiddleware('deliveries.update'),
    deliveryController.updateDelivery
);


// Delete delivery
router.delete(
    '/:id',
    authMiddleware,
    permissionMiddleware('deliveries.delete'),
    deliveryController.deleteDelivery
);


module.exports = router;
