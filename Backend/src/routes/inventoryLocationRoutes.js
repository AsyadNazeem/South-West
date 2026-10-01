const express = require('express');

const router = express.Router();

const authenticate = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/permissionMiddleware');

const {
    getInventoryLocations,
    getInventoryLocationById,
    createInventoryLocation,
    updateInventoryLocation,
    deleteInventoryLocation
} = require('../controllers/inventoryLocationController');


// GET ALL INVENTORY LOCATIONS
router.get(
    '/',
    authenticate,
    requirePermission('inventory.view'),
    getInventoryLocations
);


// GET INVENTORY LOCATION BY ID
router.get(
    '/:id',
    authenticate,
    requirePermission('inventory.view'),
    getInventoryLocationById
);


// CREATE INVENTORY LOCATION
router.post(
    '/',
    authenticate,
    requirePermission('inventory.create'),
    createInventoryLocation
);


// UPDATE INVENTORY LOCATION
router.put(
    '/:id',
    authenticate,
    requirePermission('inventory.update'),
    updateInventoryLocation
);


// DELETE / DEACTIVATE INVENTORY LOCATION
router.delete(
    '/:id',
    authenticate,
    requirePermission('inventory.delete'),
    deleteInventoryLocation
);


module.exports = router;
