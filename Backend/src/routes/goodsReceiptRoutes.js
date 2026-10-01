const express = require('express');

const router = express.Router();

const authenticate = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/permissionMiddleware');

const {
    getGoodsReceipts,
    getGoodsReceiptById,
    createGoodsReceipt,
    updateGoodsReceipt,
    receiveGoodsReceipt,
    cancelGoodsReceipt,
    deleteGoodsReceipt
} = require('../controllers/goodsReceiptController');


// GET ALL
router.get(
    '/',
    authenticate,
    requirePermission('products.view'),
    getGoodsReceipts
);

// RECEIVE
router.post(
    '/:id/receive',
    authenticate,
    requirePermission('products.update'),
    receiveGoodsReceipt
);


// CANCEL
router.post(
    '/:id/cancel',
    authenticate,
    requirePermission('products.update'),
    cancelGoodsReceipt
);


// GET BY ID
router.get(
    '/:id',
    authenticate,
    requirePermission('products.view'),
    getGoodsReceiptById
);


// CREATE
router.post(
    '/',
    authenticate,
    requirePermission('products.create'),
    createGoodsReceipt
);


// UPDATE
router.put(
    '/:id',
    authenticate,
    requirePermission('products.update'),
    updateGoodsReceipt
);


// DELETE
router.delete(
    '/:id',
    authenticate,
    requirePermission('products.delete'),
    deleteGoodsReceipt
);


module.exports = router;
