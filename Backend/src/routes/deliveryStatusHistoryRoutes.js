'use strict';

const express = require('express');

const router = express.Router();

const {
    getDeliveryStatusHistories,
    getDeliveryStatusHistoryById,
    createDeliveryStatusHistory,
    updateDeliveryStatusHistory,
    deleteDeliveryStatusHistory
} = require('../controllers/deliveryStatusHistoryController');

const authenticate = require('../middleware/authMiddleware');
const {requirePermission} = require('../middleware/requirePermission');


router.get(
    '/',
    authenticate,
    requirePermission('deliveries.view'),
    getDeliveryStatusHistories
);


router.get(
    '/:id',
    authenticate,
    requirePermission('deliveries.view'),
    getDeliveryStatusHistoryById
);


router.post(
    '/',
    authenticate,
    requirePermission('deliveries.update'),
    createDeliveryStatusHistory
);


router.put(
    '/:id',
    authenticate,
    requirePermission('deliveries.update'),
    updateDeliveryStatusHistory
);


router.delete(
    '/:id',
    authenticate,
    requirePermission('deliveries.delete'),
    deleteDeliveryStatusHistory
);


module.exports = router;
