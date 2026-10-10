'use strict';

const express = require('express');
const router = express.Router();

const deliveryController = require('../controllers/deliveryController');

const authMiddleware = require('../middleware/authMiddleware');
const {requirePermission} = require('../middleware/requirePermission');


// Get all deliveries
router.get(
    '/',
    authMiddleware,
    requirePermission('deliveries.view'),
    deliveryController.getAllDeliveries
);


// Get delivery by ID
router.get(
    '/:id',
    authMiddleware,
    requirePermission('deliveries.view'),
    deliveryController.getDeliveryById
);


// Create delivery
router.post(
    '/',
    authMiddleware,
    requirePermission('deliveries.create'),
    deliveryController.createDelivery
);


// Update delivery
router.put(
    '/:id',
    authMiddleware,
    requirePermission('deliveries.update'),
    deliveryController.updateDelivery
);


// Delete delivery
router.delete(
    '/:id',
    authMiddleware,
    requirePermission('deliveries.delete'),
    deliveryController.deleteDelivery
);


module.exports = router;
