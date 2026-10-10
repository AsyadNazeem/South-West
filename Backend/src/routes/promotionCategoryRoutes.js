const express = require('express');

const router = express.Router();

const {
    getAllPromotionCategories,
    getPromotionCategoryById,
    createPromotionCategory,
    updatePromotionCategory,
    deletePromotionCategory
} = require('../controllers/promotionCategoryController');

const authMiddleware = require('../middleware/authMiddleware');
const {requirePermission} = require('../middleware/requirePermission');


router.get(
    '/',
    authMiddleware,
    requirePermission('promotion_categories.view'),
    getAllPromotionCategories
);

router.get(
    '/:id',
    authMiddleware,
    requirePermission('promotion_categories.view'),
    getPromotionCategoryById
);

router.post(
    '/',
    authMiddleware,
    requirePermission('promotion_categories.create'),
    createPromotionCategory
);

router.put(
    '/:id',
    authMiddleware,
    requirePermission('promotion_categories.update'),
    updatePromotionCategory
);

router.delete(
    '/:id',
    authMiddleware,
    requirePermission('promotion_categories.delete'),
    deletePromotionCategory
);

module.exports = router;
