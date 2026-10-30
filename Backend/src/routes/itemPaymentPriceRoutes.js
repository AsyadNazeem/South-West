
const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');

const {
    getItemPaymentPrices,
    saveItemPaymentPrices
} = require('../controllers/itemPaymentPriceController');

router.get(
    '/',
    authenticate,
    requirePermission('products.view'),
    getItemPaymentPrices
);

router.post(
    '/bulk',
    authenticate,
    requirePermission('products.update'),
    saveItemPaymentPrices
);

module.exports = router;
