const express = require('express');

const router = express.Router();

const authenticate = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/permissionMiddleware');

const {
    getItemPrices,
    getItemPriceById,
    createItemPrice,
    updateItemPrice,
    deleteItemPrice
} = require('../controllers/itemPriceController');


router.get(
    '/',
    authenticate,
    requirePermission('products.view'),
    getItemPrices
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
