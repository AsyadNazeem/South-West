const express = require('express');

const router = express.Router();

const authenticate = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/permissionMiddleware');

const {
    getPurchaseOrders,
    getPurchaseOrderById,
    createPurchaseOrder
} = require('../controllers/purchaseOrderController');


// GET ALL
router.get(
    '/',
    authenticate,
    requirePermission('products.view'),
    getPurchaseOrders
);


// GET BY ID
router.get(
    '/:id',
    authenticate,
    requirePermission('products.view'),
    getPurchaseOrderById
);


// CREATE
router.post(
    '/',
    authenticate,
    requirePermission('products.create'),
    createPurchaseOrder
);


module.exports = router;
