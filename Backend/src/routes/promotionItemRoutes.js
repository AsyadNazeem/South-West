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
const {requirePermission} = require('../middleware/requirePermission');


// GET all promotion items
router.get(
    '/',
    authMiddleware,
    requirePermission('promotion_items.view'),
    getAllPromotionItems
);


// GET promotion item by ID
router.get(
    '/:id',
    authMiddleware,
    requirePermission('promotion_items.view'),
    getPromotionItemById
);


// CREATE promotion item
router.post(
    '/',
    authMiddleware,
    requirePermission('promotion_items.create'),
    createPromotionItem
);


// UPDATE promotion item
router.put(
    '/:id',
    authMiddleware,
    requirePermission('promotion_items.update'),
    updatePromotionItem
);


// DELETE promotion item
router.delete(
    '/:id',
    authMiddleware,
    requirePermission('promotion_items.delete'),
    deletePromotionItem
);


module.exports = router;
