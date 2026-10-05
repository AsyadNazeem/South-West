const express = require('express');

const router = express.Router();

const authenticate = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/permissionMiddleware');

const {
    getItemTypeSpecifications,
    getItemTypeSpecificationById,
    createItemTypeSpecification,
    updateItemTypeSpecification,
    deleteItemTypeSpecification,
    getSpecificationsByItemType
} = require('../controllers/itemTypeSpecificationController');


router.get(
    '/',
    authenticate,
    requirePermission('products.view'),
    getItemTypeSpecifications
);


router.get(
    '/:id',
    authenticate,
    requirePermission('products.view'),
    getItemTypeSpecificationById
);

router.get(
    '/item-type/:itemTypeId',
    getSpecificationsByItemType
);

router.post(
    '/',
    authenticate,
    requirePermission('products.create'),
    createItemTypeSpecification
);


router.put(
    '/:id',
    authenticate,
    requirePermission('products.update'),
    updateItemTypeSpecification
);


router.delete(
    '/:id',
    authenticate,
    requirePermission('products.delete'),
    deleteItemTypeSpecification
);


module.exports = router;
