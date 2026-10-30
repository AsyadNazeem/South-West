const express = require('express');

const router = express.Router();

const authenticate = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');

const {
    getInventoryStocks,
    getInventoryStockById,
    createInventoryStock,
    updateInventoryStock,
    deleteInventoryStock,
    setOnlineStockCount
} = require('../controllers/inventoryStockController');

// Get all inventory stock records
router.get(
    '/',
    authenticate,
    requirePermission('inventory.view'),
    getInventoryStocks
);

// Set the actual online stock count
// Keep this BEFORE '/:id'
router.put(
    '/online-count',
    authenticate,
    requirePermission('inventory.update'),
    setOnlineStockCount
);

// Get inventory stock by ID
router.get(
    '/:id',
    authenticate,
    requirePermission('inventory.view'),
    getInventoryStockById
);

// Create inventory stock
router.post(
    '/',
    authenticate,
    requirePermission('inventory.create'),
    createInventoryStock
);

// Update inventory stock settings
router.put(
    '/:id',
    authenticate,
    requirePermission('inventory.update'),
    updateInventoryStock
);

// Delete inventory stock
router.delete(
    '/:id',
    authenticate,
    requirePermission('inventory.delete'),
    deleteInventoryStock
);

module.exports = router;
