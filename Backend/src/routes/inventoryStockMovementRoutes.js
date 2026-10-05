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
    requirePermission('inventory.view'),
    getInventoryStockMovements
);


// GET BY ID
router.get(
    '/:id',
    authenticate,
    requirePermission('inventory.view'),
    getInventoryStockMovementById
);


// CREATE
router.post(
    '/',
    authenticate,
    requirePermission('inventory.create'),
    createInventoryStockMovement
);


module.exports = router;
