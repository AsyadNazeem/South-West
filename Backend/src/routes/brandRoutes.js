const express = require('express');

const router = express.Router();

const authenticate = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/permissionMiddleware');

const {
    getBrands,
    getBrandById,
    createBrand,
    updateBrand,
    deleteBrand
} = require('../controllers/brandController');

// GET ALL BRANDS
router.get(
    '/',
    authenticate,
    requirePermission('products.view'),
    getBrands
);

// GET BRAND BY ID
router.get(
    '/:id',
    authenticate,
    requirePermission('products.view'),
    getBrandById
);

// CREATE BRAND
router.post(
    '/',
    authenticate,
    requirePermission('products.create'),
    createBrand
);

// UPDATE BRAND
router.put(
    '/:id',
    authenticate,
    requirePermission('products.update'),
    updateBrand
);

// DELETE / DEACTIVATE BRAND
router.delete(
    '/:id',
    authenticate,
    requirePermission('products.delete'),
    deleteBrand
);

module.exports = router;
