const express = require('express');

const router = express.Router();

const {
    getWarranties,
    getWarrantyById,
    createWarranty,
    updateWarranty,
    deleteWarranty
} = require('../controllers/warrantyController');

const authMiddleware = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/permissionMiddleware');


// GET all warranties
router.get('/', authMiddleware, requirePermission('products.view'), getWarranties);

// GET warranty by ID
router.get('/:id', authMiddleware, requirePermission('products.view'), getWarrantyById);

// CREATE warranty
router.post('/', authMiddleware, requirePermission('products.create'), createWarranty);

// UPDATE warranty
router.put('/:id', authMiddleware, requirePermission('products.update'), updateWarranty);

// DEACTIVATE warranty
router.delete('/:id', authMiddleware, requirePermission('products.delete'), deleteWarranty);


module.exports = router;
