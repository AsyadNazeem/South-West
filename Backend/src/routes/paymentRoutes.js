
'use strict';

const express = require('express');
const router = express.Router();

const {
    getPayments,
    getPaymentById,
    updatePaymentStatus
} = require('../controllers/paymentController');

const authenticate = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');

// List payments — read-only.
router.get(
    '/',
    authenticate,
    requirePermission('payments.view'),
    getPayments
);

// View one payment — read-only.
router.get(
    '/:id',
    authenticate,
    requirePermission('payments.view'),
    getPaymentById
);

router.patch(
    '/:id/status',
    authenticate,
    requirePermission('payments.update'),
    updatePaymentStatus
);

module.exports = router;
