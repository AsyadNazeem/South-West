'use strict';

const express = require('express');
const router = express.Router();

const orderPromotionController = require('../controllers/orderPromotionController');

const authMiddleware = require('../middleware/authMiddleware');
const {requirePermission} = require('../middleware/requirePermission');


// GET all
router.get(
    '/',
    authMiddleware,
    requirePermission('order_promotions.view'),
    orderPromotionController.getAllOrderPromotions
);


// GET one
router.get(
    '/:id',
    authMiddleware,
    requirePermission('order_promotions.view'),
    orderPromotionController.getOrderPromotionById
);


// CREATE
router.post(
    '/',
    authMiddleware,
    requirePermission('order_promotions.create'),
    orderPromotionController.createOrderPromotion
);


// UPDATE
router.put(
    '/:id',
    authMiddleware,
    requirePermission('order_promotions.update'),
    orderPromotionController.updateOrderPromotion
);


// DELETE
router.delete(
    '/:id',
    authMiddleware,
    requirePermission('order_promotions.delete'),
    orderPromotionController.deleteOrderPromotion
);


module.exports = router;
