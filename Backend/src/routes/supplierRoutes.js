const express = require('express');

const router = express.Router();

const authenticate = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/permissionMiddleware');

const {
    getSuppliers,
    getSupplierById,
    createSupplier,
    updateSupplier,
    deleteSupplier
} = require('../controllers/supplierController');


// GET ALL
router.get(
    '/',
    authenticate,
    requirePermission('products.view'),
    getSuppliers
);


// GET BY ID
router.get(
    '/:id',
    authenticate,
    requirePermission('products.view'),
    getSupplierById
);


// CREATE
router.post(
    '/',
    authenticate,
    requirePermission('products.create'),
    createSupplier
);


// UPDATE
router.put(
    '/:id',
    authenticate,
    requirePermission('products.update'),
    updateSupplier
);


// DEACTIVATE
router.delete(
    '/:id',
    authenticate,
    requirePermission('products.delete'),
    deleteSupplier
);


module.exports = router;
