const express = require('express');

const router = express.Router();

const authenticate = require('../middleware/authMiddleware');
const {requirePermission} = require('../middleware/requirePermission');

const {
    getItemPrices,
    getItemPriceById,
    createItemPrice,
    updateItemPrice,
    deleteItemPrice,
    bulkSaveItemPrices,
    bulkUpdateItemPrices
} = require('../controllers/itemPriceController');


router.get(
    '/',
    authenticate,
    requirePermission('products.view'),
    getItemPrices
);

router.post(
    '/bulk',
    authenticate,
    requirePermission('products.update'),
    bulkSaveItemPrices
);

router.get(
    '/:id',
    authenticate,
    requirePermission('products.view'),
    getItemPriceById
);


router.post(
    '/',
    authenticate,
    requirePermission('products.create'),
    createItemPrice
);


router.put(
    '/bulk-update',
    authenticate,
    requirePermission('products.update'),
    bulkUpdateItemPrices
);

router.put(
    '/:id',
    authenticate,
    requirePermission('products.update'),
    updateItemPrice
);


router.delete(
    '/:id',
    authenticate,
    requirePermission('products.delete'),
    deleteItemPrice
);


module.exports = router;
