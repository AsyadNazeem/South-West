'use strict';

const express = require('express');
const router = express.Router();

const {
    getInvoices,
    getInvoiceById,
    createInvoice,
    updateInvoice,
    deleteInvoice
} = require('../controllers/invoiceController');


const authenticate = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/permissionMiddleware');

router.get(
    '/',
    authenticate,
    requirePermission('invoices.view'),
    getInvoices
);

router.get(
    '/:id',
    authenticate,
    requirePermission('invoices.view'),
    getInvoiceById
);

router.post(
    '/',
    authenticate,
    requirePermission('invoices.create'),
    createInvoice
);

router.put(
    '/:id',
    authenticate,
    requirePermission('invoices.update'),
    updateInvoice
);

router.delete(
    '/:id',
    authenticate,
    requirePermission('invoices.delete'),
    deleteInvoice
);

module.exports = router;
