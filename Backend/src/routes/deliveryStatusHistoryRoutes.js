'use strict';

const express = require('express');
const router = express.Router();

const {
    getDeliveryStatusHistories,
    getDeliveryStatusHistoryById
} = require('../controllers/deliveryStatusHistoryController');

const authenticate = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');

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

// History entries are generated automatically when a delivery status changes.
// Direct creation, editing and deletion are intentionally not exposed.

module.exports = router;
