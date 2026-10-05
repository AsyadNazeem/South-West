const express = require('express');

const router = express.Router();

const authenticate = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/permissionMiddleware');

const {
    getInventoryStocks,
    getInventoryStockById,
    createInventoryStock,
    updateInventoryStock,
    deleteInventoryStock
} = require('../controllers/inventoryStockController');


router.get(
    '/',
    authenticate,
    requirePermission('inventory.view'),
    getInventoryStocks
);


router.get(
    '/:id',
    authenticate,
    requirePermission('inventory.view'),
    getInventoryStockById
);


router.post(
    '/',
    authenticate,
    requirePermission('inventory.create'),
    createInventoryStock
);


router.put(
    '/:id',
    authenticate,
    requirePermission('inventory.update'),
    updateInventoryStock
);


router.delete(
    '/:id',
    authenticate,
    requirePermission('inventory.delete'),
    deleteInventoryStock
);


module.exports = router;
