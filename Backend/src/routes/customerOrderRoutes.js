
'use strict';

const express = require('express');
const router = express.Router();

const customerAuth = require('../middleware/customerAuthMiddleware');

const {
    getMyOrders,
    getMyOrderById
} = require('../controllers/customerOrderController');
const { getCustomerOrderDocument: downloadOrderDocument } = require('../controllers/orderDocumentController');

router.get('/', customerAuth, getMyOrders);
router.get('/:orderId/document', customerAuth, downloadOrderDocument);
router.get('/:orderId', customerAuth, getMyOrderById);

module.exports = router;
