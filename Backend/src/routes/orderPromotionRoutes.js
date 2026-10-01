'use strict';

const express = require('express');
const router = express.Router();

const orderPromotionController = require('../controllers/orderPromotionController');

const authMiddleware = require('../middleware/authMiddleware');
const permissionMiddleware = require('../middleware/permissionMiddleware');


// GET all
router.get(
    '/',
    authMiddleware,
    permissionMiddleware('order_promotions.view'),
    orderPromotionController.getAllOrderPromotions
);


// GET one
router.get(
    '/:id',
    authMiddleware,
    permissionMiddleware('order_promotions.view'),
    orderPromotionController.getOrderPromotionById
);


// CREATE
router.post(
    '/',
    authMiddleware,
    permissionMiddleware('order_promotions.create'),
    orderPromotionController.createOrderPromotion
);


// UPDATE
router.put(
    '/:id',
    authMiddleware,
    permissionMiddleware('order_promotions.update'),
    orderPromotionController.updateOrderPromotion
);


// DELETE
router.delete(
    '/:id',
    authMiddleware,
    permissionMiddleware('order_promotions.delete'),
    orderPromotionController.deleteOrderPromotion
);


module.exports = router;
