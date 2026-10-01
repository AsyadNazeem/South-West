const express = require('express');

const router = express.Router();

const authenticate = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/permissionMiddleware');

const {
    getItemSpecifications,
    getItemSpecificationById,
    createItemSpecification,
    updateItemSpecification,
    deleteItemSpecification
} = require('../controllers/itemSpecificationController');


router.get(
    '/',
    authenticate,
    requirePermission('products.view'),
    getItemSpecifications
);


router.get(
    '/:id',
    authenticate,
    requirePermission('products.view'),
    getItemSpecificationById
);


router.post(
    '/',
    authenticate,
    requirePermission('products.create'),
    createItemSpecification
);


router.put(
    '/:id',
    authenticate,
    requirePermission('products.update'),
    updateItemSpecification
);


router.delete(
    '/:id',
    authenticate,
    requirePermission('products.delete'),
    deleteItemSpecification
);


module.exports = router;
