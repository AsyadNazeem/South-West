const express = require('express');

const router = express.Router();

const authenticate = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/permissionMiddleware');

const {
    getUnits,
    getUnitById,
    createUnit,
    updateUnit,
    deleteUnit
} = require('../controllers/unitController');

// GET ALL UNITS
router.get(
    '/',
    authenticate,
    requirePermission('products.view'),
    getUnits
);

// GET UNIT BY ID
router.get(
    '/:id',
    authenticate,
    requirePermission('products.view'),
    getUnitById
);

// CREATE UNIT
router.post(
    '/',
    authenticate,
    requirePermission('products.create'),
    createUnit
);

// UPDATE UNIT
router.put(
    '/:id',
    authenticate,
    requirePermission('products.update'),
    updateUnit
);

// DEACTIVATE UNIT
router.delete(
    '/:id',
    authenticate,
    requirePermission('products.delete'),
    deleteUnit
);

module.exports = router;
