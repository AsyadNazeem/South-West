const express = require('express');

const router = express.Router();

const authenticate = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/permissionMiddleware');

const {
    getItemSpecificationValues,
    getItemSpecificationValueById,
    createItemSpecificationValue,
    updateItemSpecificationValue,
    deleteItemSpecificationValue
} = require('../controllers/itemSpecificationValueController');


router.get(
    '/',
    authenticate,
    requirePermission('products.view'),
    getItemSpecificationValues
);


router.get(
    '/:id',
    authenticate,
    requirePermission('products.view'),
    getItemSpecificationValueById
);


router.post(
    '/',
    authenticate,
    requirePermission('products.create'),
    createItemSpecificationValue
);


router.put(
    '/:id',
    authenticate,
    requirePermission('products.update'),
    updateItemSpecificationValue
);


router.delete(
    '/:id',
    authenticate,
    requirePermission('products.delete'),
    deleteItemSpecificationValue
);


module.exports = router;
