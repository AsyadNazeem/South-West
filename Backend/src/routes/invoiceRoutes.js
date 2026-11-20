
'use strict';

const express = require('express');
const router = express.Router();

const {
    downloadInvoicePdf,
    getInvoices,
    getInvoiceById
} = require('../controllers/invoiceController');

const authenticate = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');

// GET ALL INVOICES
router.get(
    '/',
    authenticate,
    requirePermission('invoices.view'),
    getInvoices
);

// GET INVOICE BY ID
router.get(
    '/:id/pdf',
    authenticate,
    requirePermission('invoices.view'),
    downloadInvoicePdf
);

router.get(
    '/:id',
    authenticate,
    requirePermission('invoices.view'),
    getInvoiceById
);

module.exports = router;
