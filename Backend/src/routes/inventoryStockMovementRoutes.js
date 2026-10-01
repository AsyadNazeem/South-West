const express = require('express');

const router = express.Router();

const authenticate = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/permissionMiddleware');

const {
    getInventoryStockMovements,
    getInventoryStockMovementById,
    createInventoryStockMovement
} = require('../controllers/inventoryStockMovementController');


// GET ALL
router.get(
    '/',
    authenticate,
    requirePermission('products.view'),
    getInventoryStockMovements
);


// GET BY ID
router.get(
    '/:id',
    authenticate,
    requirePermission('products.view'),
    getInventoryStockMovementById
);


// CREATE
router.post(
    '/',
    authenticate,
    requirePermission('products.create'),
    createInventoryStockMovement
);


module.exports = router;
