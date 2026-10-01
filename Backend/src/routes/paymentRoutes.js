'use strict';

const express = require('express');
const router = express.Router();

const {
    getPayments,
    getPaymentById,
    createPayment,
    updatePayment,
    deletePayment,
    updatePaymentStatus
} = require('../controllers/paymentController');

const authenticate = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');

router.get(
    '/',
    authenticate,
    requirePermission('payments.view'),
    getPayments
);

router.get(
    '/:id',
    authenticate,
    requirePermission('payments.view'),
    getPaymentById
);

router.post(
    '/',
    authenticate,
    requirePermission('payments.create'),
    createPayment
);

router.put(
    '/:id',
    authenticate,
    requirePermission('payments.update'),
    updatePayment
);

router.delete(
    '/:id',
    authenticate,
    requirePermission('payments.delete'),
    deletePayment
);


router.patch(
    '/:id/status',
    authenticate,
    requirePermission('payments.update'),
    updatePaymentStatus
);
module.exports = router;
