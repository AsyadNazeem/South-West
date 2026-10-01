const express = require('express');

const router = express.Router();

const authenticate = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/permissionMiddleware');

const {
    getPurchaseOrderItems,
    getPurchaseOrderItemById,
    createPurchaseOrderItem,
    updatePurchaseOrderItem,
    deletePurchaseOrderItem
} = require('../controllers/purchaseOrderItemController');


// GET ALL
router.get(
    '/',
    authenticate,
    requirePermission('products.view'),
    getPurchaseOrderItems
);


// GET BY ID
router.get(
    '/:id',
    authenticate,
    requirePermission('products.view'),
    getPurchaseOrderItemById
);


// CREATE
router.post(
    '/',
    authenticate,
    requirePermission('products.create'),
    createPurchaseOrderItem
);


// UPDATE
router.put(
    '/:id',
    authenticate,
    requirePermission('products.update'),
    updatePurchaseOrderItem
);


// DELETE
router.delete(
    '/:id',
    authenticate,
    requirePermission('products.delete'),
    deletePurchaseOrderItem
);


module.exports = router;
