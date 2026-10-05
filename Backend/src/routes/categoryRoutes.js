const express = require('express');

const {
    getCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory
} = require('../controllers/categoryController');

const authMiddleware = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/permissionMiddleware');

const router = express.Router();

router.get('/', authMiddleware, requirePermission('products.view'), getCategories);

router.get('/:id', authMiddleware, requirePermission('products.view'), getCategoryById);

router.post('/', authMiddleware, requirePermission('products.create'), createCategory);

router.put('/:id', authMiddleware, requirePermission('products.update'), updateCategory);

router.delete('/:id', authMiddleware, requirePermission('products.delete'), deleteCategory);

module.exports = router;
