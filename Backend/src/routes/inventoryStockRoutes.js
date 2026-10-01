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
    requirePermission('products.view'),
    getInventoryStocks
);


router.get(
    '/:id',
    authenticate,
    requirePermission('products.view'),
    getInventoryStockById
);


router.post(
    '/',
    authenticate,
    requirePermission('products.create'),
    createInventoryStock
);


router.put(
    '/:id',
    authenticate,
    requirePermission('products.update'),
    updateInventoryStock
);


router.delete(
    '/:id',
    authenticate,
    requirePermission('products.delete'),
    deleteInventoryStock
);


module.exports = router;
