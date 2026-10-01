'use strict';

const express = require('express');

const router = express.Router();

const {
    getAllPromotionItems,
    getPromotionItemById,
    createPromotionItem,
    updatePromotionItem,
    deletePromotionItem
} = require('../controllers/promotionItemController');

const authMiddleware = require('../middleware/authMiddleware');
const permissionMiddleware = require('../middleware/permissionMiddleware');


// GET all promotion items
router.get(
    '/',
    authMiddleware,
    permissionMiddleware('promotion_items.view'),
    getAllPromotionItems
);


// GET promotion item by ID
router.get(
    '/:id',
    authMiddleware,
    permissionMiddleware('promotion_items.view'),
    getPromotionItemById
);


// CREATE promotion item
router.post(
    '/',
    authMiddleware,
    permissionMiddleware('promotion_items.create'),
    createPromotionItem
);


// UPDATE promotion item
router.put(
    '/:id',
    authMiddleware,
    permissionMiddleware('promotion_items.update'),
    updatePromotionItem
);


// DELETE promotion item
router.delete(
    '/:id',
    authMiddleware,
    permissionMiddleware('promotion_items.delete'),
    deletePromotionItem
);


module.exports = router;
