const express = require('express');

const router = express.Router();

const authenticate = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/permissionMiddleware');

const {
    getGoodsReceiptItems,
    getGoodsReceiptItemById,
    createGoodsReceiptItem,
    updateGoodsReceiptItem,
    deleteGoodsReceiptItem
} = require('../controllers/goodsReceiptItemController');

router.get(
    '/',
    authenticate,
    requirePermission('products.view'),
    getGoodsReceiptItems
);

router.get(
    '/:id',
    authenticate,
    requirePermission('products.view'),
    getGoodsReceiptItemById
);

router.post(
    '/',
    authenticate,
    requirePermission('products.create'),
    createGoodsReceiptItem
);

router.put(
    '/:id',
    authenticate,
    requirePermission('products.update'),
    updateGoodsReceiptItem
);

router.delete(
    '/:id',
    authenticate,
    requirePermission('products.delete'),
    deleteGoodsReceiptItem
);

module.exports = router;
