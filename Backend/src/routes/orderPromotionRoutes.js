
'use strict';

const express = require('express');
const router = express.Router();

const orderPromotionController = require('../controllers/orderPromotionController');
const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');

router.get(
    '/',
    authMiddleware,
    requirePermission('order_promotions.view'),
    orderPromotionController.getAllOrderPromotions
);

router.get(
    '/:id',
    authMiddleware,
    requirePermission('order_promotions.view'),
    orderPromotionController.getOrderPromotionById
);

module.exports = router;
