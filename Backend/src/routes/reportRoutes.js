'use strict';

const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');

const sales = require('../controllers/reportController');
const payments = require('../controllers/paymentReportController');
const products = require('../controllers/productReportController');
const inventory = require('../controllers/inventoryReportController');

router.use(authenticate);
router.use(requirePermission('reports.view'));

// Sales reports
router.get('/sales/summary', sales.getSalesSummary);
router.get('/sales/summary/export', sales.exportSalesSummary);
router.get('/sales/daily', sales.getDailySales);
router.get('/sales/daily/export', sales.exportDailySales);
router.get('/sales/monthly', sales.getMonthlySales);
router.get('/sales/monthly/export', sales.exportMonthlySales);

// Payment reports
router.get('/payments/collection', payments.getCollectionSummary);
router.get('/payments/collection/export', payments.exportCollectionSummary);
router.get('/payments/methods', payments.getMethodBreakdown);
router.get('/payments/methods/export', payments.exportMethodBreakdown);
router.get('/payments/transactions', payments.getTransactionHistory);
router.get('/payments/transactions/export', payments.exportTransactionHistory);
router.get('/payments/refunds', payments.getRefundStatus);
router.get('/payments/refunds/export', payments.exportRefundStatus);

// Product reports
router.get('/products/summary', products.getSummary);
router.get('/products/summary/export', products.exportSummary);

router.get('/products/best-sellers', products.getBestSellers);
router.get('/products/best-sellers/export', products.exportBestSellers);

router.get('/products/least-sellers', products.getLeastSellers);
router.get('/products/least-sellers/export', products.exportLeastSellers);

router.get('/products/categories', products.getCategories);
router.get('/products/categories/export', products.exportCategories);

router.get('/products/brands', products.getBrands);
router.get('/products/brands/export', products.exportBrands);

router.get('/products/variants', products.getVariants);
router.get('/products/variants/export', products.exportVariants);

// Inventory reports
router.get('/inventory/summary', inventory.getSummary);
router.get('/inventory/summary/export', inventory.exportSummary);

router.get('/inventory/low-stock', inventory.getLowStock);
router.get('/inventory/low-stock/export', inventory.exportLowStock);

router.get('/inventory/out-of-stock', inventory.getOutOfStock);
router.get('/inventory/out-of-stock/export', inventory.exportOutOfStock);

router.get('/inventory/by-location', inventory.getByLocation);
router.get('/inventory/by-location/export', inventory.exportByLocation);

router.get('/inventory/movements', inventory.getMovements);
router.get('/inventory/movements/export', inventory.exportMovements);

router.get('/inventory/adjustments', inventory.getAdjustments);
router.get('/inventory/adjustments/export', inventory.exportAdjustments);

module.exports = router;
