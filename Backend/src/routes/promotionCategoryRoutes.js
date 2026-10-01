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
const permissionMiddleware = require('../middleware/permissionMiddleware');


router.get(
    '/',
    authMiddleware,
    permissionMiddleware('promotion_categories.view'),
    getAllPromotionCategories
);

router.get(
    '/:id',
    authMiddleware,
    permissionMiddleware('promotion_categories.view'),
    getPromotionCategoryById
);

router.post(
    '/',
    authMiddleware,
    permissionMiddleware('promotion_categories.create'),
    createPromotionCategory
);

router.put(
    '/:id',
    authMiddleware,
    permissionMiddleware('promotion_categories.update'),
    updatePromotionCategory
);

router.delete(
    '/:id',
    authMiddleware,
    permissionMiddleware('promotion_categories.delete'),
    deletePromotionCategory
);

module.exports = router;
